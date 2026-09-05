/**
 * Turns a Google Calendar .ics export into rows this app can review and import.
 *
 * This is intentionally a pure, framework-free module — it takes text in and returns
 * plain objects out — so it can be tested with a plain Node script (see
 * scripts/test-ics-import.mjs) instead of needing a browser or a test runner.
 *
 * What it does NOT do: decide tags, decide public/private, or write to the database.
 * ICS has no concept of any of that — those are supplied by the person reviewing the
 * import, in ImportCalendarPage.
 */
import ICAL from 'ical.js'

export const MAX_EVENTS_PER_IMPORT = 500

// A recurring event with no end date would expand forever. Cap it the same way a
// calendar app's UI would: a bounded time window, not a bounded "keep going".
export const RECURRENCE_WINDOW_MONTHS = 6
export const RECURRENCE_MAX_OCCURRENCES_PER_SERIES = 26

const pad = (n) => String(n).padStart(2, '0')

/**
 * ICAL.Time -> the separate 'YYYY-MM-DD' / 'HH:MM' strings the event form's date and
 * time inputs use.
 *
 * Deliberately reads the wall-clock fields (.year/.month/.day/.hour/.minute) rather
 * than going through .toJSDate(). toJSDate() converts to an absolute instant and a
 * native Date's getters then read it back in *this machine's* local timezone — so a
 * server or CI box running in UTC would silently turn "7:00 PM America/Chicago" into
 * a different clock time. The event form has no timezone field at all: it treats
 * whatever date/time strings it's given as the organizer's own local wall-clock. The
 * only way to round-trip that correctly is to hand it the wall-clock the calendar
 * itself declared, unconverted.
 */
function splitIcalTime(icalTime) {
  const date = `${icalTime.year}-${pad(icalTime.month)}-${pad(icalTime.day)}`
  const time = icalTime.isDate ? '' : `${pad(icalTime.hour)}:${pad(icalTime.minute)}`
  return { date, time }
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Registers every VTIMEZONE the file defines before any event is read, so a DTSTART
 * with a TZID (e.g. "America/Chicago") converts to the right wall-clock time instead
 * of silently being treated as floating/UTC. Google always includes the VTIMEZONE
 * blocks its events reference, so this is normally all that's needed — no separate
 * timezone database to ship.
 */
function registerTimezones(component) {
  for (const vtimezone of component.getAllSubcomponents('vtimezone')) {
    try {
      const timezone = new ICAL.Timezone({
        component: vtimezone,
        tzid: vtimezone.getFirstPropertyValue('tzid')
      })
      ICAL.TimezoneService.register(timezone.tzid, timezone)
    } catch {
      // A malformed VTIMEZONE block shouldn't take down the whole import; the
      // events that reference it fall back to floating time, which is still
      // usable, just possibly off by a few hours — the review screen is where
      // that gets caught, not here.
    }
  }
}

/** ical.js's Time#addDuration mutates in place and returns undefined, not the
 * mutated object — so it can't be chained off .clone(). This makes that safe to chain. */
function cloneWithDuration(icalTime, duration) {
  const clone = icalTime.clone()
  clone.addDuration(duration)
  return clone
}

function isCancelled(icalEvent) {
  const status = icalEvent.component.getFirstPropertyValue('status')
  return typeof status === 'string' && status.toUpperCase() === 'CANCELLED'
}

function toRow({ icalEvent, occurrenceStart, occurrenceEnd, seriesId, occurrenceIndex, occurrenceCount }) {
  const start = splitIcalTime(occurrenceStart)
  const end = splitIcalTime(occurrenceEnd)
  const isAllDay = Boolean(occurrenceStart.isDate)

  return {
    // Client-side identity for React keys and selection state — never sent to the
    // database, which assigns its own id.
    id: `${seriesId}#${occurrenceIndex}`,
    uid: icalEvent.uid || seriesId,
    title: safeText(icalEvent.summary).slice(0, 300),
    description: safeText(icalEvent.description),
    location: safeText(icalEvent.location),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    isAllDay,
    isRecurring: occurrenceCount > 1,
    occurrenceIndex,
    occurrenceCount
  }
}

/**
 * Expands one VEVENT into one row per occurrence, bounded by RECURRENCE_WINDOW_MONTHS
 * and RECURRENCE_MAX_OCCURRENCES_PER_SERIES. A non-recurring event is just one row.
 * EXDATE-excluded instances and modified single instances are handled by ical.js's
 * own iterator, not re-implemented here.
 */
function expandEvent(icalEvent, { now, windowMonths, maxOccurrences }) {
  const duration = icalEvent.duration
  const windowEnd = new Date(now)
  windowEnd.setMonth(windowEnd.getMonth() + windowMonths)

  if (!icalEvent.isRecurring()) {
    const occurrenceEnd = icalEvent.endDate || cloneWithDuration(icalEvent.startDate, duration)
    return [
      toRow({
        icalEvent,
        occurrenceStart: icalEvent.startDate,
        occurrenceEnd,
        seriesId: icalEvent.uid,
        occurrenceIndex: 0,
        occurrenceCount: 1
      })
    ]
  }

  const iterator = icalEvent.iterator()
  const occurrences = []
  let next
  // eslint-disable-next-line no-cond-assign
  while ((next = iterator.next())) {
    const startJs = next.toJSDate()
    if (startJs > windowEnd) break
    if (occurrences.length >= maxOccurrences) break
    occurrences.push(next)
  }

  return occurrences.map((occurrenceStart, index) =>
    toRow({
      icalEvent,
      occurrenceStart,
      occurrenceEnd: cloneWithDuration(occurrenceStart, duration),
      seriesId: icalEvent.uid,
      occurrenceIndex: index,
      occurrenceCount: occurrences.length
    })
  )
}

/**
 * Parses raw .ics text into import-ready rows. Cancelled events are dropped. Rows
 * beyond MAX_EVENTS_PER_IMPORT are dropped with a count returned so the UI can say
 * "and 40 more were left out" instead of freezing the tab on a huge calendar.
 */
export function extractImportableEvents(text, { now = new Date() } = {}) {
  let component
  try {
    const jcalData = ICAL.parse(text)
    component = new ICAL.Component(jcalData)
  } catch (error) {
    throw new Error(`That doesn't look like a valid .ics file (${error.message}).`)
  }

  registerTimezones(component)

  const veventComponents = component.getAllSubcomponents('vevent')
  const rows = []
  let cancelledCount = 0

  for (const veventComponent of veventComponents) {
    const icalEvent = new ICAL.Event(veventComponent)
    if (isCancelled(icalEvent)) {
      cancelledCount += 1
      continue
    }
    if (!icalEvent.startDate) continue

    rows.push(
      ...expandEvent(icalEvent, {
        now,
        windowMonths: RECURRENCE_WINDOW_MONTHS,
        maxOccurrences: RECURRENCE_MAX_OCCURRENCES_PER_SERIES
      })
    )
  }

  rows.sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`))

  const truncated = Math.max(0, rows.length - MAX_EVENTS_PER_IMPORT)
  return {
    rows: rows.slice(0, MAX_EVENTS_PER_IMPORT),
    truncatedCount: truncated,
    cancelledCount,
    calendarName: component.getFirstPropertyValue('x-wr-calname') || null
  }
}
