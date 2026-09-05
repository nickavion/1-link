import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TagPicker from '../../components/TagPicker/TagPicker'
import { useAuth } from '../../hooks/useAuth'
import { usePreferences } from '../../hooks/usePreferences'
import styles from './OnboardingPage.module.css'

/**
 * Post-signup step (section 6, step 2). Skippable by design: someone who is not out,
 * or who just wants to look around, should never have to type their identity into a
 * database to use the site.
 */
const OnboardingPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { preferenceTags, loading, save } = usePreferences(user)
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) setSelected(preferenceTags)
  }, [loading, preferenceTags])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const { error: saveError } = await save(selected)
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    navigate('/events')
  }

  return (
    <div className={styles.onboarding}>
      <div className={styles.steps} aria-hidden="true">
        <span className={`${styles.step} ${styles.done}`} />
        <span className={`${styles.step} ${styles.done}`} />
        <span className={styles.step} />
      </div>

      <div className="card">
        <h1 className={styles.title}>Who are you here for?</h1>
        <p className={styles.lead}>
          Pick anything that fits — or nothing at all. These tags <strong>reorder</strong> your
          feed, they never filter it, so you still see every public event either way.
        </p>
        <p className={styles.privacy}>
          Stored in a private row only you can read. Not shown on your profile, not visible to
          organisers, not used for ads.
        </p>

        <TagPicker
          groupKey="identity_tags"
          selected={selected}
          onChange={setSelected}
          showLabel={false}
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save and start browsing'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/events')}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingPage
