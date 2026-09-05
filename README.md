# Overlap

Identity-aware event discovery for queer and trans communities.

Events carry three separate tag groups — **who it's for**, **what it is**, and **what to
expect at the door** — and a signed-in person's own identity tags reorder their feed
without ever filtering it.

Built on [shubhamdevs/luma-clone](https://github.com/shubhamdevs/luma-clone) (MIT),
which provides the React + Vite + Supabase foundation.

---

## How it works

**Three tag groups, kept separate.** An identity tag says who an event is for, a type
tag says what happens there, a vibe tag says what to expect at the door. Merging them
would collapse three different filter behaviours into one.

**Filters are OR within a group, AND across groups.** Picking *gay* and *lesbian*
widens the results; picking *gay* and *workshop* narrows them. That's Postgres's `&&`
(overlaps) per group, which is what the GIN indexes are for.

**Preferences reorder the feed, they never filter it.** `ranking.js` scores each event
by how many identity tags overlap the viewer's saved ones, adds a smaller nudge for
open "all welcome" events and for matches happening this week, then sorts. Every public
event still appears. Hard-filtering on identity would quietly hide events from the
people most likely to want them — a friend's party, an all-welcome night — and would
make the feed feel *narrower* the more honestly someone answered onboarding.

**Onboarding is skippable, and preferences are private.** Someone who is not out should
be able to use the site without typing their identity into a database. Those who do get
a row that Row Level Security makes invisible to every other account, organisers
included.

## Running it locally

```bash
npm install
npm run dev:mock
```

Open http://localhost:3000. `dev:mock` runs the site against a pretend in-memory
backend seeded with example events — you can sign up, set tags, filter, and create an
event without a Supabase project. Nothing is saved; a banner says so.

That mock (`scripts/mock-supabase.mjs`) is development only. It has no security rules
whatsoever — every rule this project cares about lives in `supabase/migrations/` and is
enforced by Postgres.

To run against a real Supabase project, put its URL and anon key in `.env` and use
`npm run dev`. Starting without them shows a setup screen rather than a blank page.

## Tests

```bash
npm run test:rls      # Row Level Security, against a scratch Postgres (needs psql)
npm run test:ics      # the calendar-import parser, against a realistic fixture
npm run audit:secrets # no service_role keys or database passwords in tree or history
npm run lint
```

`test:rls` applies every migration to a throwaway database and runs
`supabase/tests/01_rls_test.sql` as a **non-owner role**, so the policies are genuinely
enforced rather than assumed: B can't read or write A's preferences, anonymous callers
get nothing, unlisted events stay unlisted, nobody can RSVP on someone else's behalf or
upload into their image folder, and the tag vocabulary holds. 18 assertions, non-zero
exit on any failure.

## Database

`supabase/migrations/` holds the schema, applied in numbered order:

| File | What it does |
| --- | --- |
| `0001_base_schema.sql` | `events` and `attendees`, from upstream |
| `0002_identity_tags.sql` | cover image, the three tag arrays, GIN indexes, `user_preferences`, and CHECK constraints pinning the tag vocabulary and field lengths |
| `0003_rls_and_privacy.sql` | RLS on `user_preferences`, two inherited policy fixes, and the `going_count` trigger |
| `0004_storage.sql` | `event-images` bucket: public read, per-uploader write folders, 5 MB, image types only |

`supabase/setup-all.sql` is all four concatenated, for applying through the Supabase
dashboard's SQL Editor in one paste. Regenerate it with `scripts/build-setup-sql.sh`
after changing any migration.

Three things there are worth knowing about:

- **The tag vocabulary is a database constraint, not just a frontend constant.** A
  hand-rolled REST call can't invent a tag the filter UI will never render.
- **Two inherited UPDATE policies had `USING` but no `WITH CHECK`.** `USING` decides
  which rows you may update; `WITH CHECK` decides what they may look like afterwards.
  Without it, a user could update their own event and hand ownership to someone else,
  or reassign their RSVP to another account. `0003` closes both.
- **`events.going_count` is denormalised.** Attendee rows are private — you see your
  own, the organiser sees all — so a public `count(*)` over `attendees` is impossible
  by design. A `SECURITY DEFINER` trigger keeps the counter honest instead.

The Supabase anon key is a public credential by design: it ships in the browser bundle
of any deployed build, and RLS is what protects the data. The `service_role` key
bypasses RLS entirely and has no place in this app.

## Importing from Google Calendar

Signed-in users can bring events in from a Google Calendar export at `/import`. It's a
**file upload**, not an OAuth "connect your calendar" — no Google account access is
requested, and nothing leaves the browser except the events the person chooses to save.

To get the file, in Google Calendar: Settings → Import & export → Export.

- Parsing happens client-side (`src/utils/icsImport.mjs`, using `ical.js` and `rrule`).
- A recurring event expands into one row per occurrence, capped at 26 occurrences or 6
  months out, so an unbounded "every weekday forever" meeting can't flood anything.
- Cancelled instances and `EXDATE`-excluded occurrences are dropped.
- Wall-clock times are read from each event's declared timezone rather than converted
  through the local machine's, so a 6:30pm event imports as 6:30pm.
- **Everything defaults to Unlisted with no tags**, because Google Calendar has no
  concept of either. You pick tags and visibility once, applied to what you're
  importing, before anything becomes selectable — enforced by the same Zod schema the
  create form uses.
- Anything that doesn't validate (an all-day event with no time, say) links to the full
  form, prefilled.
- A title + date match against existing events is flagged as a possible duplicate and
  unchecked by default, so re-uploading the same calendar doesn't double things up.

`scripts/fixtures/sample-google-calendar.ics` mirrors what Google actually exports —
its own `VTIMEZONE` block, a `TZID`-qualified recurring event with an `EXDATE`, an
all-day event, a cancelled one — so the flow can be exercised without a real calendar.

## Where things live

```
src/
  utils/
    tags.js         three tag groups + labels — mirrored by CHECK constraints in 0002
    validation.js   Zod schemas for the event form and preferences
    ranking.js      feed ordering — reorders, never filters
    icsImport.mjs   parses a .ics export into reviewable rows — framework-free on
                    purpose, so it's testable with plain Node
    supabase.js     client and helpers: tag filters, attendees, preferences, upload
  hooks/
    useAuth.js         upstream, unchanged
    usePreferences.js  the signed-in user's private identity tags
  components/
    TagPicker/      multi-select chip row for one tag group
    TagPills/       an event's tags, one row and one colour per group
    FilterBar/      search + a picker per group
    EventCard/      cover photo, tag pills, match badge, owner-only Edit link
    EventForm/      the event fields form, shared by Create and Edit so the two
                    can't drift apart
  pages/
    EventsPage/           the feed: filters, search, preference ordering
    CreateEventPage/      owns what happens after a valid submit; EventForm owns
                          the fields
    EditEventPage/        same form, prefilled, owner-gated in UI and by RLS
    ImportCalendarPage/   upload a .ics, review, bulk-tag, import
    OnboardingPage/       skippable identity-tag step
    PreferencesPage/      edit those tags later
```

## Not built yet

Organiser verification badges, a moderation queue for public submissions, and a mobile
app sharing this backend.

## Licence

MIT, inherited from [luma-clone](https://github.com/shubhamdevs/luma-clone).
