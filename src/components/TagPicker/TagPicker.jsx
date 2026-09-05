import { TAG_GROUPS } from '../../utils/tags'
import styles from './TagPicker.module.css'

/**
 * Multi-select chip row for one tag group. Shared by the filter bar, the onboarding
 * step and the event form, so a tag looks and behaves identically everywhere.
 */
const TagPicker = ({
  groupKey,
  selected = [],
  onChange,
  showLabel = true,
  showHint = false,
  error = ''
}) => {
  const group = TAG_GROUPS.find((entry) => entry.key === groupKey)
  if (!group) return null

  const toggle = (value) => {
    onChange(
      selected.includes(value) ? selected.filter((tag) => tag !== value) : [...selected, value]
    )
  }

  return (
    <div className={styles.group}>
      {showLabel && (
        <span className={styles.groupLabel} id={`${groupKey}-label`}>
          {group.label}
        </span>
      )}
      {showHint && <span className={styles.hint}>{group.hint}</span>}

      <div
        className={styles.chips}
        role="group"
        aria-labelledby={showLabel ? `${groupKey}-label` : undefined}
      >
        {group.tags.map((tag) => (
          <button
            key={tag.value}
            type="button"
            className={`${styles.chip} ${styles[group.tone]}`}
            aria-pressed={selected.includes(tag.value)}
            onClick={() => toggle(tag.value)}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}

export default TagPicker
