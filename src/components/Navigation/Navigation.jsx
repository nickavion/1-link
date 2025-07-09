import { Link, useLocation } from 'react-router-dom'
import { auth } from '../../utils/supabase'
import styles from './Navigation.module.css'

const Navigation = () => {
  const location = useLocation()

  const handleSignOut = async () => {
    await auth.signOut()
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
              Luma
            </Link>
          </div>

          <div className={styles.navLinks}>
            <Link 
              to="/events" 
              className={`${styles.navLink} ${isActive('/events') || isActive('/') ? styles.active : ''}`}
            >
              Events
            </Link>
            <Link 
              to="/calendars" 
              className={`${styles.navLink} ${isActive('/calendars') ? styles.active : ''}`}
            >
              Calendars
            </Link>
            <Link 
              to="/discover" 
              className={`${styles.navLink} ${isActive('/discover') ? styles.active : ''}`}
            >
              Discover
            </Link>
          </div>

          <div className={styles.navActions}>
            <Link to="/create" className="btn btn-primary">
              Create Event
            </Link>
            <button 
              onClick={handleSignOut}
              className="btn btn-ghost"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation