import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { events } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import EventForm from '../../components/EventForm/EventForm'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './EditEventPage.module.css'

const pad = (n) => String(n).padStart(2, '0')

/** Splits a stored ISO timestamp back into the separate date/time strings the form
 * inputs use. This reads the local wall-clock of whoever's browser is doing the
 * editing — the same assumption the create form already makes when it submits. */
function isoToFormFields(iso) {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function eventToFormValues(event) {
  const start = isoToFormFields(event.start_date)
  const end = isoToFormFields(event.end_date)
  return {
    title: event.title,
    description: event.description || '',
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    location: event.location || '',
    isPublic: event.is_public,
    requiresApproval: event.requires_approval,
    capacity: event.capacity ?? '',
    theme: event.theme || 'minimal',
    coverImageUrl: event.cover_image_url || '',
    identity_tags: event.identity_tags,
    event_type_tags: event.event_type_tags,
    vibe_tags: event.vibe_tags
  }
}

const EditEventPage = () => {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true

    // useAuth() is a plain hook, not a context — this call site starts with user
    // null and resolves its own session check asynchronously, even though the
    // RequireAuth route guard already confirmed one exists. Wait for it rather
    // than reading .id off null.
    if (!user) return () => {}

    events.getById(id).then(({ data, error }) => {
      if (!active) return
      // RLS already hides other people's private events at the query level; this
      // check catches the "public, but someone else's" case the database is happy
      // to hand back — editing is owner-only even though reading isn't.
      if (error || !data || data.user_id !== user.id) {
        setNotFound(true)
      } else {
        setEvent(data)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id, user])

  const handleSubmit = async (payload) => {
    const { error } = await events.update(id, payload)
    if (error) throw new Error(error.message)
    navigate('/events')
  }

  if (loading) {
    return (
      <div className={styles.editEventPage}>
        <div>Loading...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.editEventPage}>
        <EmptyState title="Can't edit this one">
          Either it doesn&rsquo;t exist any more, or it isn&rsquo;t yours to edit.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className={styles.editEventPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Edit Event</h1>
      </div>

      <EventForm
        initialValues={eventToFormValues(event)}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        busyLabel="Saving..."
      />
    </div>
  )
}

export default EditEventPage
