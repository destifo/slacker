import { useState } from 'react';
import axios from 'axios';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const MANIFEST_URL = '/slack-app-manifest.yaml';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [appToken, setAppToken] = useState('');
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totalSteps = 4;

  const copyManifest = async () => {
    try {
      const response = await fetch(MANIFEST_URL);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open in new tab
      window.open(MANIFEST_URL, '_blank');
    }
  };

  const validateTokens = () => {
    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return false;
    }
    if (!appToken.startsWith('xapp-')) {
      setError('App token should start with "xapp-"');
      return false;
    }
    if (!botToken.startsWith('xoxb-')) {
      setError('Bot token should start with "xoxb-"');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateTokens()) return;

    setSaving(true);
    setError(null);

    try {
      await axios.post('/api/workspaces/setup', {
        workspace_name: workspaceName.toLowerCase().replace(/\s+/g, '-'),
        app_token: appToken.trim(),
        bot_token: botToken.trim(),
      });
      setStep(5); // Success step
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to save workspace configuration');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIcon}>
              <Sparkles size={32} />
            </div>
            <h2 style={styles.stepTitle}>Create Your Slack App</h2>
            <p style={styles.stepDescription}>
              First, we'll create a Slack app using a pre-configured manifest.
              This sets up all the permissions automatically.
            </p>

            <div style={styles.instructions}>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>1</span>
                <span>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" style={styles.link}>api.slack.com/apps <ExternalLink size={14} /></a></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>2</span>
                <span>Click <strong>"Create New App"</strong> → <strong>"From an app manifest"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>3</span>
                <span>Select your workspace</span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>4</span>
                <span>Paste the manifest below and click Create</span>
              </div>
            </div>

            <button onClick={copyManifest} style={styles.copyButton}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? 'Copied!' : 'Copy Manifest'}</span>
            </button>
          </div>
        );

      case 2:
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIcon}>
              <span style={styles.stepIconText}>🔑</span>
            </div>
            <h2 style={styles.stepTitle}>Get Your App Token</h2>
            <p style={styles.stepDescription}>
              The app token enables real-time communication with Slack via Socket Mode.
            </p>

            <div style={styles.instructions}>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>1</span>
                <span>In your Slack app, go to <strong>"Basic Information"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>2</span>
                <span>Scroll to <strong>"App-Level Tokens"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>3</span>
                <span>Click <strong>"Generate Token and Scopes"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>4</span>
                <span>Name it anything (e.g., "socket-mode")</span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>5</span>
                <span>Add scope: <code style={styles.code}>connections:write</code></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>6</span>
                <span>Click <strong>"Generate"</strong> and copy the token</span>
              </div>
            </div>

            <div style={styles.tokenNote}>
              <AlertCircle size={16} />
              <span>Token starts with <code style={styles.code}>xapp-</code></span>
            </div>
          </div>
        );

      case 3:
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIcon}>
              <span style={styles.stepIconText}>🤖</span>
            </div>
            <h2 style={styles.stepTitle}>Get Your Bot Token</h2>
            <p style={styles.stepDescription}>
              The bot token allows the app to read messages and reactions.
            </p>

            <div style={styles.instructions}>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>1</span>
                <span>In your Slack app, go to <strong>"OAuth & Permissions"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>2</span>
                <span>If not installed, click <strong>"Install to Workspace"</strong></span>
              </div>
              <div style={styles.instructionItem}>
                <span style={styles.instructionNumber}>3</span>
                <span>Copy the <strong>"Bot User OAuth Token"</strong></span>
              </div>
            </div>

            <div style={styles.tokenNote}>
              <AlertCircle size={16} />
              <span>Token starts with <code style={styles.code}>xoxb-</code></span>
            </div>
          </div>
        );

      case 4:
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIcon}>
              <span style={styles.stepIconText}>⚙️</span>
            </div>
            <h2 style={styles.stepTitle}>Configure Your Workspace</h2>
            <p style={styles.stepDescription}>
              Enter your tokens to connect Slacker to your Slack workspace.
            </p>

            {error && (
              <div style={styles.errorBanner}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., my-company"
                  style={styles.input}
                />
                <span style={styles.inputHint}>A friendly name for this workspace</span>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>App Token</label>
                <input
                  type="password"
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  placeholder="xapp-..."
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-..."
                  style={styles.input}
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div style={styles.stepContent}>
            <div style={{ ...styles.stepIcon, ...styles.successIcon }}>
              <CheckCircle2 size={48} />
            </div>
            <h2 style={styles.stepTitle}>Setup Complete!</h2>
            <p style={styles.stepDescription}>
              Your Slack workspace has been configured successfully.
              The bot will start listening for reactions.
            </p>

            <div style={styles.successInfo}>
              <h3 style={styles.successSubtitle}>How to use:</h3>
              <ul style={styles.usageList}>
                <li>React to any message with 🏃 to mark as <strong>In Progress</strong></li>
                <li>React with 🚫 to mark as <strong>Blocked</strong></li>
                <li>React with ✅ to mark as <strong>Completed</strong></li>
              </ul>
            </div>

            <button onClick={onComplete} style={styles.completeButton}>
              <span>Go to Dashboard</span>
              <ChevronRight size={18} />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.wizard}>
        {/* Progress indicator */}
        {step <= totalSteps && (
          <div style={styles.progress}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} style={styles.progressStep}>
                <div
                  style={{
                    ...styles.progressDot,
                    ...(s <= step ? styles.progressDotActive : {}),
                    ...(s < step ? styles.progressDotComplete : {}),
                  }}
                >
                  {s < step ? <Check size={14} /> : s}
                </div>
                {s < 4 && (
                  <div
                    style={{
                      ...styles.progressLine,
                      ...(s < step ? styles.progressLineActive : {}),
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Navigation */}
        {step <= totalSteps && (
          <div style={styles.navigation}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={styles.backButton}>
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>
            )}

            <div style={styles.navSpacer} />

            {step < totalSteps && (
              <button onClick={() => setStep(step + 1)} style={styles.nextButton}>
                <span>Next</span>
                <ChevronRight size={18} />
              </button>
            )}

            {step === totalSteps && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...styles.nextButton,
                  ...styles.saveButton,
                  ...(saving ? styles.buttonDisabled : {}),
                }}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} style={styles.spinner} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Connect</span>
                    <Check size={18} />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '2rem',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
    overflowY: 'auto',
  },
  wizard: {
    width: '100%',
    maxWidth: '600px',
    maxHeight: 'calc(100vh - 4rem)',
    overflowY: 'auto',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '24px',
    padding: '2rem',
    boxShadow: '0 25px 50px -12px var(--shadow-color)',
    margin: 'auto 0',
  },
  progress: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  progressStep: {
    display: 'flex',
    alignItems: 'center',
  },
  progressDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--button-bg)',
    border: '2px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
    transition: 'all 0.3s ease',
  },
  progressDotActive: {
    borderColor: 'var(--accent-color)',
    color: 'var(--accent-color)',
  },
  progressDotComplete: {
    background: 'var(--accent-color)',
    borderColor: 'var(--accent-color)',
    color: '#ffffff',
  },
  progressLine: {
    width: '60px',
    height: '2px',
    background: 'var(--border-color)',
    margin: '0 0.5rem',
    transition: 'all 0.3s ease',
  },
  progressLineActive: {
    background: 'var(--accent-color)',
  },
  stepContent: {
    textAlign: 'center',
    padding: '1rem 0',
  },
  stepIcon: {
    marginBottom: '1.5rem',
    color: 'var(--accent-color)',
  },
  stepIconText: {
    fontSize: '3rem',
  },
  successIcon: {
    color: '#34d399',
  },
  stepTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.75rem 0',
  },
  stepDescription: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    margin: '0 0 1.5rem 0',
    lineHeight: 1.6,
  },
  instructions: {
    textAlign: 'left',
    background: 'var(--column-bg)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  instructionItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  instructionNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--accent-color)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  link: {
    color: 'var(--accent-color)',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  code: {
    background: 'var(--button-bg)',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--glow-blue)',
  },
  tokenNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    background: 'rgba(129, 140, 248, 0.1)',
    border: '1px solid rgba(129, 140, 248, 0.3)',
    borderRadius: '8px',
    color: 'var(--accent-color)',
    fontSize: '0.875rem',
  },
  form: {
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  input: {
    padding: '0.875rem 1rem',
    background: 'var(--column-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all 0.2s',
  },
  inputHint: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    textAlign: 'left',
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid var(--border-color)',
  },
  navSpacer: {
    flex: 1,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.75rem 1rem',
    background: 'var(--button-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  nextButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.75rem 1.25rem',
    background: 'var(--gradient-blue)',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--glow-blue)',
  },
  saveButton: {
    background: 'var(--gradient-green)',
    boxShadow: '0 4px 12px var(--glow-green)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  successInfo: {
    textAlign: 'left',
    background: 'var(--column-bg)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  successSubtitle: {
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 0.75rem 0',
  },
  usageList: {
    margin: 0,
    paddingLeft: '1.25rem',
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
  },
  completeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 1.5rem',
    background: 'var(--gradient-blue)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--glow-blue)',
  },
};
