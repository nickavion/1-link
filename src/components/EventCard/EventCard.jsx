import { format } from 'date-fns'
import styles from './EventCard.module.css'

const EventCard = ({ event }) => {
  const formatDate = (dateString) => {
    return format(new Date(dateString), 'EEE, d MMM')
  }

  const formatTime = (dateString) => {
    return format(new Date(dateString), 'h:mm a')
  }

  return (
    <div className={styles.eventCard}>
      <div className={styles.eventImage}>
        <div className={styles.eventCover}>
          <div className={styles.geometricPattern}></div>
        </div>
      </div>
      
      <div className={styles.eventContent}>
        <div className={styles.eventHeader}>
          <h3 className={styles.eventTitle}>{event.title}</h3>
          <div className={styles.eventVisibility}>
            <span className={`${styles.badge} ${event.is_public ? styles.public : styles.private}`}>
              {event.is_public ? 'Public' : 'Private'}
            </span>
          </div>
        </div>
        
        <div className={styles.eventDetails}>
          <div className={styles.eventTime}>
            <span className={styles.label}>Start</span>
            <span className={styles.value}>
              {formatDate(event.start_date)} {formatTime(event.start_date)}
            </span>
          </div>
          
          <div className={styles.eventTime}>
            <span className={styles.label}>End</span>
            <span className={styles.value}>
              {formatDate(event.end_date)} {formatTime(event.end_date)}
            </span>
          </div>
          
          {event.location && (
            <div className={styles.eventLocation}>
              <span className={styles.label}>Location</span>
              <span className={styles.value}>{event.location}</span>
            </div>
          )}
        </div>
        
        {event.description && (
          <div className={styles.eventDescription}>
            <p>{event.description}</p>
          </div>
        )}
        
        <div className={styles.eventMeta}>
          <div className={styles.eventOptions}>
            <span className={styles.metaItem}>
              {event.is_free ? 'Free' : 'Paid'}
            </span>
            <span className={styles.metaItem}>
              {event.capacity || 'Unlimited'} capacity
            </span>
            {event.requires_approval && (
              <span className={styles.metaItem}>Requires approval</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventCard