import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Loader2,
  ArrowLeft,
  Key,
  Smile,
  Save,
  RotateCcw,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Users,
  Settings,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface EmojiMappings {
  in_progress: string[];
  blocked: string[];
  completed: string[];
}

interface WorkspaceSettings {
  workspace_name: string;
  emoji_mappings: EmojiMappings;
  has_app_token: boolean;
  has_bot_token: boolean;
}

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  slack_member_id: string | null;
  is_active: boolean;
  linked_at: string;
}

interface UsersResponse {
  users: WorkspaceUser[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface WorkspaceSettingsPageProps {
  workspaceName: string;
}

type TabType = "configure" | "users";

export function WorkspaceSettingsPage({ workspaceName }: WorkspaceSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>("configure");
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Token form state
  const [appToken, setAppToken] = useState("");
  const [botToken, setBotToken] = useState("");
  const [showAppToken, setShowAppToken] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);

  // Emoji mappings form state
  const [emojiMappings, setEmojiMappings] = useState<EmojiMappings>({
    in_progress: [],
    blocked: [],
    completed: [],
  });
  const [newEmoji, setNewEmoji] = useState({ in_progress: "", blocked: "", completed: "" });

  // Users state
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPagination, setUsersPagination] = useState({
    page: 0,
    per_page: 10,
    total: 0,
    total_pages: 0,
  });

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<WorkspaceSettings>(
        `/api/workspaces/${workspaceName}/settings`
      );
      setSettings(response.data);
      setEmojiMappings(response.data.emoji_mappings);
      setError(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [workspaceName]);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const response = await axios.get<UsersResponse>(
        `/api/workspaces/${workspaceName}/users`,
        { params: { page: usersPagination.page, per_page: usersPagination.per_page } }
      );
      setUsers(response.data.users);
      setUsersPagination((prev) => ({
        ...prev,
        total: response.data.total,
        total_pages: response.data.total_pages,
      }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [workspaceName, usersPagination.page, usersPagination.per_page]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const handleUpdateTokens = async () => {
    if (!appToken && !botToken) {
      setError("Please enter at least one token to update");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: { app_token?: string; bot_token?: string } = {};
      if (appToken) payload.app_token = appToken;
      if (botToken) payload.bot_token = botToken;

      await axios.put(`/api/workspaces/${workspaceName}/tokens`, payload);
      setSuccess("Tokens updated successfully. Restart the server to apply changes.");
      setAppToken("");
      setBotToken("");
      await fetchSettings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to update tokens");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmojiMappings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.put(`/api/workspaces/${workspaceName}/emoji-mappings`, {
        emoji_mappings: emojiMappings,
      });
      setSuccess("Emoji mappings updated successfully!");
      await fetchSettings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to update emoji mappings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetMappings = async () => {
    if (!window.confirm("Reset emoji mappings to defaults?")) return;

    setSaving(true);
    setError(null);

    try {
      const response = await axios.post<WorkspaceSettings>(
        `/api/workspaces/${workspaceName}/emoji-mappings/reset`
      );
      setEmojiMappings(response.data.emoji_mappings);
      setSuccess("Emoji mappings reset to defaults!");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to reset mappings");
    } finally {
      setSaving(false);
    }
  };

  const addEmoji = (status: keyof EmojiMappings) => {
    const emoji = newEmoji[status].trim().toLowerCase();
    if (!emoji) return;
    if (emojiMappings[status].includes(emoji)) {
      setError(`Emoji "${emoji}" already exists in ${status}`);
      return;
    }

    setEmojiMappings((prev) => ({
      ...prev,
      [status]: [...prev[status], emoji],
    }));
    setNewEmoji((prev) => ({ ...prev, [status]: "" }));
    setError(null);
  };

  const removeEmoji = (status: keyof EmojiMappings, emoji: string) => {
    setEmojiMappings((prev) => ({
      ...prev,
      [status]: prev[status].filter((e) => e !== emoji),
    }));
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address");
      return;
    }

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const response = await axios.post(`/api/workspaces/${workspaceName}/users/invite`, {
        email: inviteEmail.trim(),
      });

      if (response.data.success) {
        setInviteSuccess(response.data.message);
        setInviteEmail("");
        fetchUsers();
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteSuccess(null);
        }, 2000);
      } else {
        setInviteError(response.data.message);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setInviteError(axiosErr.response?.data?.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Remove ${userName} from this workspace?`)) return;

    try {
      await axios.post(`/api/workspaces/${workspaceName}/users/remove`, {
        user_id: userId,
      });
      setSuccess(`${userName} has been removed from the workspace`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to remove user");
    }
  };

  const goBack = () => {
    window.history.pushState({}, "", "/projects");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={48} style={styles.spinner} />
        <p style={styles.loadingText}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleGroup}>
            <button onClick={goBack} style={styles.backButton} title="Back to Projects">
              <ArrowLeft size={20} />
            </button>
            <h1 style={styles.title}>{workspaceName}</h1>
          </div>
          <p style={styles.subtitle}>Workspace Settings</p>
        </div>
        <div style={styles.headerActions}>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div style={styles.mainContent}>
        {/* Sidebar */}
        <nav style={styles.sidebar}>
          <button
            onClick={() => setActiveTab("configure")}
            style={{
              ...styles.sidebarButton,
              ...(activeTab === "configure" ? styles.sidebarButtonActive : {}),
            }}
          >
            <Settings size={18} />
            <span>Configure</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            style={{
              ...styles.sidebarButton,
              ...(activeTab === "users" ? styles.sidebarButtonActive : {}),
            }}
          >
            <Users size={18} />
            <span>Users</span>
            {usersPagination.total > 0 && (
              <span style={styles.userCount}>{usersPagination.total}</span>
            )}
          </button>
        </nav>

        {/* Content */}
        <div style={styles.content}>
          {error && (
            <div style={styles.errorBanner}>
              <AlertCircle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)} style={styles.dismissButton}>
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div style={styles.successBanner}>
              <CheckCircle2 size={20} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} style={styles.dismissButton}>
                <X size={16} />
              </button>
            </div>
          )}

          {activeTab === "configure" && (
            <div style={styles.configureContent}>
              {/* Token Management Section */}
              <section style={styles.section}>
                <div style={styles.sectionHeader}>
                  <Key size={24} style={styles.sectionIcon} />
                  <div>
                    <h2 style={styles.sectionTitle}>API Tokens</h2>
                    <p style={styles.sectionDescription}>
                      Update your Slack app and bot tokens
                    </p>
                  </div>
                </div>

                <div style={styles.tokenStatus}>
                  <div style={styles.tokenStatusItem}>
                    <span style={styles.tokenLabel}>App Token:</span>
                    <span style={settings?.has_app_token ? styles.tokenConfigured : styles.tokenMissing}>
                      {settings?.has_app_token ? "✓ Configured" : "✗ Not configured"}
                    </span>
                  </div>
                  <div style={styles.tokenStatusItem}>
                    <span style={styles.tokenLabel}>Bot Token:</span>
                    <span style={settings?.has_bot_token ? styles.tokenConfigured : styles.tokenMissing}>
                      {settings?.has_bot_token ? "✓ Configured" : "✗ Not configured"}
                    </span>
                  </div>
                </div>

                <div style={styles.form}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>App Token (xapp-...)</label>
                    <div style={styles.passwordWrapper}>
                      <input
                        type={showAppToken ? "text" : "password"}
                        value={appToken}
                        onChange={(e) => setAppToken(e.target.value)}
                        placeholder="Leave empty to keep current"
                        style={styles.input}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppToken(!showAppToken)}
                        style={styles.eyeButton}
                      >
                        {showAppToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Bot Token (xoxb-...)</label>
                    <div style={styles.passwordWrapper}>
                      <input
                        type={showBotToken ? "text" : "password"}
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        placeholder="Leave empty to keep current"
                        style={styles.input}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBotToken(!showBotToken)}
                        style={styles.eyeButton}
                      >
                        {showBotToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateTokens}
                    disabled={saving || (!appToken && !botToken)}
                    style={{
                      ...styles.saveButton,
                      ...((!appToken && !botToken) ? styles.buttonDisabled : {}),
                    }}
                  >
                    {saving ? <Loader2 size={18} style={styles.spinner} /> : <Save size={18} />}
                    <span>Update Tokens</span>
                  </button>
                </div>
              </section>

              {/* Emoji Mappings Section */}
              <section style={styles.section}>
                <div style={styles.sectionHeader}>
                  <Smile size={24} style={styles.sectionIcon} />
                  <div>
                    <h2 style={styles.sectionTitle}>Emoji Mappings</h2>
                    <p style={styles.sectionDescription}>
                      Configure which emojis map to each task status
                    </p>
                  </div>
                </div>

                <div style={styles.mappingsGrid}>
                  {/* In Progress */}
                  <div style={styles.mappingCard}>
                    <h3 style={styles.mappingTitle}>
                      <span style={styles.statusDot} /> In Progress
                    </h3>
                    <div style={styles.emojiList}>
                      {emojiMappings.in_progress.map((emoji) => (
                        <div key={emoji} style={styles.emojiTag}>
                          <span>:{emoji}:</span>
                          <button
                            onClick={() => removeEmoji("in_progress", emoji)}
                            style={styles.removeEmojiButton}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={styles.addEmojiRow}>
                      <input
                        type="text"
                        value={newEmoji.in_progress}
                        onChange={(e) =>
                          setNewEmoji((prev) => ({ ...prev, in_progress: e.target.value }))
                        }
                        placeholder="emoji_name"
                        style={styles.emojiInput}
                        onKeyDown={(e) => e.key === "Enter" && addEmoji("in_progress")}
                      />
                      <button
                        onClick={() => addEmoji("in_progress")}
                        style={styles.addEmojiButton}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Blocked */}
                  <div style={styles.mappingCard}>
                    <h3 style={{ ...styles.mappingTitle, color: "#fb923c" }}>
                      <span style={{ ...styles.statusDot, background: "#fb923c" }} /> Blocked
                    </h3>
                    <div style={styles.emojiList}>
                      {emojiMappings.blocked.map((emoji) => (
                        <div key={emoji} style={{ ...styles.emojiTag, borderColor: "rgba(251, 146, 60, 0.3)" }}>
                          <span>:{emoji}:</span>
                          <button
                            onClick={() => removeEmoji("blocked", emoji)}
                            style={styles.removeEmojiButton}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={styles.addEmojiRow}>
                      <input
                        type="text"
                        value={newEmoji.blocked}
                        onChange={(e) =>
                          setNewEmoji((prev) => ({ ...prev, blocked: e.target.value }))
                        }
                        placeholder="emoji_name"
                        style={styles.emojiInput}
                        onKeyDown={(e) => e.key === "Enter" && addEmoji("blocked")}
                      />
                      <button
                        onClick={() => addEmoji("blocked")}
                        style={{ ...styles.addEmojiButton, background: "rgba(251, 146, 60, 0.2)" }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Completed */}
                  <div style={styles.mappingCard}>
                    <h3 style={{ ...styles.mappingTitle, color: "#34d399" }}>
                      <span style={{ ...styles.statusDot, background: "#34d399" }} /> Completed
                    </h3>
                    <div style={styles.emojiList}>
                      {emojiMappings.completed.map((emoji) => (
                        <div key={emoji} style={{ ...styles.emojiTag, borderColor: "rgba(52, 211, 153, 0.3)" }}>
                          <span>:{emoji}:</span>
                          <button
                            onClick={() => removeEmoji("completed", emoji)}
                            style={styles.removeEmojiButton}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={styles.addEmojiRow}>
                      <input
                        type="text"
                        value={newEmoji.completed}
                        onChange={(e) =>
                          setNewEmoji((prev) => ({ ...prev, completed: e.target.value }))
                        }
                        placeholder="emoji_name"
                        style={styles.emojiInput}
                        onKeyDown={(e) => e.key === "Enter" && addEmoji("completed")}
                      />
                      <button
                        onClick={() => addEmoji("completed")}
                        style={{ ...styles.addEmojiButton, background: "rgba(52, 211, 153, 0.2)" }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.mappingActions}>
                  <button onClick={handleResetMappings} disabled={saving} style={styles.resetButton}>
                    <RotateCcw size={18} />
                    <span>Reset to Defaults</span>
                  </button>
                  <button onClick={handleUpdateEmojiMappings} disabled={saving} style={styles.saveButton}>
                    {saving ? <Loader2 size={18} style={styles.spinner} /> : <Save size={18} />}
                    <span>Save Mappings</span>
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === "users" && (
            <div style={styles.usersContent}>
              <div style={styles.usersHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Workspace Users</h2>
                  <p style={styles.sectionDescription}>
                    Manage users who have access to this workspace
                  </p>
                </div>
                <button onClick={() => setShowInviteModal(true)} style={styles.inviteButton}>
                  <UserPlus size={18} />
                  <span>Invite User</span>
                </button>
              </div>

              {usersLoading ? (
                <div style={styles.usersLoading}>
                  <Loader2 size={32} style={styles.spinner} />
                  <p>Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div style={styles.emptyUsers}>
                  <Users size={48} style={{ opacity: 0.3 }} />
                  <h3>No users yet</h3>
                  <p>Invite team members to collaborate on this workspace</p>
                  <button onClick={() => setShowInviteModal(true)} style={styles.inviteButton}>
                    <UserPlus size={18} />
                    <span>Invite First User</span>
                  </button>
                </div>
              ) : (
                <>
                  <div style={styles.tableContainer}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Email</th>
                          <th style={styles.th}>Slack ID</th>
                          <th style={styles.th}>Joined</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.userName}>
                                <div style={styles.avatar}>
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span>{user.name}</span>
                                {user.is_active && (
                                  <span style={styles.activeBadge}>Active</span>
                                )}
                              </div>
                            </td>
                            <td style={styles.td}>{user.email}</td>
                            <td style={styles.td}>
                              <code style={styles.slackId}>{user.slack_member_id || "-"}</code>
                            </td>
                            <td style={styles.td}>
                              {new Date(user.linked_at).toLocaleDateString()}
                            </td>
                            <td style={styles.td}>
                              <button
                                onClick={() => handleRemoveUser(user.id, user.name)}
                                style={styles.removeButton}
                                title="Remove user"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {usersPagination.total_pages > 1 && (
                    <div style={styles.pagination}>
                      <button
                        onClick={() => setUsersPagination({ ...usersPagination, page: usersPagination.page - 1 })}
                        disabled={usersPagination.page === 0}
                        style={styles.paginationButton}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span style={styles.paginationInfo}>
                        Page {usersPagination.page + 1} of {usersPagination.total_pages}
                      </span>
                      <button
                        onClick={() => setUsersPagination({ ...usersPagination, page: usersPagination.page + 1 })}
                        disabled={usersPagination.page >= usersPagination.total_pages - 1}
                        style={styles.paginationButton}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div style={styles.modalOverlay} onClick={() => setShowInviteModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Invite User</h3>
              <button onClick={() => setShowInviteModal(false)} style={styles.modalClose}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.modalDescription}>
                Enter the email address of the person you want to invite. They must be a member of the Slack workspace.
              </p>

              {inviteError && (
                <div style={styles.modalError}>
                  <AlertCircle size={16} />
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
                <div style={styles.modalSuccess}>
                  <CheckCircle2 size={16} />
                  <span>{inviteSuccess}</span>
                </div>
              )}

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={styles.input}
                  onKeyDown={(e) => e.key === "Enter" && handleInviteUser()}
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowInviteModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={inviting || !inviteEmail.trim()}
                style={{
                  ...styles.inviteSubmitButton,
                  ...(!inviteEmail.trim() ? styles.buttonDisabled : {}),
                }}
              >
                {inviting ? (
                  <>
                    <Loader2 size={18} style={styles.spinner} />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>Invite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)",
    color: "var(--text-primary)",
    overflow: "hidden",
  },
  header: {
    padding: "1.5rem 2rem",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--column-bg)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "2rem",
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.25rem",
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
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    margin: 0,
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
  mainContent: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: "220px",
    borderRight: "1px solid var(--border-color)",
    background: "var(--card-bg)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    flexShrink: 0,
  },
  sidebarButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem 1rem",
    background: "transparent",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontSize: "0.9375rem",
    fontWeight: "500",
    transition: "all 0.2s",
    textAlign: "left" as const,
  },
  sidebarButtonActive: {
    background: "var(--accent-color)",
    color: "#ffffff",
  },
  userCount: {
    marginLeft: "auto",
    padding: "0.125rem 0.5rem",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "10px",
    fontSize: "0.75rem",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: "2rem",
    overflowY: "auto",
  },
  configureContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
    maxWidth: "800px",
  },
  usersContent: {
    maxWidth: "1000px",
  },
  usersHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
  },
  inviteButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1.25rem",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: "0.875rem",
    fontWeight: "600",
    boxShadow: "0 4px 12px var(--glow-blue)",
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
    marginBottom: "1.5rem",
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: "12px",
    color: "#34d399",
    marginBottom: "1.5rem",
  },
  dismissButton: {
    marginLeft: "auto",
    padding: "0.25rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "inherit",
    opacity: 0.7,
  },
  section: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "16px",
    padding: "1.5rem",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  sectionIcon: {
    color: "var(--accent-color)",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: "0 0 0.25rem 0",
  },
  sectionDescription: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
    margin: 0,
  },
  tokenStatus: {
    display: "flex",
    gap: "2rem",
    padding: "1rem",
    background: "var(--column-bg)",
    borderRadius: "10px",
    marginBottom: "1.5rem",
  },
  tokenStatusItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  tokenLabel: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
  },
  tokenConfigured: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#34d399",
  },
  tokenMissing: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#ef4444",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "var(--text-secondary)",
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    fontSize: "0.9375rem",
    background: "var(--column-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    color: "var(--text-primary)",
    outline: "none",
  },
  passwordWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  eyeButton: {
    padding: "0.75rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "var(--text-secondary)",
  },
  saveButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.875rem 1.5rem",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: "0.9375rem",
    fontWeight: "600",
    transition: "all 0.2s",
    marginTop: "0.5rem",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  resetButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.875rem 1.5rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    fontWeight: "600",
    transition: "all 0.2s",
  },
  mappingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  mappingCard: {
    background: "var(--column-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    padding: "1rem",
  },
  mappingTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.9375rem",
    fontWeight: "600",
    color: "var(--accent-color)",
    margin: "0 0 1rem 0",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--accent-color)",
  },
  emojiList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginBottom: "1rem",
    minHeight: "32px",
  },
  emojiTag: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.625rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "6px",
    fontSize: "0.8125rem",
    color: "var(--text-primary)",
  },
  removeEmojiButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--text-tertiary)",
    opacity: 0.7,
  },
  addEmojiRow: {
    display: "flex",
    gap: "0.5rem",
  },
  emojiInput: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    fontSize: "0.8125rem",
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    outline: "none",
  },
  addEmojiButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    background: "rgba(99, 102, 241, 0.2)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--accent-color)",
  },
  mappingActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "1rem",
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
  // Users table styles
  usersLoading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    color: "var(--text-secondary)",
    gap: "1rem",
  },
  emptyUsers: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    textAlign: "center" as const,
    color: "var(--text-secondary)",
    gap: "0.5rem",
  },
  tableContainer: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  th: {
    padding: "1rem",
    textAlign: "left" as const,
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--text-tertiary)",
    background: "var(--column-bg)",
    borderBottom: "1px solid var(--card-border)",
  },
  tr: {
    borderBottom: "1px solid var(--card-border)",
  },
  td: {
    padding: "1rem",
    fontSize: "0.9375rem",
    color: "var(--text-primary)",
  },
  userName: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "var(--gradient-blue)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: "0.875rem",
    fontWeight: "600",
  },
  activeBadge: {
    padding: "0.125rem 0.5rem",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: "4px",
    fontSize: "0.6875rem",
    fontWeight: "600",
    color: "#34d399",
    marginLeft: "0.5rem",
  },
  slackId: {
    padding: "0.25rem 0.5rem",
    background: "var(--column-bg)",
    borderRadius: "4px",
    fontSize: "0.8125rem",
    fontFamily: "monospace",
  },
  removeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    background: "transparent",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--text-tertiary)",
    transition: "all 0.2s",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "1rem",
  },
  paginationButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--text-primary)",
  },
  paginationInfo: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
  },
  // Modal styles
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  modal: {
    width: "100%",
    maxWidth: "480px",
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "16px",
    overflow: "hidden",
    animation: "fadeInUp 0.2s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid var(--card-border)",
  },
  modalTitle: {
    fontSize: "1.125rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: 0,
  },
  modalClose: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--text-tertiary)",
  },
  modalBody: {
    padding: "1.5rem",
  },
  modalDescription: {
    fontSize: "0.9375rem",
    color: "var(--text-secondary)",
    margin: "0 0 1.5rem 0",
    lineHeight: 1.6,
  },
  modalError: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    padding: "0.875rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "8px",
    color: "#ef4444",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  modalSuccess: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.875rem",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    borderRadius: "8px",
    color: "#34d399",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--card-border)",
    background: "var(--column-bg)",
  },
  cancelButton: {
    padding: "0.75rem 1.25rem",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    fontWeight: "600",
  },
  inviteSubmitButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1.25rem",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: "0.9375rem",
    fontWeight: "600",
  },
};
