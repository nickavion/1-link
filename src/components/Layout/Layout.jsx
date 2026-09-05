import Navigation from '../Navigation/Navigation'
import { usingMockBackend } from '../../utils/config'
import styles from './Layout.module.css'

const Layout = ({ children }) => {
  return (
    <div className={styles.layout}>
      {usingMockBackend && (
        <div className={styles.mockBanner}>
          Demo mode — pretend database, nothing is saved. Add your Supabase keys to
          <code> .env</code> and run <code>npm run dev</code> for the real thing.
        </div>
      )}
      <Navigation />
      <main className={styles.main}>
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout