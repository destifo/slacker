import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "processing" | "success" | "error";

export function AuthCallback() {
  const { handleAuthCallback } = useAuth();
  const [status, setStatus] = useState<Status>("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const name = params.get("name");
    const email = params.get("email");

    if (token && name && email) {
      handleAuthCallback(token, decodeURIComponent(name), decodeURIComponent(email));
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setStatus("success");
        // Redirect to home after short delay
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }, 0);
    } else {
      setTimeout(() => {
        setStatus("error");
        setError("Missing authentication data. Please try again.");
      }, 0);
    }
  }, [handleAuthCallback]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === "processing" && (
          <>
            <div style={styles.iconWrapper}>
              <Loader2 size={48} style={styles.spinner} />
            </div>
            <h2 style={styles.title}>Signing you in...</h2>
            <p style={styles.subtitle}>Please wait while we complete authentication</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ ...styles.iconWrapper, ...styles.successIcon }}>
              <CheckCircle2 size={48} />
            </div>
            <h2 style={styles.title}>Welcome!</h2>
            <p style={styles.subtitle}>Redirecting to your dashboard...</p>
            <div style={styles.progressBar}>
              <div style={styles.progressFill} />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ ...styles.iconWrapper, ...styles.errorIcon }}>
              <XCircle size={48} />
            </div>
            <h2 style={styles.title}>Authentication Failed</h2>
            <p style={styles.subtitle}>{error}</p>
            <button
              onClick={() => (window.location.href = "/")}
              style={styles.retryButton}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background:
      "linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)",
  },
  card: {
    background: "var(--card-bg)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--card-border)",
    borderRadius: "24px",
    padding: "3rem",
    maxWidth: "400px",
    width: "90%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    boxShadow: "0 25px 50px -12px var(--shadow-color)",
    animation: "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  iconWrapper: {
    marginBottom: "0.5rem",
  },
  spinner: {
    animation: "spin 1s linear infinite",
    color: "var(--accent-color)",
  },
  successIcon: {
    color: "#34d399",
    animation: "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  errorIcon: {
    color: "#ef4444",
    animation: "shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    fontSize: "0.9375rem",
    color: "var(--text-secondary)",
    margin: 0,
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: "4px",
    background: "var(--button-bg)",
    borderRadius: "2px",
    overflow: "hidden",
    marginTop: "1rem",
  },
  progressFill: {
    height: "100%",
    background: "var(--gradient-green)",
    borderRadius: "2px",
    animation: "progressFill 1.5s ease-out forwards",
  },
  retryButton: {
    marginTop: "1rem",
    padding: "0.75rem 1.5rem",
    fontSize: "0.9375rem",
    fontWeight: "600",
    color: "#ffffff",
    background: "var(--gradient-blue)",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

// Add animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes progressFill {
    from {
      width: 0%;
    }
    to {
      width: 100%;
    }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(styleSheet);
