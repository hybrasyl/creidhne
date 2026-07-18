import { createRoot } from 'react-dom/client'
import './assets/main.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { installRendererErrorForwarding } from './reportErrors'

// Forward uncaught renderer errors / rejections to main for scrubbed logging.
installRendererErrorForwarding()

// Zustand needs no provider — the store is a module singleton. The ErrorBoundary
// wraps the app so a render crash shows a Report-Issue fallback instead of a white
// screen.
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
