#!/usr/bin/env node
/**
 * Runs the .ics parser against scripts/fixtures/sample-google-calendar.ics — a file
 * built to mirror exactly what Google Calendar exports (its own VTIMEZONE block,
 * TZID-qualified DTSTART/DTEND, a weekly RRULE with an EXDATE, an all-day event, a
 * cancelled instance) — and asserts on the output.
 *
 * No network access needed: this is the same shape of file a real Google Calendar
 * export produces, so it exercises the parser the same way a real upload would.
 * See README.md for how to verify against your own real calendar once the app is
 * running somewhere with normal internet access.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extractImportableEvents, RECURRENCE_MAX_OCCURRENCES_PER_SERIES } from '../src/utils/icsImport.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(here, 'fixtures', 'sample-google-calendar.ics')
const text = readFileSync(fixturePath, 'utf8')

const results = []
const check = (label, condition, detail = '') => {
  results.push({ label, pass: Boolean(condition), detail })
}

// Run "now" as if it were a week before the fixture's events, so the past-events row
// and the recurrence window behave the way they would for someone importing this
// calendar in real time — not tied to whatever day this happens to run.
const now = new Date('2026-09-01T00:00:00Z')
const { rows, truncatedCount, cancelledCount, calendarName } = extractImportableEvents(text, { now })

check('calendar name is read from X-WR-CALNAME', calendarName === 'Community Events', calendarName)
check('the cancelled event is dropped, not imported as a row', cancelledCount === 1, `cancelledCount=${cancelledCount}`)
check('nothing was truncated for a calendar this small', truncatedCount === 0, `truncatedCount=${truncatedCount}`)

const byUid = (uid) => rows.filter((r) => r.uid === uid)

// --- one-off event: timezone + text unescaping ------------------------------------
const boardGames = byUid('one-off-boardgames@community-events')
check('one-off event produced exactly one row', boardGames.length === 1, `${boardGames.length} rows`)
if (boardGames.length) {
  const row = boardGames[0]
  check('title read correctly', row.title === 'Board Games Night', row.title)
  check(
    'wall-clock start time preserved as declared (19:00 America/Chicago, not converted)',
    row.startDate === '2026-10-08' && row.startTime === '19:00',
    `${row.startDate} ${row.startTime}`
  )
  check('end time preserved the same way', row.endDate === '2026-10-08' && row.endTime === '22:00', `${row.endDate} ${row.endTime}`)
  check(
    'DESCRIPTION escape sequences (\\n and \\,) are unescaped',
    row.description === 'Low-key games night above the pub.\nTeach-first table for anyone new, no experience needed.',
    JSON.stringify(row.description)
  )
  check('LOCATION comma-escape is unescaped', row.location === 'The Rose & Crown, Sheffield', row.location)
  check('a non-recurring event is not flagged as recurring', row.isRecurring === false)
}

// --- recurring weekly event: expansion + EXDATE ------------------------------------
const supportGroup = byUid('weekly-support-group@community-events')
check(
  `recurring event expands to multiple rows, capped at ${RECURRENCE_MAX_OCCURRENCES_PER_SERIES}`,
  supportGroup.length > 1 && supportGroup.length <= RECURRENCE_MAX_OCCURRENCES_PER_SERIES,
  `${supportGroup.length} rows`
)
check('every occurrence keeps the 18:30 wall-clock time', supportGroup.every((r) => r.startTime === '18:30'))
check(
  'the EXDATE-excluded occurrence (2026-09-23) is not present',
  !supportGroup.some((r) => r.startDate === '2026-09-23'),
  supportGroup.map((r) => r.startDate).join(', ')
)
check('the first occurrence lands on the series start date', supportGroup[0]?.startDate === '2026-09-02', supportGroup[0]?.startDate)
check('rows are flagged as part of a recurring series', supportGroup.every((r) => r.isRecurring === true))

// --- all-day event ------------------------------------------------------------------
const festival = byUid('allday-festival@community-events')
check('all-day event produced one row', festival.length === 1, `${festival.length} rows`)
if (festival.length) {
  check('all-day event has no time component', festival[0].isAllDay === true && festival[0].startTime === '', festival[0].startTime)
  check('all-day event date is the declared start date', festival[0].startDate === '2026-09-19', festival[0].startDate)
}

// --- an event before "now" is still returned; the review UI decides what to do with it
const pastMeeting = byUid('past-planning-meeting@community-events')
check('a past event is still parsed (filtering by date is a UI decision, not a parser one)', pastMeeting.length === 1)

// --- overall count sanity -----------------------------------------------------------
const expectedNonRecurringRows = 1 /* board games */ + 1 /* festival */ + 1 /* past meeting */
check(
  'total row count = non-recurring rows + expanded recurring rows',
  rows.length === expectedNonRecurringRows + supportGroup.length,
  `${rows.length} total, ${supportGroup.length} from the recurring series`
)

const failed = results.filter((r) => !r.pass)
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? `  (${r.detail})` : ''}`)
}
console.log(`\n${results.length - failed.length}/${results.length} passed.`)
if (failed.length) process.exit(1)
