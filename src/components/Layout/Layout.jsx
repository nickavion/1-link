import Navigation from '../Navigation/Navigation'
import styles from './Layout.module.css'

const Layout = ({ children }) => {
  return (
    <div className={styles.layout}>
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