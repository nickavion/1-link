import { useRef, useState } from 'react'
import { storage } from '../../utils/supabase'
import { eventSchema, fieldErrors } from '../../utils/validation'
import { useAuth } from '../../hooks/useAuth'
import TagPicker from '../TagPicker/TagPicker'
import styles from './EventForm.module.css'

const BLANK = {
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  location: '',
  isPublic: true,
  requiresApproval: false,
  capacity: '',
  theme: 'minimal',
  coverImageUrl: '',
  identity_tags: [],
  event_type_tags: [],
  vibe_tags: []
}

/**
 * The event fields form, shared by CreateEventPage and EditEventPage (and reused by
 * the calendar import flow to let someone fix up a row the bulk importer couldn't
 * validate on its own — see ImportCalendarPage).
 *
 * `initialValues` is already in form shape (separate startDate/startTime strings,
 * not an ISO timestamp) — the caller is responsible for converting a database row
 * into that shape, since Create has nothing to convert from and Edit does.
 *
 * Deliberately does NOT decide create-vs-update or navigate anywhere: it validates,
 * builds the database payload, and hands it to `onSubmit`. The caller owns what
 * happens to that payload.
 */
const EventForm = ({ initialValues, onSubmit, submitLabel, busyLabel }) => {
  const { user } = useAuth()
  const fileInput = useRef(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({ ...BLANK, ...initialValues })

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleTagChange = (groupKey, values) => {
    setFormData((prev) => ({ ...prev, [groupKey]: values }))
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const { data, error: uploadError } = await storage.uploadCoverImage(file, user.id)
    if (uploadError) {
      setError(uploadError.message)
    } else {
      setFormData((prev) => ({ ...prev, coverImageUrl: data }))
    }

    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const parsed = eventSchema.safeParse(formData)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      setError('Some fields need a second look.')
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const values = parsed.data
      const startDateTime = new Date(`${values.startDate}T${values.startTime}`)
      const endDateTime = new Date(`${values.endDate}T${values.endTime}`)

      const payload = {
        title: values.title,
        description: values.description || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        location: values.location || null,
        is_public: formData.isPublic,
        // One control, two columns: the "Ticketed" vibe tag is what people filter on,
        // so is_free follows it rather than being a second toggle that can disagree.
        is_free: !values.vibe_tags.includes('ticketed'),
        requires_approval: formData.requiresApproval,
        capacity: values.capacity === '' || values.capacity == null ? null : Number(values.capacity),
        theme: formData.theme,
        cover_image_url: values.coverImageUrl || null,
        identity_tags: values.identity_tags,
        event_type_tags: values.event_type_tags,
        vibe_tags: values.vibe_tags
      }

      await onSubmit(payload)
    } catch (err) {
      console.error('Submit error:', err)
      setError(`Failed to save event: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.formLayout}>
        <div className={styles.leftPanel}>
          <div className={`${styles.eventCover} ${styles[formData.theme]}`}>
            {formData.coverImageUrl ? (
              <img src={formData.coverImageUrl} alt="" className={styles.coverPreview} />
            ) : (
              <div className={styles.geometricPattern}></div>
            )}
            {formData.title && !formData.coverImageUrl && (
              <div className={styles.eventNameOverlay}>
                <h2>{formData.title}</h2>
              </div>
            )}
          </div>

          <div className={styles.coverSection}>
            <label className="form-label">Cover image</label>
            <input
              ref={fileInput}
              id="cover-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleImageSelect}
              className={styles.fileInput}
            />
            <div className={styles.coverActions}>
              <label htmlFor="cover-upload" className="btn btn-secondary">
                {uploading ? 'Uploading...' : 'Upload image'}
              </label>
              {formData.coverImageUrl && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setFormData((prev) => ({ ...prev, coverImageUrl: '' }))}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              type="url"
              name="coverImageUrl"
              value={formData.coverImageUrl}
              onChange={handleInputChange}
              className="form-input"
              placeholder="...or paste an image URL"
            />
            {errors.coverImageUrl && <div className={styles.fieldError}>{errors.coverImageUrl}</div>}
            <p className={styles.hint}>JPEG, PNG, WebP or AVIF, up to 5 MB.</p>
          </div>

          <div className={styles.themeSection}>
            <label className="form-label">Theme</label>
            <select name="theme" value={formData.theme} onChange={handleInputChange} className="form-input">
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
              maxLength={120}
            />
            {errors.title && <div className={styles.fieldError}>{errors.title}</div>}
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
              />
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>
            {(errors.startDate || errors.startTime) && (
              <div className={styles.fieldError}>{errors.startDate || errors.startTime}</div>
            )}

            <div className={styles.dateTimeRow}>
              <span className={styles.dateLabel}>End</span>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className="form-input"
              />
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>
            {(errors.endDate || errors.endTime) && (
              <div className={styles.fieldError}>{errors.endDate || errors.endTime}</div>
            )}
          </div>

          <div className="form-group">
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Add Event Location - Offline location or virtual link"
              maxLength={200}
            />
            {errors.location && <div className={styles.fieldError}>{errors.location}</div>}
          </div>

          <div className="form-group">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="form-input form-textarea"
              placeholder="Add Description - who it's for, and what the door is like"
              rows="4"
              maxLength={4000}
            />
            <div className={styles.charCount}>{formData.description.length} / 4000</div>
            {errors.description && <div className={styles.fieldError}>{errors.description}</div>}
          </div>

          <div className={styles.tagSection}>
            <h3>Tags</h3>
            <p className={styles.hint}>
              How people find this event. Identity, type and vibe are filtered separately.
            </p>
            <TagPicker
              groupKey="identity_tags"
              selected={formData.identity_tags}
              onChange={(values) => handleTagChange('identity_tags', values)}
              showHint
            />
            <TagPicker
              groupKey="event_type_tags"
              selected={formData.event_type_tags}
              onChange={(values) => handleTagChange('event_type_tags', values)}
              showHint
              error={errors.event_type_tags}
            />
            <TagPicker
              groupKey="vibe_tags"
              selected={formData.vibe_tags}
              onChange={(values) => handleTagChange('vibe_tags', values)}
              showHint
            />
          </div>

          <div className={styles.eventOptions}>
            <h3>Event Options</h3>

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
            {errors.capacity && <div className={styles.fieldError}>{errors.capacity}</div>}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={`btn btn-primary ${styles.submitButton}`} disabled={loading || uploading}>
            {loading ? busyLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

export default EventForm
