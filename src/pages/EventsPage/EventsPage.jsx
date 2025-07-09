import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { events } from '../../utils/supabase'
import EventCard from '../../components/EventCard/EventCard'
import styles from './EventsPage.module.css'

const EventsPage = () => {
  const [eventsList, setEventsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await events.getAll()
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
      }
    } catch (err) {
      console.error('Load events error:', err)
      setError('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div>Loading events...</div>
      </div>
    )
  }

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
        <h1 className={styles.title}>Events</h1>
        <Link to="/create" className="btn btn-primary">
          Create Event
        </Link>
      </div>

      {eventsList.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No Events</h2>
          <p>Create your first event to get started!</p>
          <Link to="/create" className="btn btn-primary">
            Create Event
          </Link>
        </div>
      ) : (
        <div className={styles.eventsGrid}>
          {eventsList.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

export default EventsPage