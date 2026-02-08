import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Clock, AlertCircle, CheckCircle2, Loader2, Zap, Slack, Plus, Sparkles, RefreshCw, Users, User } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { TaskModal } from './TaskModal';
import { NoAccessPage } from './NoAccessPage';
import { useAuth } from '../hooks/useAuth';

interface PermissionCheck {
  can_configure_workspaces: boolean;
  is_super_admin: boolean;
  has_workspace_access: boolean;
}

interface Message {
  id: string;
  content: string;
  external_id: string;
}

interface Task {
  id: string;
  status: 'InProgress' | 'Blocked' | 'Completed';
  assigned_to: string;
  created_at: string;
  message: Message;
}

interface TaskBoard {
  in_progress: Task[];
  blocked: Task[];
  completed: Task[];
}

interface WorkspaceStatus {
  is_syncing: boolean;
  sync_progress: string | null;
}

export function TaskBoard() {
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [hasWorkspaces, setHasWorkspaces] = useState<boolean | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<WorkspaceStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInitiated, setShowInitiated] = useState(false);
  const [permissions, setPermissions] = useState<PermissionCheck | null>(null);
  const { activeEmail, person } = useAuth();

  const fetchTasks = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const response = await axios.get<TaskBoard>('/api/tasks/board', {
        params: { initiated: showInitiated || undefined }
      });
      setBoard(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to fetch tasks. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showInitiated]);

  const checkPermissions = useCallback(async () => {
    try {
      const response = await axios.get<PermissionCheck>('/api/admins/permissions');
      setPermissions(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to check permissions:', err);
      return null;
    }
  }, []);

  const checkWorkspaces = useCallback(async () => {
    try {
      // First check permissions
      const perms = await checkPermissions();

      const response = await axios.get<{ workspaces: { is_active: boolean; is_syncing: boolean; sync_progress: string | null; is_linked: boolean }[] }>('/api/workspaces');
      const workspaces = response.data.workspaces;

      // Check if user has any linked workspaces
      const linkedWorkspaces = workspaces?.filter(w => w.is_linked) || [];
      const hasLinkedWorkspaces = linkedWorkspaces.length > 0;

      // User has access if they have linked workspaces OR can configure workspaces
      const hasAccess = hasLinkedWorkspaces || (perms?.can_configure_workspaces ?? false);
      setHasWorkspaces(hasAccess ? (workspaces && workspaces.length > 0) : false);

      // Check if active workspace is syncing
      const activeWs = workspaces?.find((w) => w.is_active);
      if (activeWs) {
        setSyncStatus({
          is_syncing: activeWs.is_syncing,
          sync_progress: activeWs.sync_progress,
        });
      }

      if (!hasAccess || !workspaces || workspaces.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to check workspaces:', err);
      setHasWorkspaces(false);
      setLoading(false);
    }
  }, [checkPermissions]);

  // Initial load
  useEffect(() => {
    checkWorkspaces();
  }, [checkWorkspaces]);

  // Fetch tasks once when workspaces are available
  useEffect(() => {
    if (hasWorkspaces === true) {
      fetchTasks();
    }
  }, [hasWorkspaces, fetchTasks]);

  // Poll while tab is visible so reaction-driven updates appear without manual refresh.
  // Use faster polling during initial sync and slower polling afterward.
  useEffect(() => {
    if (!activeEmail || hasWorkspaces !== true) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const pollEveryMs = syncStatus?.is_syncing ? 3000 : 8000;

    const startPolling = () => {
      if (document.visibilityState === 'visible') {
        interval = setInterval(() => {
          if (syncStatus?.is_syncing) {
            checkWorkspaces();
          }
          fetchTasks();
        }, pollEveryMs);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Immediate fetch when tab becomes visible
        if (syncStatus?.is_syncing) {
          checkWorkspaces();
        }
        fetchTasks();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeEmail, hasWorkspaces, syncStatus?.is_syncing, checkWorkspaces, fetchTasks]);

  // Refetch when account switches, workspace changes, or view mode changes
  useEffect(() => {
    if (activeEmail) {
      fetchTasks();
    }
  }, [activeEmail, activeWorkspace, showInitiated, fetchTasks]);

  const handleRefresh = useCallback(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinnerWrapper}>
          <Loader2 size={48} style={styles.spinner} />
        </div>
        <p style={styles.loadingText}>Loading workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>
          <AlertCircle size={48} />
        </div>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchTasks()} style={styles.retryButton}>
          <Zap size={16} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Show no access page if user has no workspace access and cannot configure
  if (hasWorkspaces === false && permissions && !permissions.can_configure_workspaces && !permissions.has_workspace_access) {
    return <NoAccessPage email={person?.email || ''} />;
  }

  // Show welcome screen when no workspaces are configured (for admins)
  if (hasWorkspaces === false) {
    return (
      <div style={styles.welcomeContainer}>
        <div style={styles.welcomeContent}>
          <div style={styles.welcomeIconWrapper}>
            <Slack size={64} style={styles.welcomeIcon} />
            <div style={styles.sparkleWrapper}>
              <Sparkles size={24} style={styles.sparkleIcon} />
            </div>
          </div>
          <h1 style={styles.welcomeTitle}>Welcome to Slacker</h1>
          <p style={styles.welcomeSubtitle}>
            Turn your Slack reactions into a beautiful task board.
            <br />
            Get started by connecting your first workspace.
          </p>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/setup');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={styles.setupButton}
          >
            <Plus size={20} />
            <span>Configure Your First Workspace</span>
          </button>
          <p style={styles.welcomeHint}>
            You'll need your Slack app tokens to get started
          </p>
        </div>
        <div style={styles.welcomeHeader}>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div style={styles.loadingContainer}>
        <p>No tasks found</p>
      </div>
    );
  }

  const totalTasks = board.in_progress.length + board.blocked.length + board.completed.length;

  const handleWorkspaceChange = (workspaceName: string | null) => {
    setActiveWorkspace(workspaceName);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseModal = () => {
    setSelectedTaskId(null);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerContent}>
            <div style={styles.workspaceTitle}>
              {activeWorkspace ? (
                <>
                  <span style={styles.workspaceName}>{activeWorkspace}</span>
                </>
              ) : (
                <span style={styles.workspaceLabel}>Select a workspace</span>
              )}
            </div>
            <div style={styles.tasksInfo}>
              <span style={styles.tasksLabel}>{showInitiated ? 'Initiated' : 'Assigned'}</span>
              <div style={styles.badge}>{totalTasks}</div>
            </div>
          </div>
          <div style={styles.headerActions}>
            <div className="view-toggle" style={styles.viewToggle}>
              <button
                onClick={() => setShowInitiated(false)}
                style={{
                  ...styles.toggleButton,
                  ...(showInitiated ? {} : styles.toggleButtonActive),
                }}
                title="Tasks assigned to me"
              >
                <User size={16} />
                <span className="toggle-label">My Tasks</span>
              </button>
              <button
                onClick={() => setShowInitiated(true)}
                style={{
                  ...styles.toggleButton,
                  ...(showInitiated ? styles.toggleButtonActive : {}),
                }}
                title="Tasks I initiated"
              >
                <Users size={16} />
                <span className="toggle-label">Initiated</span>
              </button>
            </div>
            <WorkspaceSwitcher onWorkspaceChange={handleWorkspaceChange} />
            <button
              onClick={() => handleRefresh()}
              disabled={isRefreshing}
              style={styles.refreshButton}
              title="Refresh tasks"
            >
              <RefreshCw size={18} style={isRefreshing ? styles.spinning : undefined} />
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Syncing Banner */}
      {syncStatus?.is_syncing && (
        <div style={styles.syncingBanner}>
          <Loader2 size={18} style={styles.syncSpinner} />
          <span style={styles.syncingText}>
            Loading your data... {syncStatus.sync_progress || ''}
          </span>
        </div>
      )}

      <div style={styles.boardContainer}>
        <TaskColumn
          title="In Progress"
          tasks={board.in_progress}
          color="blue"
          icon={<Clock size={18} />}
          onTaskClick={handleTaskClick}
        />
        <TaskColumn
          title="Blocked"
          tasks={board.blocked}
          color="orange"
          icon={<AlertCircle size={18} />}
          onTaskClick={handleTaskClick}
        />
        <TaskColumn
          title="Completed"
          tasks={board.completed}
          color="green"
          icon={<CheckCircle2 size={18} />}
          onTaskClick={handleTaskClick}
        />
      </div>

      <TaskModal
        taskId={selectedTaskId || ''}
        isOpen={!!selectedTaskId}
        onClose={handleCloseModal}
      />
    </div>
  );
}

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  color: 'blue' | 'orange' | 'green';
  icon: React.ReactNode;
  onTaskClick: (taskId: string) => void;
}

function TaskColumn({ title, tasks, color, icon, onTaskClick }: TaskColumnProps) {
  const colorStyles = {
    blue: {
      gradient: 'var(--gradient-blue)',
      light: '#818cf8',
      glow: 'var(--glow-blue)',
    },
    orange: {
      gradient: 'var(--gradient-orange)',
      light: '#fb923c',
      glow: 'var(--glow-orange)',
    },
    green: {
      gradient: 'var(--gradient-green)',
      light: '#34d399',
      glow: 'var(--glow-green)',
    },
  };

  const colors = colorStyles[color];

  return (
    <div style={styles.column}>
      <div style={styles.columnHeader}>
        <div style={styles.columnTitleRow}>
          <div style={{ ...styles.iconWrapper, background: colors.gradient }}>
            {icon}
          </div>
          <h2 style={styles.columnTitle}>{title}</h2>
          <span style={styles.count}>{tasks.length}</span>
        </div>
      </div>
      <div style={styles.columnContent}>
        {tasks.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>—</div>
            <p style={styles.emptyText}>No tasks yet</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <TaskCard key={task.id} task={task} color={colors} index={index} onClick={() => onTaskClick(task.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, color, index, onClick }: { task: Task; color: { gradient: string; light: string; glow: string }; index: number; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedDate = new Date(task.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cardStyle = {
    ...styles.card,
    animation: `fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
    ...(isHovered ? {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 30px ${color.glow}, 0 0 0 1px ${color.light}`,
      borderColor: color.light,
    } : {}),
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <div style={{ ...styles.statusDot, background: color.gradient }} />
        <span style={styles.cardId} title={task.id}>
          {task.id.slice(0, 8)}
        </span>
      </div>
      <p style={styles.cardContent}>{task.message.content}</p>
      <div style={styles.cardFooter}>
        <span style={styles.cardDate}>{formattedDate}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid var(--border-color)',
    background: 'linear-gradient(180deg, var(--column-bg) 0%, transparent 100%)',
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  syncingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(90deg, rgba(129, 140, 248, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
    borderBottom: '1px solid rgba(129, 140, 248, 0.2)',
    flexShrink: 0,
  },
  syncSpinner: {
    animation: 'spin 1s linear infinite',
    color: '#818cf8',
  },
  syncingText: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#818cf8',
  },
  headerContent: {
    flex: 1,
    textAlign: 'left',
    minWidth: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  viewToggle: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--button-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '10px',
    padding: '4px',
    gap: '2px',
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    fontSize: '0.8125rem',
    fontWeight: '500',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  toggleButtonActive: {
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    boxShadow: '0 2px 8px var(--glow-blue)',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'var(--button-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  spinning: {
    animation: 'spin 1s linear infinite',
  },
  workspaceTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  workspaceLabel: {
    color: 'var(--text-secondary)',
  },
  workspaceName: {
    color: 'var(--accent-color)',
  },
  tasksInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  tasksLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-tertiary)',
    fontWeight: '500',
  },
  badge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: '600',
    background: 'var(--button-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
  },
  boardContainer: {
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    flex: 1,
    overflow: 'auto',
    flexWrap: 'wrap',
  },
  column: {
    flex: '1 1 300px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '280px',
    maxHeight: '100%',
  },
  columnHeader: {
    padding: '1rem',
    borderRadius: '0.75rem 0.75rem 0 0',
    background: 'var(--column-bg)',
    border: '1px solid var(--border-color)',
    borderBottom: 'none',
    flexShrink: 0,
  },
  columnTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  iconWrapper: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    boxShadow: '0 4px 12px var(--shadow-color)',
  },
  columnTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
    flex: 1,
  },
  count: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
    padding: '0.25rem 0.5rem',
    background: 'var(--button-bg)',
    borderRadius: '4px',
  },
  columnContent: {
    flex: 1,
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderTop: 'none',
    borderRadius: '0 0 0.75rem 0.75rem',
    padding: '1rem',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
    gap: '1rem',
  },
  emptyIcon: {
    fontSize: '3rem',
    color: 'var(--empty-icon-color)',
    fontWeight: '200',
  },
  emptyText: {
    color: 'var(--empty-text-color)',
    fontSize: '0.875rem',
    margin: 0,
  },
  card: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '0.75rem',
    padding: '1rem',
    marginBottom: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    boxShadow: '0 0 8px currentColor',
  },
  cardId: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  cardContent: {
    fontSize: '0.9375rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
    lineHeight: '1.6',
    margin: '0 0 0.75rem 0',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    fontWeight: '500',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    gap: '1.5rem',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
  },
  spinnerWrapper: {
    position: 'relative' as const,
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    color: 'var(--accent-color)',
    filter: 'drop-shadow(0 0 8px var(--glow-blue))',
  },
  loadingText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    margin: 0,
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    gap: '1.5rem',
    padding: '2rem',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
  },
  errorIcon: {
    color: '#ef4444',
    filter: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.5))',
  },
  errorText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    maxWidth: '500px',
    margin: 0,
  },
  retryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--glow-blue)',
  },
  welcomeContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
    position: 'relative' as const,
  },
  welcomeHeader: {
    position: 'absolute' as const,
    top: '1.5rem',
    right: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  welcomeContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center' as const,
    padding: '2rem',
    maxWidth: '500px',
  },
  welcomeIconWrapper: {
    position: 'relative' as const,
    marginBottom: '2rem',
  },
  welcomeIcon: {
    color: 'var(--accent-color)',
    filter: 'drop-shadow(0 0 20px var(--glow-blue))',
  },
  sparkleWrapper: {
    position: 'absolute' as const,
    top: '-8px',
    right: '-12px',
  },
  sparkleIcon: {
    color: '#fbbf24',
    filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))',
    animation: 'pulse 2s ease-in-out infinite',
  },
  welcomeTitle: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-color) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  welcomeSubtitle: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.8',
    marginBottom: '2.5rem',
  },
  setupButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    padding: '1rem 2rem',
    borderRadius: '0.75rem',
    border: 'none',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 8px 32px var(--glow-blue)',
  },
  welcomeHint: {
    marginTop: '1.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-tertiary)',
  },
};

// Add CSS animations and responsive styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Toggle label visibility on larger screens */
  .toggle-label {
    display: none;
  }

  @media (min-width: 768px) {
    .toggle-label {
      display: inline;
    }
  }

  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .view-toggle {
      order: -1;
      width: 100%;
      justify-content: center;
    }
  }
`;
document.head.appendChild(styleSheet);
