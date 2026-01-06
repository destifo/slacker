import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import axios from "axios";

export interface Person {
  id: string;
  name: string;
  email: string;
  is_me: boolean;
  external_id: string;
}

export interface Account {
  token: string;
  person: Person;
}

export interface MultiAccountStore {
  activeEmail: string | null;
  accounts: Record<string, Account>; // key: email
}

interface AuthContextType {
  person: Person | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accounts: Account[];
  activeEmail: string | null;
  login: () => void;
  logout: () => void;
  switchAccount: (email: string) => void;
  addAccount: () => void;
  removeAccount: (email: string) => void;
  handleAuthCallback: (token: string, name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCOUNTS_KEY = "slacker_accounts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [multiAccountStore, setMultiAccountStore] = useState<MultiAccountStore>(
    {
      activeEmail: null,
      accounts: {},
    }
  );
  const [isLoading, setIsLoading] = useState(true);

  // Derived state from multiAccountStore
  const activeAccount = multiAccountStore.activeEmail
    ? multiAccountStore.accounts[multiAccountStore.activeEmail]
    : null;
  const person = activeAccount?.person || null;
  const token = activeAccount?.token || null;
  const accounts = Object.values(multiAccountStore.accounts);

  // Load stored accounts on mount
  useEffect(() => {
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    if (stored) {
      try {
        const parsed: MultiAccountStore = JSON.parse(stored);
        setMultiAccountStore(parsed);

        // Set axios header for active account
        if (parsed.activeEmail && parsed.accounts[parsed.activeEmail]) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${
            parsed.accounts[parsed.activeEmail].token
          }`;
        }
      } catch (e) {
        console.error("Failed to parse stored accounts:", e);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage whenever store changes
  const saveStore = useCallback((store: MultiAccountStore) => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
    setMultiAccountStore(store);
  }, []);

  // Verify token for active account
  useEffect(() => {
    if (token && person) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get<Person>("/api/auth/me");
      // Update person data in store
      if (multiAccountStore.activeEmail) {
        const updated = {
          ...multiAccountStore,
          accounts: {
            ...multiAccountStore.accounts,
            [multiAccountStore.activeEmail]: {
              ...multiAccountStore.accounts[multiAccountStore.activeEmail],
              person: response.data,
            },
          },
        };
        saveStore(updated);
      }
    } catch (error: any) {
      // Only remove account on explicit 401 Unauthorized
      // Don't remove on network errors or other issues
      if (error?.response?.status === 401) {
        console.warn("Token invalid (401), removing account");
        if (multiAccountStore.activeEmail) {
          removeAccount(multiAccountStore.activeEmail);
        }
      } else {
        console.warn(
          "Failed to verify token (non-auth error):",
          error?.message || error
        );
        // Keep the account - might be a temporary network issue
      }
    }
  };

  const login = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = "/api/auth/google";
  }, []);

  const addAccount = useCallback(() => {
    // Same as login - redirect to Google OAuth
    window.location.href = "/api/auth/google";
  }, []);

  const switchAccount = useCallback(
    (email: string) => {
      if (multiAccountStore.accounts[email]) {
        const updated = {
          ...multiAccountStore,
          activeEmail: email,
        };
        saveStore(updated);

        // Update axios header
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${multiAccountStore.accounts[email].token}`;
      }
    },
    [multiAccountStore, saveStore]
  );

  const logout = useCallback(() => {
    if (!multiAccountStore.activeEmail) return;

    const { [multiAccountStore.activeEmail]: removed, ...remainingAccounts } =
      multiAccountStore.accounts;

    const remainingEmails = Object.keys(remainingAccounts);
    const updated: MultiAccountStore = {
      activeEmail: remainingEmails.length > 0 ? remainingEmails[0] : null,
      accounts: remainingAccounts,
    };

    saveStore(updated);

    // Update axios header
    if (updated.activeEmail && updated.accounts[updated.activeEmail]) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${
        updated.accounts[updated.activeEmail].token
      }`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [multiAccountStore, saveStore]);

  const removeAccount = useCallback(
    (email: string) => {
      const { [email]: removed, ...remainingAccounts } =
        multiAccountStore.accounts;

      const remainingEmails = Object.keys(remainingAccounts);
      const newActiveEmail =
        multiAccountStore.activeEmail === email
          ? remainingEmails.length > 0
            ? remainingEmails[0]
            : null
          : multiAccountStore.activeEmail;

      const updated: MultiAccountStore = {
        activeEmail: newActiveEmail,
        accounts: remainingAccounts,
      };

      saveStore(updated);

      // Update axios header
      if (updated.activeEmail && updated.accounts[updated.activeEmail]) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${
          updated.accounts[updated.activeEmail].token
        }`;
      } else {
        delete axios.defaults.headers.common["Authorization"];
      }
    },
    [multiAccountStore, saveStore]
  );

  const handleAuthCallback = useCallback(
    (newToken: string, name: string, email: string) => {
      // Create account
      const newAccount: Account = {
        token: newToken,
        person: {
          id: "",
          name,
          email,
          is_me: false,
          external_id: "",
        },
      };

      // Add to store
      const updated: MultiAccountStore = {
        activeEmail: email,
        accounts: {
          ...multiAccountStore.accounts,
          [email]: newAccount,
        },
      };

      saveStore(updated);

      // Set axios header
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      // Don't call verifyToken here - let the useEffect handle it on next render
      // This avoids race conditions with stale closure state
    },
    [multiAccountStore, saveStore]
  );

  return (
    <AuthContext.Provider
      value={{
        person,
        token,
        isAuthenticated: !!token && !!person,
        isLoading,
        accounts,
        activeEmail: multiAccountStore.activeEmail,
        login,
        logout,
        switchAccount,
        addAccount,
        removeAccount,
        handleAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
