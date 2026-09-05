import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout/Layout'
import EventsPage from './pages/EventsPage/EventsPage'
import CreateEventPage from './pages/CreateEventPage/CreateEventPage'
import EditEventPage from './pages/EditEventPage/EditEventPage'
import ImportCalendarPage from './pages/ImportCalendarPage/ImportCalendarPage'
import OnboardingPage from './pages/OnboardingPage/OnboardingPage'
import PreferencesPage from './pages/PreferencesPage/PreferencesPage'
import AuthCallback from './pages/AuthCallback/AuthCallback'
import Auth from './components/Auth/Auth'

/**
 * Anything under RequireAuth needs an account. Browsing does not: the RLS policy in
 * 0001 makes public events readable by the anon key, and a discovery site that
 * demands a signup before it shows you anything is a discovery site nobody discovers.
 */
const RequireAuth = ({ user, children }) => {
  const location = useLocation()
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />
  return children
}

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

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth" element={user ? <Navigate to="/events" replace /> : <Auth />} />

      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<EventsPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route
                path="/create"
                element={
                  <RequireAuth user={user}>
                    <CreateEventPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/events/:id/edit"
                element={
                  <RequireAuth user={user}>
                    <EditEventPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/import"
                element={
                  <RequireAuth user={user}>
                    <ImportCalendarPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth user={user}>
                    <OnboardingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/preferences"
                element={
                  <RequireAuth user={user}>
                    <PreferencesPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/events" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}

export default App
