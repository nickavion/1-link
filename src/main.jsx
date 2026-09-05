import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import SetupNotice from './components/SetupNotice/SetupNotice'
import { isConfigured } from './utils/config'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfigured ? (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    ) : (
      <SetupNotice />
    )}
  </React.StrictMode>,
)
