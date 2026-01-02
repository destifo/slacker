import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Loader2 } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    login();
  };

  return (
    <div style={styles.container}>
      {/* Animated background */}
      <div style={styles.bgOrbs}>
        <div style={{ ...styles.orb, ...styles.orb1 }} />
        <div style={{ ...styles.orb, ...styles.orb2 }} />
        <div style={{ ...styles.orb, ...styles.orb3 }} />
      </div>

      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="48" height="48" rx="12" fill="url(#gradient)" />
              <path
                d="M14 18C14 16.8954 14.8954 16 16 16H32C33.1046 16 34 16.8954 34 18V20C34 21.1046 33.1046 22 32 22H16C14.8954 22 14 21.1046 14 20V18Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M14 26C14 24.8954 14.8954 24 16 24H28C29.1046 24 30 24.8954 30 26V28C30 29.1046 29.1046 30 28 30H16C14.8954 30 14 29.1046 14 28V26Z"
                fill="white"
                fillOpacity="0.7"
              />
              <path
                d="M14 34C14 32.8954 14.8954 32 16 32H24C25.1046 32 26 32.8954 26 34V36C26 37.1046 25.1046 38 24 38H16C14.8954 38 14 37.1046 14 36V34Z"
                fill="white"
                fillOpacity="0.5"
              />
              <defs>
                <linearGradient
                  id="gradient"
                  x1="0"
                  y1="0"
                  x2="48"
                  y2="48"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#667eea" />
                  <stop offset="1" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <h1 style={styles.title}>Welcome to Slacker</h1>
        <p style={styles.subtitle}>
          Turn your Slack messages into trackable tasks with emoji reactions
        </p>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            ...styles.googleButton,
            ...(isLoading ? styles.googleButtonDisabled : {}),
          }}
        >
          {isLoading ? (
            <Loader2 size={20} style={styles.spinner} />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>{isLoading ? "Redirecting..." : "Continue with Google"}</span>
        </button>

        <p style={styles.note}>
          Sign in with your Google account linked to Slack
        </p>
      </div>

      <footer style={styles.footer}>
        <p>
          Powered by <span style={styles.highlight}>Slack</span> reactions
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background:
      "linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)",
    position: "relative",
    overflow: "hidden",
  },
  bgOrbs: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  orb: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    opacity: 0.4,
    animation: "float 20s ease-in-out infinite",
  },
  orb1: {
    width: "400px",
    height: "400px",
    background: "var(--gradient-blue)",
    top: "-10%",
    left: "-10%",
    animationDelay: "0s",
  },
  orb2: {
    width: "300px",
    height: "300px",
    background: "var(--gradient-orange)",
    bottom: "-5%",
    right: "-5%",
    animationDelay: "-7s",
  },
  orb3: {
    width: "250px",
    height: "250px",
    background: "var(--gradient-green)",
    top: "50%",
    right: "20%",
    animationDelay: "-14s",
  },
  card: {
    background: "var(--card-bg)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--card-border)",
    borderRadius: "24px",
    padding: "3rem",
    maxWidth: "420px",
    width: "90%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
    boxShadow: "0 25px 50px -12px var(--shadow-color)",
    animation: "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    position: "relative",
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: "0.5rem",
    animation: "scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    filter: "drop-shadow(0 4px 12px var(--glow-blue))",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    margin: 0,
    textAlign: "center",
    animation: "fadeIn 0.5s ease 0.2s both",
  },
  subtitle: {
    fontSize: "0.9375rem",
    color: "var(--text-secondary)",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.6,
    animation: "fadeIn 0.5s ease 0.3s both",
  },
  googleButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.875rem 1.5rem",
    fontSize: "0.9375rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    background: "var(--button-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    animation: "fadeIn 0.5s ease 0.4s both",
  },
  googleButtonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  spinner: {
    animation: "spin 1s linear infinite",
    color: "var(--accent-color)",
  },
  note: {
    fontSize: "0.8125rem",
    color: "var(--text-tertiary)",
    margin: 0,
    textAlign: "center",
    animation: "fadeIn 0.5s ease 0.5s both",
  },
  footer: {
    position: "absolute",
    bottom: "2rem",
    fontSize: "0.8125rem",
    color: "var(--text-tertiary)",
    animation: "fadeIn 0.5s ease 0.6s both",
  },
  highlight: {
    color: "var(--accent-color)",
    fontWeight: "600",
  },
};

// Add animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes float {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    25% {
      transform: translate(10%, 10%) scale(1.05);
    }
    50% {
      transform: translate(5%, -5%) scale(0.95);
    }
    75% {
      transform: translate(-5%, 5%) scale(1.02);
    }
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  button:hover:not(:disabled) {
    background: var(--hover-bg) !important;
    border-color: var(--card-hover-border) !important;
    transform: translateY(-1px);
    box-shadow: 0 8px 25px var(--shadow-color);
  }
  
  button:active:not(:disabled) {
    transform: translateY(0);
  }
`;
document.head.appendChild(styleSheet);

