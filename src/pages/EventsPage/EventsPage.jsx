import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { events } from '../../utils/supabase'
import { EMPTY_FILTERS } from '../../utils/tags'
import { rankEvents } from '../../utils/ranking'
import { useAuth } from '../../hooks/useAuth'
import { usePreferences } from '../../hooks/usePreferences'
import EventCard from '../../components/EventCard/EventCard'
import FilterBar from '../../components/FilterBar/FilterBar'
import styles from './EventsPage.module.css'

const EventsPage = () => {
  const { user, isAuthenticated } = useAuth()
  const { preferenceTags, hasPreferences } = usePreferences(user)

  const [eventsList, setEventsList] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await events.getAll({ filters, search })
      if (error) {
        // Only show error if it's not a "table doesn't exist" error
        if (error.code !== 'PGRST116' && !error.message.includes('relation "events" does not exist')) {
          setError(error.message)
        } else {
          // If table doesn't exist, just show empty state
          setEventsList([])
        }
      } else {
        setEventsList(data || [])
        setError('')
      }
    } catch (err) {
      console.error('Load events error:', err)
      setError('Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [filters, search])

  // Debounced so typing in the search box doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(loadEvents, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [loadEvents, search])

  // Preferences reorder the feed; they never remove anything from it.
  const ranked = useMemo(() => rankEvents(eventsList, preferenceTags), [eventsList, preferenceTags])

  if (error) {
    return (
      <div className={styles.error}>
        <div>Error: {error}</div>
        <button onClick={loadEvents} className="btn btn-primary">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className={styles.eventsPage}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Discover</h1>
          <p className={styles.subtitle}>
            Events tagged by who they are for, what they are, and what to expect at the door.
          </p>
        </div>
        {isAuthenticated ? (
          <Link to="/create" className="btn btn-primary">
            Create Event
          </Link>
        ) : (
          <Link to="/auth" className="btn btn-primary">
            Sign in to host
          </Link>
        )}
      </div>

      {isAuthenticated && !hasPreferences && (
        <div className={styles.onboardingPrompt}>
          <span>
            Tell us which communities you are here for and matching events move to the top of
            this feed. Nothing is ever hidden, and nobody else sees your tags.
          </span>
          <Link to="/onboarding" className="btn btn-secondary">
            Personalise my feed
          </Link>
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        search={search}
        onSearchChange={setSearch}
        resultCount={ranked.length}
        loading={loading}
      />

      {hasPreferences && preferenceTags.length > 0 && (
        <p className={styles.sortNote}>
          Sorted around your saved tags. Everything still shows up — matches just come first.
        </p>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div>Loading events...</div>
        </div>
      ) : ranked.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No events match</h2>
          <p>Try widening the tags, or host the event you were looking for.</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setSearch('')
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.eventsGrid}>
          {ranked.map((event) => (
            <EventCard key={event.id} event={event} highlight={preferenceTags} currentUserId={user?.id} />
          ))}
        </div>
      )}
    </div>
  )
}

export default EventsPage
