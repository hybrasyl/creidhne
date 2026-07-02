import { createRoot } from 'react-dom/client'
import './assets/main.css'
import App from './App'

// Zustand needs no provider — the store is a module singleton.
createRoot(document.getElementById('root')).render(<App />)
