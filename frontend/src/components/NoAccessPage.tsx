import { ShieldX, Mail, LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';

interface NoAccessPageProps {
  email: string;
}

export function NoAccessPage({ email }: NoAccessPageProps) {
  const { logout } = useAuth();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <ThemeToggle />
      </div>

      <div style={styles.content}>
        <div style={styles.iconWrapper}>
          <ShieldX size={64} style={styles.icon} />
        </div>

        <h1 style={styles.title}>No Workspace Access</h1>

        <p style={styles.description}>
          You don't have access to any workspaces yet.
        </p>

        <div style={styles.emailCard}>
          <Mail size={20} style={styles.emailIcon} />
          <span style={styles.email}>{email}</span>
        </div>

        <p style={styles.hint}>
          Please contact your workspace administrator to get invited.
        </p>

        <button onClick={logout} style={styles.logoutButton}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
    padding: '2rem',
  },
  header: {
    position: 'absolute',
    top: '1.5rem',
    right: '1.5rem',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '400px',
  },
  iconWrapper: {
    marginBottom: '1.5rem',
    padding: '1.5rem',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '50%',
    border: '2px solid rgba(239, 68, 68, 0.2)',
  },
  icon: {
    color: '#ef4444',
    filter: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.4))',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
  },
  description: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: '1.5rem',
    lineHeight: '1.6',
  },
  emailCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1.25rem',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '0.75rem',
    marginBottom: '1.5rem',
  },
  emailIcon: {
    color: 'var(--text-tertiary)',
  },
  email: {
    fontSize: '0.9375rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  hint: {
    fontSize: '0.875rem',
    color: 'var(--text-tertiary)',
    marginBottom: '2rem',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'var(--button-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '0.5rem',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
