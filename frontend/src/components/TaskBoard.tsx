import { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, AlertCircle, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useAuth } from '../hooks/useAuth';

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

export function TaskBoard() {
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { person } = useAuth();

  useEffect(() => {
    fetchTasks();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get<TaskBoard>('/api/tasks/board');
      setBoard(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to fetch tasks. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

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
        <button onClick={fetchTasks} style={styles.retryButton}>
          <Zap size={16} />
          <span>Retry Connection</span>
        </button>
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleGroup}>
            <h1 style={styles.title}>Tasks</h1>
            <div style={styles.badge}>{totalTasks}</div>
          </div>
          <p style={styles.subtitle}>
            {person ? `${person.name}'s workspace` : 'Manage your work, fast'}
          </p>
        </div>
        <div style={styles.headerActions}>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <div style={styles.boardContainer}>
        <TaskColumn
          title="In Progress"
          tasks={board.in_progress}
          color="blue"
          icon={<Clock size={18} />}
        />
        <TaskColumn
          title="Blocked"
          tasks={board.blocked}
          color="orange"
          icon={<AlertCircle size={18} />}
        />
        <TaskColumn
          title="Completed"
          tasks={board.completed}
          color="green"
          icon={<CheckCircle2 size={18} />}
        />
      </div>
    </div>
  );
}

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  color: 'blue' | 'orange' | 'green';
  icon: React.ReactNode;
}

function TaskColumn({ title, tasks, color, icon }: TaskColumnProps) {
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
            <TaskCard key={task.id} task={task} color={colors} index={index} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, color, index }: { task: Task; color: { gradient: string; light: string; glow: string }; index: number }) {
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
    padding: '2rem 2rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    background: 'linear-gradient(180deg, var(--column-bg) 0%, transparent 100%)',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '2rem',
  },
  headerContent: {
    maxWidth: '1400px',
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
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
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  boardContainer: {
    display: 'flex',
    gap: '1.5rem',
    padding: '1.5rem 2rem 2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: '320px',
    height: '100%',
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
};

// Add CSS animations
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
`;
document.head.appendChild(styleSheet);

