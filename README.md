# Overlap

Identity-aware event discovery for queer and trans communities.

Events carry three separate tag groups — **who it's for**, **what it is**, **what to
expect at the door** — and a signed-in person's own identity tags reorder their feed
without ever filtering it.

Forked from [shubhamdevs/luma-clone](https://github.com/shubhamdevs/luma-clone) (MIT),
which provides the React + Vite + Supabase foundation: auth, the events/attendees
schema, the event form and the dark UI this builds on.

---

## What this fork adds

| Area | Change |
| --- | --- |
| Schema | `cover_image_url` + three tag arrays on `events`, GIN indexes, private `user_preferences` table |
| Security | RLS for the new table, two `WITH CHECK` gaps closed, a tag vocabulary enforced in the database, an image bucket scoped per uploader |
| Discovery | Filter bar (chips per tag group, multi-select), search, preference-based feed ordering |
| Onboarding | Skippable post-signup step that writes private identity tags |
| Event form | Three tag pickers, cover-image upload, Zod validation |
| Browsing | The feed no longer requires an account — public events are readable by the anon key, which is what the RLS policy always said |
| Local dev | `npm run dev:mock` runs the site against a pretend database, so a fresh clone is one command from a working page |
| Calendar import | Upload a Google Calendar `.ics` export, review and bulk-tag what it found, and only then save it — see [Importing from Google Calendar](#importing-from-google-calendar) |
| Editing | Event owners can now edit what they created — `/events/:id/edit`, gated to the owner both in the UI and at the database |

## Just want to see it?

```bash
npm install
npm run dev:mock
```

Open http://localhost:3000. That runs the site against a **pretend database**
(`scripts/mock-supabase.mjs`) with a handful of example events already in it. You can
sign up, set your tags, filter the feed and create an event. Nothing is saved — stop the
server and it resets — and no Supabase account is needed. A banner across the top says
so, so you can't mistake it for the real thing.

Development only: the pretend database has no security rules whatsoever. Every rule this
project cares about lives in `supabase/migrations/` and is enforced by Postgres, not by
that script.

## Running it for real

```bash
npm install
cp .env.example .env      # then paste in your keys — see Supabase setup below
npm run dev
```

Start the server without keys in `.env` and you get a screen explaining both options,
rather than a blank page.

## Supabase setup

Create a **new** project — do not reuse an existing one.

```bash
npm install -g supabase
supabase login
supabase projects create overlap
supabase link
supabase db push          # applies supabase/migrations/* in order
```

The anon key is a public credential: it ships in the bundle, and Row Level Security is
what decides which rows it can reach. The `service_role` key bypasses RLS entirely and
has no place in this app — not in `.env`, not anywhere under `src/`.

### Migrations

`database-setup.sql` from upstream is now `supabase/migrations/0001_base_schema.sql`,
unchanged except for `DROP POLICY IF EXISTS` lines that make `supabase db push`
re-runnable. Everything after it is this fork:

| File | What it does |
| --- | --- |
| `0002_identity_tags.sql` | cover image, the three tag arrays, GIN indexes, `user_preferences`, and CHECK constraints pinning the tag vocabulary and field lengths |
| `0003_rls_and_privacy.sql` | RLS on `user_preferences`, two inherited policy fixes, and the `going_count` trigger |
| `0004_storage.sql` | `event-images` bucket: public read, per-uploader write folders, 5 MB, image types only |

Three things there are worth knowing about:

- **The tag vocabulary is a database constraint, not just a frontend constant.** A
  hand-rolled REST call cannot invent a tag the filter UI will never render.
- **Two inherited UPDATE policies had `USING` but no `WITH CHECK`.** `USING` decides
  which rows you may update; `WITH CHECK` decides what they may look like afterwards.
  Without it, a user could update their own event and hand ownership to someone else,
  or reassign their RSVP to another account. `0003` closes both.
- **`events.going_count` is denormalised.** Attendee rows are private — you see your
  own, the organiser sees all — so a public `count(*)` over `attendees` is impossible
  by design. A `SECURITY DEFINER` trigger keeps the counter honest instead.

### Auth

Email/password works out of the box. For Google:

1. **Authentication → Providers → Google** — add a client ID/secret from Google Cloud Console.
2. **Authentication → URL Configuration** — set Site URL to the production domain (it
   defaults to localhost) and add `<domain>/auth/callback` as a redirect URL.
3. Replace the default SMTP with Resend/Postmark/SES before real signups — the built-in
   sender is rate-limited hard enough to lock people out.

## Before launch

```bash
npm run test:rls          # needs psql and a Postgres you can create a database on
npm run audit:secrets
npm run test:ics          # the calendar-import parser, against a realistic fixture
```

`test:rls` is section 4's "test this before building anything else, with two users, via
the API and not the UI". It applies every migration to a scratch database and runs
`supabase/tests/01_rls_test.sql` as a **non-owner role**, so RLS is genuinely enforced:
B cannot read or write A's preferences, anonymous callers get nothing, unlisted events
stay unlisted, nobody can RSVP on someone else's behalf or upload into their image
folder, and the tag vocabulary holds. 18 assertions, and it exits non-zero on any
failure.

```
PASS  B cannot read A's preferences
PASS  B cannot write A's preferences (new row violates row-level security policy…)
PASS  A cannot hand their event to B (WITH CHECK)
…
18 passed, 0 failed.
```

### Inherited credentials — read this

Upstream's committed `.env.example` is not a template: it contains a real Supabase
project ref, anon JWT, **database password** and postgres connection string. Those
values are already public in the upstream repository, and this fork inherits them in
commit `07679bf`. This fork's `.env.example` is placeholders only, but:

- Do not reuse that Supabase project. Create your own.
- If you fork this repo again, the history carries those values with it.
- They are the upstream author's to rotate, not this project's.

Remaining checklist items that live outside the repo: rate limiting on signup/login
(Supabase has basic protections; Cloudflare in front if this gets traction), and
confirming the storage bucket rejects oversized or non-image uploads in practice.

## Deploy

```bash
npx vercel
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel dashboard
```

Point Supabase's Site URL and OAuth redirect URLs at the production domain **before**
going live, or OAuth will bounce users to localhost.

---

## Importing from Google Calendar

Signed-in users can bring events in from a Google Calendar export at **Import Calendar**
in the nav (`/import`). This is a **file upload**, not a "Connect Google Calendar"
button — nothing is authenticated, no Google account access is requested, and nothing
leaves the browser except the events the person reviewing the import chooses to save.

**How to get the file**, in Google Calendar: Settings → Import & export → Export. That
downloads a `.zip` with one `.ics` file per calendar — upload the one you want.

What happens when you upload it:

1. The file is parsed entirely client-side (`src/utils/icsImport.mjs`, using `ical.js`
   and `rrule`) — nothing is sent to a server just to read it.
2. A recurring event (an RRULE) expands into one row per occurrence, capped at 26
   occurrences or 6 months out, whichever comes first — an unbounded "every weekday,
   forever" meeting can't flood the review screen or the database.
3. Cancelled instances (`STATUS:CANCELLED`) are dropped before you ever see them.
4. **Every imported event defaults to Unlisted and has no tags**, because Google
   Calendar has no concept of either. You pick tags and visibility once, applied to
   everything you're bringing in, before anything is selectable — this is enforced by
   running each row through the exact same Zod schema the create form uses
   (`event_type_tags` non-empty and all), not a separate, looser check.
5. An all-day event, or anything else that doesn't validate as-is, shows why and links
   to **Fix in the full form** — which opens the normal create form prefilled with that
   row, rather than the import screen growing a second editor.
6. Re-uploading the same calendar won't quietly double up events already on the
   account: a title + date match against your existing events is flagged and
   unchecked by default (still overridable, in case that's actually intended).

**Why upload-a-file and not "Connect Google Calendar":** a live OAuth sync needs a
registered Google Cloud project, a consent-screen review for calendar scopes (real
turnaround time, not a settings toggle), and somewhere to store refresh tokens per
user — a meaningfully bigger and slower-to-ship project than reading a file the
browser already has. See `git log` on this feature for the fuller tradeoff if you want
to revisit it later.

**Testing it without a real Google account:** `scripts/fixtures/sample-google-calendar.ics`
is built to mirror exactly what Google exports — its own `VTIMEZONE` block, a
`TZID`-qualified recurring event with an `EXDATE`, an all-day event, a cancelled one —
and `npm run test:ics` asserts the parser against it (timezone handling included: it
was wrong on the first pass, converting to the *test machine's* local time instead of
preserving the calendar's own wall-clock time, which `npm run test:ics` now guards
against). Upload that file on the import page to see the whole flow without needing a
calendar of your own.

---

## Where things live

Shared modules follow upstream's layout — `src/utils/`, not the `src/lib/` the outline
sketched.

```
src/
  utils/
    tags.js         three tag groups + labels — mirrored by CHECK constraints in 0002
    validation.js   Zod schemas for the event form and preferences
    ranking.js      feed ordering — reorders, never filters
    icsImport.mjs   parses a .ics export into rows the import page can review —
                    framework-free on purpose, so it's testable with plain Node
    supabase.js     upstream's client and helpers, extended with tag filters,
                    attendees, preferences and cover-image upload
  hooks/
    useAuth.js      upstream, unchanged
    usePreferences.js  the signed-in user's private identity tags
  components/
    TagPicker/      multi-select chip row for one tag group
    TagPills/       an event's tags, one row and one colour per group
    FilterBar/      search + a picker per group
    EventCard/      upstream's card, plus cover photo, tag pills, a match badge
                    and an Edit link when you're looking at your own event
    EventForm/      the event fields form, extracted so Create and Edit share one
                    implementation instead of two that can drift apart
  pages/
    EventsPage/           the feed: filters, search, preference ordering
    CreateEventPage/      thin now — owns "what happens after a valid submit",
                          EventForm owns the fields; also the landing spot for a
                          calendar-import row the importer couldn't validate itself
    EditEventPage/        same EventForm, prefilled from an existing row, gated to
                          the owner in the UI and by the update policy's WITH CHECK
    ImportCalendarPage/   upload a .ics, review, bulk-tag, import — see
                          "Importing from Google Calendar" above
    OnboardingPage/   skippable identity-tag step
    PreferencesPage/  edit those tags later
```

### The two decisions worth defending

**Preferences reorder, they never filter.** `ranking.js` scores each event by how many
identity tags overlap the viewer's saved ones, adds a smaller nudge for open
"all welcome" events and for matches happening this week, then sorts. Every public
event still appears. Hard-filtering on identity would quietly hide events from the
people most likely to want them — a friend's party, an all-welcome night — and would
make the feed feel *narrower* the more honestly someone answered onboarding.

**Onboarding is skippable, and preferences are unreadable by anyone else.** Someone who
is not out should be able to use the site without typing their identity into a
database. Those who do get a row that RLS makes invisible to every other account,
organisers included — `npm run test:rls` is what proves it, and it is worth re-running
after any policy change.

### Filter semantics

OR within a tag group, AND across groups: picking *gay* and *lesbian* widens the
results, picking *gay* and *workshop* narrows them. That is Postgres's `&&` (overlaps)
per group, which is what the GIN indexes in `0002` are for.

## Not built yet

Per section 10 of the outline: organiser verification badges, a moderation queue for
public submissions, and an Expo app sharing this backend — all deliberately deferred.

## Licence

MIT, inherited from [luma-clone](https://github.com/shubhamdevs/luma-clone).
