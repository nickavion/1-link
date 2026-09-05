import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractImportableEvents, MAX_EVENTS_PER_IMPORT } from '../../utils/icsImport.mjs'
import { eventSchema } from '../../utils/validation'
import { events } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import TagPicker from '../../components/TagPicker/TagPicker'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './ImportCalendarPage.module.css'

const EMPTY_TAGS = { identity_tags: [], event_type_tags: [], vibe_tags: [] }

/** Same shape EventForm's own formData is in — reusing eventSchema here means an
 * imported row is held to exactly the same bar as one typed in by hand, with the
 * same error messages, and a validation-rule change never needs to be made twice. */
function toFormShape(row, { bulkTags, isPublic }) {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    startDate: row.startDate,
    startTime: row.startTime,
    endDate: row.endDate,
    endTime: row.endTime,
    capacity: '',
    coverImageUrl: '',
    isPublic,
    requiresApproval: false,
    theme: 'minimal',
    ...bulkTags
  }
}

function groupBySeries(rows) {
  const order = []
  const byUid = new Map()
  for (const row of rows) {
    if (!byUid.has(row.uid)) {
      byUid.set(row.uid, [])
      order.push(row.uid)
    }
    byUid.get(row.uid).push(row)
  }
  return order.map((uid) => byUid.get(uid))
}

function formatSeriesDates(occurrences) {
  const preview = occurrences
    .slice(0, 3)
    .map((o) => new Date(`${o.startDate}T${o.startTime || '00:00'}`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    .join(', ')
  return occurrences.length > 3 ? `${preview}, +${occurrences.length - 3} more` : preview
}

const ImportCalendarPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInput = useRef(null)

  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsed, setParsed] = useState(null) // { rows, truncatedCount, cancelledCount, calendarName }
  const [myEvents, setMyEvents] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [bulkTags, setBulkTags] = useState(EMPTY_TAGS)
  const [isPublic, setIsPublic] = useState(false)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null) // { imported, failed }

  useEffect(() => {
    // useAuth() is a plain hook, not a context — this call site starts with user
    // null and resolves its own session check asynchronously, even though the
    // RequireAuth route guard already confirmed one exists. Wait for it rather
    // than reading .id off null.
    if (!user) return
    events.getMine(user.id).then(({ data }) => setMyEvents(data || []))
  }, [user])

  const series = useMemo(() => (parsed ? groupBySeries(parsed.rows) : []), [parsed])

  const evaluated = useMemo(() => {
    const existingKeys = new Set(myEvents.map((e) => `${e.title.trim().toLowerCase()}|${e.start_date.slice(0, 10)}`))

    return series.map((occurrences) => {
      const first = occurrences[0]
      const formValues = toFormShape(first, { bulkTags, isPublic })
      const result = eventSchema.safeParse(formValues)
      const isDuplicate = existingKeys.has(`${first.title.trim().toLowerCase()}|${first.startDate}`)
      return {
        uid: first.uid,
        title: first.title,
        location: first.location,
        occurrences,
        isAllDay: first.isAllDay,
        isDuplicate,
        valid: result.success,
        firstError: result.success ? null : Object.values(result.error.flatten().fieldErrors)[0]?.[0] || 'Needs review.'
      }
    })
  }, [series, bulkTags, isPublic, myEvents])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    setSummary(null)
    setFileName(file.name)

    try {
      const text = await file.text()
      const result = extractImportableEvents(text)
      setParsed(result)
      // Auto-select everything that's valid and doesn't look like something already
      // on the account — re-importing the same calendar twice shouldn't quietly
      // double up events unless someone deliberately opts back in.
      const autoSelected = new Set()
      const existingKeys = new Set(myEvents.map((ev) => `${ev.title.trim().toLowerCase()}|${ev.start_date.slice(0, 10)}`))
      for (const group of groupBySeries(result.rows)) {
        const first = group[0]
        const key = `${first.title.trim().toLowerCase()}|${first.startDate}`
        if (!existingKeys.has(key)) autoSelected.add(first.uid)
      }
      setSelected(autoSelected)
    } catch (err) {
      setParsed(null)
      setParseError(err.message)
    }
  }

  const toggleSeries = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const selectableCount = evaluated.filter((s) => s.valid).length
  const selectedValidCount = evaluated.filter((s) => s.valid && selected.has(s.uid)).length
  const totalOccurrencesSelected = evaluated
    .filter((s) => s.valid && selected.has(s.uid))
    .reduce((sum, s) => sum + s.occurrences.length, 0)

  const selectAllValid = () => setSelected(new Set(evaluated.filter((s) => s.valid).map((s) => s.uid)))
  const selectNone = () => setSelected(new Set())

  const handleImport = async () => {
    setImporting(true)
    let imported = 0
    let failed = 0

    for (const group of evaluated) {
      if (!group.valid || !selected.has(group.uid)) continue
      for (const row of group.occurrences) {
        const formValues = toFormShape(row, { bulkTags, isPublic })
        const parsedRow = eventSchema.safeParse(formValues)
        if (!parsedRow.success) {
          failed += 1
          continue
        }
        const values = parsedRow.data
        const { error } = await events.create({
          title: values.title,
          description: values.description || null,
          start_date: new Date(`${values.startDate}T${values.startTime}`).toISOString(),
          end_date: new Date(`${values.endDate}T${values.endTime}`).toISOString(),
          location: values.location || null,
          is_public: isPublic,
          is_free: !values.vibe_tags.includes('ticketed'),
          requires_approval: false,
          capacity: null,
          theme: 'minimal',
          cover_image_url: null,
          identity_tags: values.identity_tags,
          event_type_tags: values.event_type_tags,
          vibe_tags: values.vibe_tags,
          user_id: user.id
        })
        if (error) failed += 1
        else imported += 1
      }
    }

    setImporting(false)
    setSummary({ imported, failed })
    if (imported > 0 && failed === 0) {
      navigate('/events')
    }
  }

  const openInEditor = (group) => {
    const first = group.occurrences[0]
    navigate('/create', { state: { prefill: toFormShape(first, { bulkTags, isPublic }) } })
  }

  return (
    <div className={styles.importPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Import from Google Calendar</h1>
        <p className={styles.subtitle}>
          In Google Calendar: Settings → Import &amp; export → Export, then upload the .ics file it downloads.
          Nothing is sent anywhere — the file is read in your browser and only what you choose to import gets
          saved.
        </p>
      </div>

      <div className="card">
        <input
          ref={fileInput}
          type="file"
          accept=".ics,text/calendar"
          onChange={handleFile}
          className={styles.fileInput}
          id="ics-upload"
        />
        <label htmlFor="ics-upload" className="btn btn-primary">
          Choose .ics file
        </label>
        {fileName && <span className={styles.fileName}>{fileName}</span>}

        {parseError && <div className={styles.error}>{parseError}</div>}
      </div>

      {parsed && (
        <>
          <div className={styles.summaryBar}>
            <span>
              {parsed.calendarName && <strong>{parsed.calendarName}</strong>} — {series.length}{' '}
              {series.length === 1 ? 'event' : 'events'} found
              {parsed.cancelledCount > 0 && `, ${parsed.cancelledCount} cancelled skipped`}
              {parsed.truncatedCount > 0 && `, ${parsed.truncatedCount} left out (over the ${MAX_EVENTS_PER_IMPORT} limit)`}
            </span>
          </div>

          <div className="card">
            <h2 className={styles.sectionTitle}>Apply to everything you import</h2>
            <p className={styles.hint}>
              Google Calendar has no idea about these tags — you&rsquo;re the one who knows who this is for.
            </p>
            <TagPicker
              groupKey="identity_tags"
              selected={bulkTags.identity_tags}
              onChange={(v) => setBulkTags((prev) => ({ ...prev, identity_tags: v }))}
              showHint
            />
            <TagPicker
              groupKey="event_type_tags"
              selected={bulkTags.event_type_tags}
              onChange={(v) => setBulkTags((prev) => ({ ...prev, event_type_tags: v }))}
              showHint
            />
            <TagPicker
              groupKey="vibe_tags"
              selected={bulkTags.vibe_tags}
              onChange={(v) => setBulkTags((prev) => ({ ...prev, vibe_tags: v }))}
              showHint
            />

            <div className={styles.visibilityRow}>
              <div>
                <strong>{isPublic ? 'Public' : 'Unlisted'}</strong>
                <p className={styles.hint} style={{ marginBottom: 0 }}>
                  {isPublic
                    ? 'Listed on the public feed as soon as it imports.'
                    : 'Only visible to you until you publish each one — the safer default for a personal calendar.'}
                </p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className={styles.listHeader}>
            <span>
              {selectedValidCount} of {selectableCount} ready to import
              {totalOccurrencesSelected !== selectedValidCount && ` (${totalOccurrencesSelected} dates total)`}
            </span>
            <div className={styles.listActions}>
              <button type="button" className="btn btn-ghost" onClick={selectAllValid}>
                Select all ready
              </button>
              <button type="button" className="btn btn-ghost" onClick={selectNone}>
                Select none
              </button>
            </div>
          </div>

          <div className={styles.rows}>
            {evaluated.map((group) => (
              <div key={group.uid} className={styles.row}>
                <label className={styles.rowCheckbox}>
                  <input
                    type="checkbox"
                    disabled={!group.valid}
                    checked={group.valid && selected.has(group.uid)}
                    onChange={() => toggleSeries(group.uid)}
                  />
                </label>

                <div className={styles.rowBody}>
                  <div className={styles.rowTitleLine}>
                    <span className={styles.rowTitle}>{group.title || '(untitled)'}</span>
                    {group.occurrences.length > 1 && (
                      <span className={styles.pill}>{group.occurrences.length} dates</span>
                    )}
                    {group.isAllDay && <span className={styles.pill}>All-day</span>}
                    {group.isDuplicate && <span className={styles.pillWarn}>Possible duplicate</span>}
                  </div>
                  <div className={styles.rowMeta}>
                    {formatSeriesDates(group.occurrences)}
                    {group.location && ` · ${group.location}`}
                  </div>
                  {!group.valid && (
                    <div className={styles.rowError}>
                      {group.firstError}{' '}
                      <button type="button" className={styles.fixLink} onClick={() => openInEditor(group)}>
                        Fix in the full form →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {summary && (
            <div className={summary.failed ? styles.error : styles.success}>
              Imported {summary.imported} event{summary.imported === 1 ? '' : 's'}.
              {summary.failed > 0 && ` ${summary.failed} couldn\u2019t be saved — try again or fix them individually.`}
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || selectedValidCount === 0}
            >
              {importing
                ? 'Importing...'
                : `Import ${totalOccurrencesSelected || ''} event${totalOccurrencesSelected === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {!parsed && !parseError && (
        <EmptyState title="No file chosen yet">Pick a .ics export to see what&rsquo;s in it before anything is saved.</EmptyState>
      )}
    </div>
  )
}

export default ImportCalendarPage
