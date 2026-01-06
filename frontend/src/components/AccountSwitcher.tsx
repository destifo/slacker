import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { Check, ChevronDown, Plus } from "lucide-react";

export function AccountSwitcher() {
  const { accounts, activeEmail, switchAccount, addAccount } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeAccount = accounts.find((acc) => acc.person.email === activeEmail);
  if (!activeAccount) return null;

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.trigger,
          ...(isOpen ? styles.triggerActive : {}),
        }}
      >
        <div style={styles.avatar}>
          <span style={styles.initials}>
            {getInitials(activeAccount.person.name)}
          </span>
        </div>
        <div style={styles.info}>
          <span style={styles.name}>{activeAccount.person.name}</span>
          <span style={styles.email}>{activeAccount.person.email}</span>
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
            <span style={styles.dropdownTitle}>Switch Account</span>
            <span style={styles.accountCount}>
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          <div style={styles.accountList}>
            {accounts.map((account) => {
              const isActive = account.person.email === activeEmail;
              return (
                <button
                  key={account.person.email}
                  onClick={() => {
                    switchAccount(account.person.email);
                    setIsOpen(false);
                  }}
                  style={{
                    ...styles.accountItem,
                    ...(isActive ? styles.accountItemActive : {}),
                  }}
                >
                  <div style={styles.accountAvatar}>
                    <span style={styles.accountInitials}>
                      {getInitials(account.person.name)}
                    </span>
                  </div>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountName}>{account.person.name}</span>
                    <span style={styles.accountEmail}>{account.person.email}</span>
                  </div>
                  {isActive && (
                    <Check size={16} style={styles.checkIcon} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={styles.divider} />

          <button onClick={addAccount} style={styles.addAccountButton}>
            <div style={styles.addAccountIcon}>
              <Plus size={16} />
            </div>
            <span>Add another account</span>
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
    minWidth: "220px",
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
    boxShadow: "0 2px 8px var(--glow-blue)",
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
    maxWidth: "140px",
  },
  email: {
    fontSize: "0.6875rem",
    color: "var(--text-tertiary)",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "140px",
  },
  chevron: {
    color: "var(--text-tertiary)",
    transition: "transform 0.2s ease",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    width: "320px",
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
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    background: "var(--column-bg)",
    borderBottom: "1px solid var(--border-color)",
  },
  dropdownTitle: {
    fontSize: "0.8125rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  accountCount: {
    fontSize: "0.75rem",
    color: "var(--text-tertiary)",
    fontWeight: "500",
  },
  accountList: {
    maxHeight: "300px",
    overflowY: "auto",
  },
  accountItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.875rem 1.25rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  accountItemActive: {
    background: "var(--active-bg)",
  },
  accountAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "var(--gradient-blue)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  accountInitials: {
    fontSize: "0.8125rem",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "0.5px",
  },
  accountInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: "0.875rem",
    fontWeight: "600",
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
  checkIcon: {
    color: "var(--accent-color)",
    flexShrink: 0,
  },
  divider: {
    height: "1px",
    background: "var(--border-color)",
  },
  addAccountButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.875rem 1.25rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "var(--accent-color)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  addAccountIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "var(--button-bg)",
    border: "1px dashed var(--card-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent-color)",
  },
};

// Add hover styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  button:hover:not(:disabled) {
    background: var(--hover-bg) !important;
  }
`;
document.head.appendChild(styleSheet);

