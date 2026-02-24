import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CalendarPollingProvider } from './context/CalendarPollingContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CalendarPollingProvider>
          <App />
        </CalendarPollingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
