import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { LogOut, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

export function UserMenu() {
  const { person, logout, isLoading, accounts, removeAccount, addAccount } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      // If no accounts left, redirect to login
      if (accounts.length === 1) {
        window.location.href = "/";
      }
      setIsLoggingOut(false);
      setIsOpen(false);
    }, 500);
  };

  const handleRemoveAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Remove account ${email}?`)) {
      removeAccount(email);
      setIsOpen(false);
    }
  };

  if (isLoading || !person) {
    return (
      <div style={styles.skeleton}>
        <div style={styles.skeletonAvatar} />
        <div style={styles.skeletonText} />
      </div>
    );
  }

  // Get initials from name
  const initials = person.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={styles.container} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.trigger,
          ...(isOpen ? styles.triggerActive : {}),
        }}
      >
        <div style={styles.avatar}>
          <span style={styles.initials}>{initials}</span>
        </div>
        <div style={styles.info}>
          <span style={styles.name}>{person.name}</span>
          <span style={styles.email}>{person.email}</span>
        </div>
        <ChevronDown
          size={16}
          style={{
            ...styles.chevron,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <div style={styles.avatarLarge}>
              <span style={styles.initialsLarge}>{initials}</span>
            </div>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{person.name}</span>
              <span style={styles.userEmail}>{person.email}</span>
            </div>
          </div>

          <div style={styles.divider} />

          {accounts.length > 1 && (
            <>
              <div style={styles.accountsSection}>
                <span style={styles.sectionTitle}>All Accounts</span>
                {accounts
                  .filter((acc) => acc.person.email !== person.email)
                  .map((account) => (
                    <div key={account.person.email} style={styles.accountRow}>
                      <div style={styles.accountInfo}>
                        <span style={styles.accountName}>
                          {account.person.name}
                        </span>
                        <span style={styles.accountEmail}>
                          {account.person.email}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleRemoveAccount(account.person.email, e)}
                        style={styles.removeButton}
                        title="Remove account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
              <div style={styles.divider} />
            </>
          )}

          <button onClick={addAccount} style={styles.menuItem}>
            <Plus size={16} />
            <span>Add another account</span>
          </button>

          <div style={styles.divider} />

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              ...styles.menuItem,
              ...styles.logoutItem,
              ...(isLoggingOut ? styles.menuItemDisabled : {}),
            }}
          >
            {isLoggingOut ? (
              <Loader2 size={16} style={styles.spinner} />
            ) : (
              <LogOut size={16} />
            )}
            <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    zIndex: 100,
  },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    minWidth: "200px",
  },
  triggerActive: {
    borderColor: "var(--accent-color)",
    boxShadow: "0 0 0 2px var(--glow-blue)",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "var(--gradient-blue)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  initials: {
    fontSize: "0.75rem",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "0.5px",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: "0.8125rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "120px",
  },
  email: {
    fontSize: "0.6875rem",
    color: "var(--text-tertiary)",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "120px",
  },
  chevron: {
    color: "var(--text-tertiary)",
    transition: "transform 0.2s ease",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: "260px",
    background: "var(--card-bg)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--card-border)",
    borderRadius: "16px",
    boxShadow: "0 20px 40px var(--shadow-color)",
    overflow: "hidden",
    animation: "dropdownSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  dropdownHeader: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1.25rem",
    background: "var(--column-bg)",
  },
  avatarLarge: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "var(--gradient-blue)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 4px 12px var(--glow-blue)",
  },
  initialsLarge: {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "0.5px",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    minWidth: 0,
  },
  userName: {
    fontSize: "0.9375rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userEmail: {
    fontSize: "0.8125rem",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  divider: {
    height: "1px",
    background: "var(--border-color)",
    margin: "0",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.875rem 1.25rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "var(--text-primary)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  menuItemDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  logoutItem: {
    color: "#ef4444",
  },
  accountsSection: {
    padding: "0.75rem 0",
  },
  sectionTitle: {
    display: "block",
    padding: "0.5rem 1.25rem",
    fontSize: "0.6875rem",
    fontWeight: "600",
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  accountRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1.25rem",
    gap: "0.75rem",
  },
  accountInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: "0.8125rem",
    fontWeight: "500",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  accountEmail: {
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  removeButton: {
    padding: "0.375rem",
    background: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
    cursor: "pointer",
    color: "#ef4444",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    animation: "spin 1s linear infinite",
  },
  skeleton: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    minWidth: "200px",
  },
  skeletonAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "var(--column-bg)",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  skeletonText: {
    width: "100px",
    height: "16px",
    borderRadius: "4px",
    background: "var(--column-bg)",
    animation: "pulse 1.5s ease-in-out infinite",
  },
};

// Add animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes dropdownSlide {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  button:hover:not(:disabled) .logout-hover {
    background: rgba(239, 68, 68, 0.1) !important;
  }
`;
document.head.appendChild(styleSheet);

