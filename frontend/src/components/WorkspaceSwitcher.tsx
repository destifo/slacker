import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, FolderKanban, Link, Unlink, Settings, Plus } from "lucide-react";
import axios from "axios";

interface Workspace {
  name: string;
  is_linked: boolean;
  is_active: boolean;
  slack_member_id: string | null;
  is_bot_connected: boolean;
  bot_connected_at: string | null;
  bot_last_heartbeat: string | null;
  bot_error: string | null;
}

interface WorkspacesResponse {
  workspaces: Workspace[];
}

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceName: string | null) => void;
}

export function WorkspaceSwitcher({ onWorkspaceChange }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
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

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await axios.get<WorkspacesResponse>("/api/workspaces");
      setWorkspaces(response.data.workspaces);
      const active = response.data.workspaces.find((w) => w.is_active);
      if (active && onWorkspaceChange) {
        onWorkspaceChange(active.name);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (workspaceName: string) => {
    setSwitching(workspaceName);
    try {
      await axios.post("/api/workspaces/switch", { workspace_name: workspaceName });
      await fetchWorkspaces();
      if (onWorkspaceChange) {
        onWorkspaceChange(workspaceName);
      }
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    } finally {
      setSwitching(null);
    }
  };

  const handleLink = async (workspaceName: string) => {
    setSwitching(workspaceName);
    try {
      await axios.post("/api/workspaces/link", { workspace_name: workspaceName });
      await fetchWorkspaces();
    } catch (error) {
      console.error("Failed to link workspace:", error);
    } finally {
      setSwitching(null);
    }
  };

  const goToProjects = () => {
    setIsOpen(false);
    window.history.pushState({}, "", "/projects");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goToSetup = () => {
    setIsOpen(false);
    window.history.pushState({}, "", "/setup");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const activeWorkspace = workspaces.find((w) => w.is_active);
  const linkedWorkspaces = workspaces.filter((w) => w.is_linked);
  const unlinkedWorkspaces = workspaces.filter((w) => !w.is_linked);

  if (loading) {
    return (
      <div style={styles.skeleton}>
        <FolderKanban size={18} />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.trigger,
          ...(isOpen ? styles.triggerActive : {}),
        }}
      >
        <FolderKanban size={18} style={styles.icon} />
        <span style={styles.workspaceName}>
          {activeWorkspace?.name || "No workspace"}
        </span>
        {activeWorkspace && (
          <span 
            style={activeWorkspace.is_bot_connected ? styles.triggerStatusOnline : styles.triggerStatusOffline} 
            title={activeWorkspace.is_bot_connected ? "Bot connected" : "Bot offline"}
          />
        )}
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
            <span style={styles.dropdownTitle}>Workspaces</span>
            <span style={styles.workspaceCount}>
              {linkedWorkspaces.length} linked
            </span>
          </div>

          {linkedWorkspaces.length > 0 && (
            <div style={styles.section}>
              <span style={styles.sectionTitle}>Linked Workspaces</span>
              {linkedWorkspaces.map((workspace) => {
                const isActive = workspace.is_active;
                const isSwitching = switching === workspace.name;
                return (
                  <button
                    key={workspace.name}
                    onClick={() => !isActive && handleSwitch(workspace.name)}
                    disabled={isSwitching}
                    style={{
                      ...styles.workspaceItem,
                      ...(isActive ? styles.workspaceItemActive : {}),
                      ...(isSwitching ? styles.workspaceItemDisabled : {}),
                    }}
                  >
                    <div style={{
                      ...styles.workspaceIcon,
                      ...(workspace.is_bot_connected ? {} : styles.workspaceIconOffline),
                    }}>
                      <FolderKanban size={16} />
                    </div>
                    <div style={styles.workspaceInfo}>
                      <div style={styles.workspaceNameRow}>
                        <span style={styles.workspaceItemName}>{workspace.name}</span>
                        <span style={workspace.is_bot_connected ? styles.statusDotOnline : styles.statusDotOffline} title={workspace.is_bot_connected ? "Bot connected" : "Bot offline"} />
                      </div>
                      {isActive && (
                        <span style={styles.activeLabel}>Active</span>
                      )}
                    </div>
                    {isActive && <Check size={16} style={styles.checkIcon} />}
                  </button>
                );
              })}
            </div>
          )}

          {unlinkedWorkspaces.length > 0 && (
            <div style={styles.section}>
              <span style={styles.sectionTitle}>Available to Link</span>
              {unlinkedWorkspaces.map((workspace) => {
                const isLinking = switching === workspace.name;
                return (
                  <button
                    key={workspace.name}
                    onClick={() => handleLink(workspace.name)}
                    disabled={isLinking}
                    style={{
                      ...styles.workspaceItem,
                      ...styles.unlinkedItem,
                      ...(isLinking ? styles.workspaceItemDisabled : {}),
                    }}
                  >
                    <div style={styles.workspaceIconUnlinked}>
                      <Unlink size={16} />
                    </div>
                    <div style={styles.workspaceInfo}>
                      <div style={styles.workspaceNameRow}>
                        <span style={styles.workspaceItemName}>{workspace.name}</span>
                        <span style={workspace.is_bot_connected ? styles.statusDotOnline : styles.statusDotOffline} title={workspace.is_bot_connected ? "Bot connected" : "Bot offline"} />
                      </div>
                      <span style={styles.unlinkedLabel}>Click to link</span>
                    </div>
                    <Link size={14} style={styles.linkIcon} />
                  </button>
                );
              })}
            </div>
          )}

          {workspaces.length === 0 && (
            <div style={styles.emptyState}>
              <p>No workspaces configured</p>
              <button onClick={goToSetup} style={styles.addNewButtonSmall}>
                <Plus size={14} />
                <span>Add Workspace</span>
              </button>
            </div>
          )}

          <div style={styles.divider} />

          <div style={styles.footerButtons}>
            <button onClick={goToSetup} style={styles.addNewButton}>
              <Plus size={16} />
              <span>Add New</span>
            </button>
            <button onClick={goToProjects} style={styles.manageButton}>
              <Settings size={16} />
              <span>Manage</span>
            </button>
          </div>
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
  skeleton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    color: "var(--text-tertiary)",
    fontSize: "0.875rem",
  },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    fontWeight: "600",
  },
  triggerActive: {
    borderColor: "var(--accent-color)",
    boxShadow: "0 0 0 2px var(--glow-blue)",
  },
  icon: {
    color: "var(--accent-color)",
  },
  workspaceName: {
    maxWidth: "150px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  triggerStatusOnline: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 6px #34d399",
    flexShrink: 0,
  },
  triggerStatusOffline: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#ef4444",
    animation: "pulse 2s infinite",
    flexShrink: 0,
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
    width: "280px",
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
  workspaceCount: {
    fontSize: "0.75rem",
    color: "var(--text-tertiary)",
    fontWeight: "500",
  },
  section: {
    padding: "0.5rem 0",
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
  workspaceItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.75rem 1.25rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  workspaceItemActive: {
    background: "var(--active-bg)",
  },
  workspaceItemDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  unlinkedItem: {
    opacity: 0.7,
  },
  workspaceIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "var(--gradient-blue)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    flexShrink: 0,
  },
  workspaceIconUnlinked: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "var(--button-bg)",
    border: "1px dashed var(--card-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-tertiary)",
    flexShrink: 0,
  },
  workspaceIconOffline: {
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
  },
  workspaceInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    flex: 1,
    minWidth: 0,
  },
  workspaceNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  workspaceItemName: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statusDotOnline: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 6px #34d399",
    flexShrink: 0,
  },
  statusDotOffline: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#6b7280",
    flexShrink: 0,
  },
  activeLabel: {
    fontSize: "0.6875rem",
    color: "var(--accent-color)",
    fontWeight: "500",
  },
  unlinkedLabel: {
    fontSize: "0.6875rem",
    color: "var(--text-tertiary)",
    fontWeight: "500",
  },
  checkIcon: {
    color: "var(--accent-color)",
    flexShrink: 0,
  },
  linkIcon: {
    color: "var(--accent-color)",
    flexShrink: 0,
  },
  emptyState: {
    padding: "2rem 1.25rem",
    textAlign: "center",
    color: "var(--text-tertiary)",
    fontSize: "0.875rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  },
  addNewButtonSmall: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.8125rem",
    fontWeight: "600",
    color: "#ffffff",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  divider: {
    height: "1px",
    background: "var(--border-color)",
  },
  footerButtons: {
    display: "flex",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
  },
  addNewButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.625rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: "600",
    color: "#ffffff",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  manageButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.625rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: "500",
    color: "var(--text-secondary)",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

