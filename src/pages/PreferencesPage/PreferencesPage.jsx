import { useEffect, useState } from 'react'
import TagPicker from '../../components/TagPicker/TagPicker'
import { useAuth } from '../../hooks/useAuth'
import { usePreferences } from '../../hooks/usePreferences'
import styles from './PreferencesPage.module.css'

const PreferencesPage = () => {
  const { user } = useAuth()
  const { preferenceTags, loading, save } = usePreferences(user)
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) setSelected(preferenceTags)
  }, [loading, preferenceTags])

  const handleSave = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    const { error: saveError } = await save(selected)
    setSaving(false)
    if (saveError) setError(saveError.message)
    else setStatus('Saved. Your feed will reorder next time you browse.')
  }

  return (
    <div className={styles.preferences}>
      <h1 className={styles.title}>Your preferences</h1>
      <p className={styles.subtitle}>Signed in as {user?.email}</p>

      <div className="card">
        <p className={styles.privacy}>
          These tags live in a private row keyed to your account. Row Level Security means the
          database itself refuses to hand them to anyone else — not other users, and not the
          organisers of events you RSVP to.
        </p>

        <TagPicker
          groupKey="identity_tags"
          selected={selected}
          onChange={setSelected}
          showLabel={false}
          showHint
        />

        {status && <div className={styles.status}>{status}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save preferences'}
          </button>
          {selected.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setSelected([])}>
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PreferencesPage
