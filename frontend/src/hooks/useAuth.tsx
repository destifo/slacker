import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import axios from "axios";

export interface Person {
  id: string;
  name: string;
  email: string;
  is_me: boolean;
  external_id: string;
}

interface AuthContextType {
  person: Person | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  handleAuthCallback: (token: string, name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "slacker_token";
const PERSON_KEY = "slacker_person";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedPerson = localStorage.getItem(PERSON_KEY);

    if (storedToken && storedPerson) {
      setToken(storedToken);
      setPerson(JSON.parse(storedPerson));
      // Set default axios header
      axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
    }
    setIsLoading(false);
  }, []);

  // Verify token on load
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get<Person>("/api/auth/me");
      setPerson(response.data);
      localStorage.setItem(PERSON_KEY, JSON.stringify(response.data));
    } catch {
      // Token invalid, clear auth
      logout();
    }
  };

  const login = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = "/api/auth/google";
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSON_KEY);
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setPerson(null);
  }, []);

  const handleAuthCallback = useCallback(
    (newToken: string, name: string, email: string) => {
      // Store token
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      // Create temporary person until we verify
      const tempPerson: Person = {
        id: "",
        name,
        email,
        is_me: false,
        external_id: "",
      };
      setPerson(tempPerson);
      localStorage.setItem(PERSON_KEY, JSON.stringify(tempPerson));

      // Verify and get full person data
      verifyToken();
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        person,
        token,
        isAuthenticated: !!token && !!person,
        isLoading,
        login,
        logout,
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

