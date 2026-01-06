import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ExternalLink, Clock, ArrowRight, Loader2, AlertCircle, CheckCircle2, Ban } from 'lucide-react';

interface MessageDetail {
  id: string;
  content: string;
  external_id: string;
  channel: string;
  timestamp: string;
  slack_link: string;
}

interface Change {
  id: string;
  old: string;
  new: string;
  index: number;
  task_id: string;
}

interface TaskDetail {
  id: string;
  status: string;
  assigned_to: string;
  created_at: string;
  message: MessageDetail;
  changes: Change[];
}

interface TaskModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  InProgress: { label: 'In Progress', color: '#818cf8', icon: <Clock size={14} /> },
  Blocked: { label: 'Blocked', color: '#fb923c', icon: <AlertCircle size={14} /> },
  Completed: { label: 'Completed', color: '#34d399', icon: <CheckCircle2 size={14} /> },
  Blank: { label: 'Unknown', color: '#6b7280', icon: <Ban size={14} /> },
};

export function TaskModal({ taskId, isOpen, onClose }: TaskModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetail();
    }
  }, [isOpen, taskId]);

  const fetchTaskDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<TaskDetail>(`/api/tasks/${taskId}`);
      setTask(response.data);
    } catch (err) {
      console.error('Failed to fetch task details:', err);
      setError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusStyle = (status: string) => {
    const config = statusConfig[status] || statusConfig.Blank;
    return {
      background: `${config.color}20`,
      color: config.color,
      border: `1px solid ${config.color}40`,
    };
  };

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Task Details</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div style={styles.loadingState}>
            <Loader2 size={32} style={styles.spinner} />
            <p>Loading task details...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorState}>
            <AlertCircle size={32} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && task && (
          <div style={styles.content}>
            {/* Status Badge */}
            <div style={styles.statusRow}>
              <span style={styles.label}>Status</span>
              <div style={{ ...styles.statusBadge, ...getStatusStyle(task.status) }}>
                {statusConfig[task.status]?.icon}
                <span>{statusConfig[task.status]?.label || task.status}</span>
              </div>
            </div>

            {/* Message Content */}
            <div style={styles.section}>
              <span style={styles.label}>Message</span>
              <div style={styles.messageBox}>
                <p style={styles.messageContent}>{task.message.content}</p>
              </div>
            </div>

            {/* Slack Link */}
            <div style={styles.section}>
              <span style={styles.label}>Slack Message</span>
              <a
                href={task.message.slack_link}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.slackLink}
              >
                <ExternalLink size={16} />
                <span>Open in Slack</span>
              </a>
            </div>

            {/* Created At */}
            <div style={styles.section}>
              <span style={styles.label}>Created</span>
              <span style={styles.value}>{formatDate(task.created_at)}</span>
            </div>

            {/* Change History */}
            <div style={styles.section}>
              <span style={styles.label}>Change History</span>
              {task.changes.length === 0 ? (
                <p style={styles.emptyHistory}>No status changes yet</p>
              ) : (
                <div style={styles.historyList}>
                  {task.changes
                    .sort((a, b) => a.index - b.index)
                    .map((change, idx) => (
                      <div key={change.id} style={styles.historyItem}>
                        <div style={styles.historyIndex}>{idx + 1}</div>
                        <div style={styles.historyContent}>
                          <div style={{ ...styles.historyStatus, ...getStatusStyle(change.old) }}>
                            {statusConfig[change.old]?.label || change.old}
                          </div>
                          <ArrowRight size={14} style={styles.historyArrow} />
                          <div style={{ ...styles.historyStatus, ...getStatusStyle(change.new) }}>
                            {statusConfig[change.new]?.label || change.new}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '540px',
    maxHeight: '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--column-bg)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'var(--button-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
  },
  content: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
  },
  messageBox: {
    background: 'var(--column-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem',
  },
  messageContent: {
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  slackLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '600',
    width: 'fit-content',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--glow-blue)',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  historyIndex: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--button-bg)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  historyContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
  },
  historyStatus: {
    padding: '0.25rem 0.625rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  historyArrow: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  emptyHistory: {
    fontSize: '0.875rem',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    margin: 0,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    background: 'var(--button-bg)',
    padding: '0.375rem 0.75rem',
    borderRadius: '6px',
    wordBreak: 'break-all',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
    color: 'var(--text-secondary)',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    color: 'var(--accent-color)',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
    color: '#ef4444',
  },
};

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;
document.head.appendChild(styleSheet);

