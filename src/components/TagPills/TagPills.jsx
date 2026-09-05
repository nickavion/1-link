import { TAG_GROUPS, tagLabel } from '../../utils/tags'
import styles from './TagPills.module.css'

/**
 * Renders an event's tags with one row per group. `highlight` is the viewer's own
 * saved identity tags; matching pills get a dot so the overlap is visible without
 * having to compare two lists by eye.
 */
const TagPills = ({ event, highlight = [], groups = TAG_GROUPS }) => {
  const rows = groups
    .map((group) => [group, event[group.key] || []])
    .filter(([, values]) => values.length > 0)

  if (rows.length === 0) return null

  return (
    <div className={styles.pillGroups}>
      {rows.map(([group, values]) => (
        <div key={group.key} className={styles.pillRow}>
          {values.map((value) => {
            const matched = group.key === 'identity_tags' && highlight.includes(value)
            return (
              <span
                key={value}
                className={`${styles.pill} ${styles[group.tone]} ${matched ? styles.matched : ''}`}
                title={matched ? 'Matches your saved identity tags' : undefined}
              >
                {matched && <span className={styles.dot} aria-hidden="true" />}
                {tagLabel(group.key, value)}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default TagPills
