import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[2];
  const Icon = currentTheme.icon;

  return (
    <div style={styles.container}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.button}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--hover-bg)';
          e.currentTarget.style.borderColor = 'var(--card-hover-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--button-bg)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        <Icon size={18} />
      </button>
      
      {isOpen && (
        <>
          <div 
            style={styles.backdrop} 
            onClick={() => setIsOpen(false)}
          />
          <div style={styles.menu}>
            {themes.map((t) => {
              const ThemeIcon = t.icon;
              const isActive = theme === t.value;
              
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setTheme(t.value);
                    setIsOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    background: isActive ? 'var(--active-bg)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <ThemeIcon size={16} />
                  <span>{t.label}</span>
                  {isActive && <span style={styles.checkmark}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px var(--shadow-color)',
    padding: '4px',
    minWidth: '140px',
    zIndex: 20,
    backdropFilter: 'blur(10px)',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  checkmark: {
    marginLeft: 'auto',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--accent-color)',
  },
};

