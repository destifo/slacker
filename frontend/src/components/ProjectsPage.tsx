import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Link2, Unlink, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, Plus, Wifi, WifiOff, Settings } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../hooks/useAuth";

interface Workspace {
  name: string;
  is_linked: boolean;
  is_active: boolean;
  slack_member_id: string | null;
  is_bot_connected: boolean;
  bot_connected_at: string | null;
  bot_last_heartbeat: string | null;
  bot_error: string | null;
  is_syncing: boolean;
  sync_progress: string | null;
}

interface WorkspacesResponse {
  workspaces: Workspace[];
}

export function ProjectsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkingWorkspace, setLinkingWorkspace] = useState<string | null>(null);
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string | null>(null);
  const { person } = useAuth();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Auto-refresh when any workspace is syncing
  useEffect(() => {
    const isSyncing = workspaces.some(w => w.is_syncing);
    if (isSyncing) {
      const interval = setInterval(fetchWorkspaces, 2000);
      return () => clearInterval(interval);
    }
  }, [workspaces]);

  const fetchWorkspaces = async () => {
    try {
      const response = await axios.get<WorkspacesResponse>("/api/workspaces");
      setWorkspaces(response.data.workspaces);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
      setError("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (workspaceName: string) => {
    setLinkingWorkspace(workspaceName);
    try {
      await axios.post("/api/workspaces/link", { workspace_name: workspaceName });
      await fetchWorkspaces();
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to link workspace";
      alert(message);
    } finally {
      setLinkingWorkspace(null);
    }
  };

  const handleUnlink = async (workspaceName: string) => {
    if (!window.confirm(`Unlink from workspace "${workspaceName}"?`)) return;
    
    setLinkingWorkspace(workspaceName);
    try {
      await axios.post("/api/workspaces/unlink", { workspace_name: workspaceName });
      await fetchWorkspaces();
    } catch (err) {
      alert("Failed to unlink workspace");
    } finally {
      setLinkingWorkspace(null);
    }
  };

  const handleSwitch = async (workspaceName: string) => {
    setSwitchingWorkspace(workspaceName);
    try {
      await axios.post("/api/workspaces/switch", { workspace_name: workspaceName });
      await fetchWorkspaces();
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to switch workspace";
      alert(message);
    } finally {
      setSwitchingWorkspace(null);
    }
  };

  const goBack = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goToSetup = () => {
    window.history.pushState({}, "", "/setup");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goToSettings = (workspaceName: string) => {
    window.history.pushState({}, "", `/workspaces/${encodeURIComponent(workspaceName)}/settings`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={48} style={styles.spinner} />
        <p style={styles.loadingText}>Loading projects...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleGroup}>
            <button onClick={goBack} style={styles.backButton} title="Back to Tasks">
              <ArrowLeft size={20} />
            </button>
            <h1 style={styles.title}>Workspaces</h1>
            <div style={styles.badge}>{workspaces.length}</div>
          </div>
          <p style={styles.subtitle}>
            {person ? `Manage workspace connections for ${person.email}` : "Manage your workspace connections"}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={goToSetup} style={styles.addButton} title="Add Workspace">
            <Plus size={18} />
            <span>Add Workspace</span>
          </button>
          <button onClick={fetchWorkspaces} style={styles.refreshButton} title="Refresh">
            <RefreshCw size={18} />
          </button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div style={styles.content}>
        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {workspaces.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📁</div>
            <h3 style={styles.emptyTitle}>No Workspaces Configured</h3>
            <p style={styles.emptyText}>
              Get started by adding your first Slack workspace
            </p>
            <button onClick={goToSetup} style={styles.emptyAddButton}>
              <Plus size={20} />
              <span>Add Your First Workspace</span>
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.name}
                workspace={workspace}
                isLinking={linkingWorkspace === workspace.name}
                isSwitching={switchingWorkspace === workspace.name}
                onLink={handleLink}
                onUnlink={handleUnlink}
                onSwitch={handleSwitch}
                onSettings={goToSettings}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkspaceCardProps {
  workspace: Workspace;
  isLinking: boolean;
  isSwitching: boolean;
  onLink: (name: string) => void;
  onUnlink: (name: string) => void;
  onSwitch: (name: string) => void;
  onSettings: (name: string) => void;
}

function WorkspaceCard({ workspace, isLinking, isSwitching, onLink, onUnlink, onSwitch, onSettings }: WorkspaceCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle = {
    ...styles.card,
    ...(workspace.is_active ? styles.cardActive : {}),
    ...(isHovered ? styles.cardHover : {}),
  };

  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on a button
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onSettings(workspace.name);
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Bot Status Indicator */}
      <div style={styles.botStatusRow}>
        {workspace.is_syncing ? (
          <div style={styles.botStatusSyncing}>
            <Loader2 size={14} style={styles.syncSpinner} />
            <span>Syncing</span>
            {workspace.sync_progress && (
              <span style={styles.syncProgress}>• {workspace.sync_progress}</span>
            )}
          </div>
        ) : workspace.is_bot_connected ? (
          <div style={styles.botStatusOnline}>
            <Wifi size={14} />
            <span>Live</span>
            {workspace.bot_last_heartbeat && (
              <span style={styles.heartbeatTime}>• {formatTimeAgo(workspace.bot_last_heartbeat)}</span>
            )}
          </div>
        ) : (
          <div style={styles.botStatusOffline}>
            <WifiOff size={14} />
            <span>Offline</span>
            {workspace.bot_error && (
              <span style={styles.errorHint} title={workspace.bot_error}>• Error</span>
            )}
          </div>
        )}
      </div>

      <div style={styles.cardHeader}>
        <div style={styles.cardTitleRow}>
          <h3 style={styles.workspaceName}>{workspace.name}</h3>
          <button
            onClick={() => onSettings(workspace.name)}
            style={styles.settingsButton}
            title="Workspace Settings"
          >
            <Settings size={16} />
          </button>
        </div>
        <div style={styles.badges}>
          {workspace.is_active && (
            <div style={styles.activeBadge}>
              <CheckCircle2 size={14} />
              <span>Active</span>
            </div>
          )}
          {workspace.is_linked ? (
            <div style={styles.linkedBadge}>
              <CheckCircle2 size={14} />
              <span>Linked</span>
            </div>
          ) : (
            <div style={styles.unlinkedBadge}>
              <AlertCircle size={14} />
              <span>Not Linked</span>
            </div>
          )}
        </div>
      </div>

      {workspace.slack_member_id && (
        <div style={styles.memberInfo}>
          <span style={styles.memberLabel}>Slack ID:</span>
          <code style={styles.memberId}>{workspace.slack_member_id}</code>
        </div>
      )}

      <div style={styles.cardActions}>
        {workspace.is_linked ? (
          <>
            {!workspace.is_active && (
              <button
                onClick={() => onSwitch(workspace.name)}
                disabled={isSwitching}
                style={{ ...styles.button, ...styles.switchButton }}
              >
                {isSwitching ? (
                  <Loader2 size={16} style={styles.spinner} />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>{isSwitching ? "Switching..." : "Switch To"}</span>
              </button>
            )}
            <button
              onClick={() => onUnlink(workspace.name)}
              disabled={isLinking}
              style={{ ...styles.button, ...styles.unlinkButton }}
            >
              {isLinking ? (
                <Loader2 size={16} style={styles.spinner} />
              ) : (
                <Unlink size={16} />
              )}
              <span>{isLinking ? "Unlinking..." : "Unlink"}</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => onLink(workspace.name)}
            disabled={isLinking}
            style={{ ...styles.button, ...styles.linkButton }}
          >
            {isLinking ? (
              <Loader2 size={16} style={styles.spinner} />
            ) : (
              <Link2 size={16} />
            )}
            <span>{isLinking ? "Linking..." : "Link Workspace"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    minHeight: "100vh",
    background: "linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)",
    color: "var(--text-primary)",
  },
  header: {
    padding: "2rem 2rem 1.5rem",
    borderBottom: "1px solid var(--border-color)",
    background: "linear-gradient(180deg, var(--column-bg) 0%, transparent 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "2rem",
  },
  headerContent: {
    flex: 1,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.5rem",
  },
  backButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "var(--text-primary)",
    transition: "all 0.2s",
  },
  title: {
    fontSize: "2rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    margin: 0,
  },
  badge: {
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.875rem",
    fontWeight: "600",
    background: "var(--button-bg)",
    border: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  refreshButton: {
    padding: "0.5rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  addButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: "0.875rem",
    fontWeight: "600",
    boxShadow: "0 4px 12px var(--glow-blue)",
    transition: "all 0.2s",
  },
  content: {
    padding: "2rem",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "12px",
    color: "#ef4444",
    marginBottom: "2rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "1.5rem",
  },
  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "16px",
    padding: "1.5rem",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    animation: "fadeInUp 0.4s ease",
    cursor: "pointer",
  },
  botStatusRow: {
    marginBottom: "1rem",
  },
  botStatusOnline: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#34d399",
  },
  botStatusOffline: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#ef4444",
  },
  botStatusSyncing: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(129, 140, 248, 0.1)",
    border: "1px solid rgba(129, 140, 248, 0.3)",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#818cf8",
  },
  syncSpinner: {
    animation: "spin 1s linear infinite",
  },
  syncProgress: {
    opacity: 0.8,
    fontWeight: "500",
    maxWidth: "150px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  heartbeatTime: {
    opacity: 0.7,
    fontWeight: "500",
  },
  errorHint: {
    opacity: 0.8,
    fontWeight: "500",
    cursor: "help",
  },
  cardActive: {
    borderColor: "var(--accent-color)",
    boxShadow: "0 0 0 2px var(--glow-blue)",
  },
  cardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 12px 40px var(--shadow-color)",
    borderColor: "var(--card-hover-border)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    gap: "1rem",
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  workspaceName: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: 0,
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.375rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--text-tertiary)",
    transition: "all 0.2s",
  },
  badges: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  activeBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(129, 140, 248, 0.1)",
    border: "1px solid rgba(129, 140, 248, 0.3)",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#818cf8",
  },
  linkedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#34d399",
  },
  unlinkedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    background: "rgba(251, 146, 60, 0.1)",
    border: "1px solid rgba(251, 146, 60, 0.3)",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#fb923c",
  },
  memberInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    background: "var(--column-bg)",
    borderRadius: "8px",
    marginBottom: "1rem",
  },
  memberLabel: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "var(--text-tertiary)",
  },
  memberId: {
    fontSize: "0.8125rem",
    fontFamily: "monospace",
    color: "var(--text-secondary)",
    background: "var(--button-bg)",
    padding: "0.125rem 0.5rem",
    borderRadius: "4px",
  },
  cardActions: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  button: {
    flex: 1,
    minWidth: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  linkButton: {
    background: "var(--gradient-blue)",
    color: "#ffffff",
    boxShadow: "0 4px 12px var(--glow-blue)",
  },
  switchButton: {
    background: "var(--gradient-green)",
    color: "#ffffff",
    boxShadow: "0 4px 12px var(--glow-green)",
  },
  unlinkButton: {
    background: "var(--button-bg)",
    color: "var(--text-primary)",
    border: "1px solid var(--card-border)",
  },
  spinner: {
    animation: "spin 1s linear infinite",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    gap: "1.5rem",
    background: "linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)",
  },
  loadingText: {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    margin: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "4rem",
    marginBottom: "1rem",
  },
  emptyTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: "0 0 0.5rem 0",
  },
  emptyText: {
    fontSize: "0.9375rem",
    color: "var(--text-secondary)",
    margin: "0 0 1.5rem 0",
  },
  emptyAddButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.875rem 1.5rem",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: "1rem",
    fontWeight: "600",
    boxShadow: "0 4px 16px var(--glow-blue)",
    transition: "all 0.2s",
  },
};

