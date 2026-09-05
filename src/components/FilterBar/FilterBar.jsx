import { EMPTY_FILTERS, TAG_GROUPS } from '../../utils/tags'
import TagPicker from '../TagPicker/TagPicker'
import styles from './FilterBar.module.css'

const FilterBar = ({ filters, onChange, search, onSearchChange, resultCount, loading }) => {
  const activeCount = TAG_GROUPS.reduce(
    (total, group) => total + (filters[group.key]?.length || 0),
    0
  )

  return (
    <section className={styles.filters} aria-label="Filter events">
      <input
        type="search"
        className={`form-input ${styles.search}`}
        placeholder="Search by name or place..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search events"
      />

      {TAG_GROUPS.map((group) => (
        <TagPicker
          key={group.key}
          groupKey={group.key}
          selected={filters[group.key] || []}
          onChange={(next) => onChange({ ...filters, [group.key]: next })}
        />
      ))}

      <div className={styles.footer}>
        <span aria-live="polite">
          {loading
            ? 'Loading events...'
            : `${resultCount} ${resultCount === 1 ? 'event' : 'events'}${
                activeCount ? ` · ${activeCount} filters on` : ''
              }`}
        </span>
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}

export default FilterBar
