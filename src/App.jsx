import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout/Layout'
import EventsPage from './pages/EventsPage/EventsPage'
import CreateEventPage from './pages/CreateEventPage/CreateEventPage'
import AuthCallback from './pages/AuthCallback/AuthCallback'
import Auth from './components/Auth/Auth'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Handle auth callback route
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />
  }

  if (!user) {
    return <Auth />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/create" element={<CreateEventPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </Layout>
  )
}

export default App