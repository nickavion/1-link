import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { events } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import styles from './CreateEventPage.module.css'

const CreateEventPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    isPublic: true,
    isFree: true,
    requiresApproval: false,
    capacity: '',
    theme: 'minimal'
  })

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!formData.title.trim()) {
      setError('Event title is required')
      setLoading(false)
      return
    }

    if (!formData.startDate || !formData.startTime) {
      setError('Start date and time are required')
      setLoading(false)
      return
    }

    if (!formData.endDate || !formData.endTime) {
      setError('End date and time are required')
      setLoading(false)
      return
    }

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)

      // Check if end time is after start time
      if (endDateTime <= startDateTime) {
        setError('End time must be after start time')
        setLoading(false)
        return
      }

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        location: formData.location.trim() || null,
        is_public: formData.isPublic,
        is_free: formData.isFree,
        requires_approval: formData.requiresApproval,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        theme: formData.theme,
        user_id: user.id
      }

      console.log('Creating event:', eventData)
      const { data, error } = await events.create(eventData)
      
      if (error) {
        console.error('Create event error:', error)
        setError(`Failed to create event: ${error.message}`)
      } else {
        console.log('Event created successfully:', data)
        navigate('/events')
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError(`Failed to create event: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.createEventPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Create Event</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formLayout}>
          <div className={styles.leftPanel}>
            <div className={`${styles.eventCover} ${styles[formData.theme]}`}>
              <div className={styles.geometricPattern}></div>
              {formData.title && (
                <div className={styles.eventNameOverlay}>
                  <h2>{formData.title}</h2>
                </div>
              )}
            </div>
            
            <div className={styles.themeSection}>
              <label className="form-label">Theme</label>
              <select
                name="theme"
                value={formData.theme}
                onChange={handleInputChange}
                className="form-input"
              >
                <option value="minimal">Minimal</option>
                <option value="colorful">Colorful</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.eventHeader}>
              <div className={styles.visibilityToggle}>
                <span>{formData.isPublic ? 'Public' : 'Private'}</span>
                <label className={`toggle-switch ${styles.toggleLabel}`}>
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`form-input ${styles.titleInput}`}
                placeholder="Event Name"
                required
              />
            </div>

            <div className={styles.dateTimeSection}>
              <div className={styles.dateTimeRow}>
                <span className={styles.dateLabel}>Start</span>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div className={styles.dateTimeRow}>
                <span className={styles.dateLabel}>End</span>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Add Event Location - Offline location or virtual link"
              />
            </div>

            <div className="form-group">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-input form-textarea"
                placeholder="Add Description"
                rows="4"
              />
            </div>

            <div className={styles.eventOptions}>
              <h3>Event Options</h3>
              
              <div className={styles.optionRow}>
                <span>Tickets</span>
                <div className={styles.optionControl}>
                  <label className={`toggle-switch ${styles.toggleLabel}`}>
                    <input
                      type="checkbox"
                      name="isFree"
                      checked={formData.isFree}
                      onChange={handleInputChange}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span>{formData.isFree ? 'Free' : 'Paid'}</span>
                </div>
              </div>

              <div className={styles.optionRow}>
                <span>Require Approval</span>
                <div className={styles.optionControl}>
                  <label className={`toggle-switch ${styles.toggleLabel}`}>
                    <input
                      type="checkbox"
                      name="requiresApproval"
                      checked={formData.requiresApproval}
                      onChange={handleInputChange}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className={styles.optionRow}>
                <span>Capacity</span>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Unlimited"
                  min="1"
                />
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={`btn btn-primary ${styles.createButton}`}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CreateEventPage