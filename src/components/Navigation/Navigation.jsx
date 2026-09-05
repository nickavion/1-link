import { Link, useLocation, useNavigate } from 'react-router-dom'
import { auth } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import styles from './Navigation.module.css'

const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const handleSignOut = async () => {
    await auth.signOut()
    navigate('/events')
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <nav className={styles.nav}>
      <div className="container">
        <div className={styles.navContent}>
          <div className={styles.navBrand}>
            <Link to="/" className={styles.logo}>
              Overlap
            </Link>
          </div>

          <div className={styles.navLinks}>
            <Link 
              to="/events" 
              className={`${styles.navLink} ${isActive('/events') || isActive('/') ? styles.active : ''}`}
            >
              Discover
            </Link>
            {isAuthenticated && (
              <Link
                to="/preferences"
                className={`${styles.navLink} ${isActive('/preferences') ? styles.active : ''}`}
              >
                Preferences
              </Link>
            )}
          </div>

          <div className={styles.navActions}>
            {isAuthenticated ? (
              <>
                <Link to="/create" className="btn btn-primary">
                  Create Event
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="btn btn-ghost"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/auth" className="btn btn-primary">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
