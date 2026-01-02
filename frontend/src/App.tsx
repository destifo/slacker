import { useEffect, useState } from 'react'
import { TaskBoard } from './components/TaskBoard'
import { LoginPage } from './components/LoginPage'
import { AuthCallback } from './components/AuthCallback'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Loader2 } from 'lucide-react'
import './App.css'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    // Listen for navigation changes
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Handle auth callback route
  if (currentPath === '/auth/callback') {
    return <AuthCallback />
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <Loader2 size={48} style={styles.spinner} />
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Show task board for authenticated users
  return <TaskBoard />
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    animation: 'fadeIn 0.3s ease',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    color: 'var(--accent-color)',
  },
  loadingText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
}

export default App
