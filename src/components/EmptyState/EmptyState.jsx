import styles from './EmptyState.module.css'

const EmptyState = ({ title, children, action }) => (
  <div className={styles.empty}>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>
)

export default EmptyState
