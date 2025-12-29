import { TaskBoard } from './components/TaskBoard'
import { ThemeProvider } from './hooks/useTheme'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <TaskBoard />
    </ThemeProvider>
  )
}

export default App

