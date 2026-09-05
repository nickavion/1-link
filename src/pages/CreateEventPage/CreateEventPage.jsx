import { useNavigate, useLocation } from 'react-router-dom'
import { events } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import EventForm from '../../components/EventForm/EventForm'
import styles from './CreateEventPage.module.css'

const CreateEventPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // The calendar-import review screen sends someone here, prefilled, when it can't
  // validate a row on its own (an overlong title, an all-day event with no time) —
  // rather than building a second form just for fixing up one row at a time.
  const prefill = location.state?.prefill

  const handleSubmit = async (payload) => {
    const { error } = await events.create({ ...payload, user_id: user.id })
    if (error) throw new Error(error.message)
    navigate('/events')
  }

  return (
    <div className={styles.createEventPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Create Event</h1>
        {prefill && <p className={styles.subtitle}>Picked up from your calendar import — check it over and publish.</p>}
      </div>

      <EventForm initialValues={prefill} onSubmit={handleSubmit} submitLabel="Create Event" busyLabel="Creating..." />
    </div>
  )
}

export default CreateEventPage
