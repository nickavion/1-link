/**
 * Feed ordering (section 6, step 5).
 *
 * Saved identity preferences REORDER the feed, they never filter it: an event with
 * no overlap still appears, just further down. Hard-filtering on identity would
 * quietly hide events from the people most likely to want them — an all-welcome
 * night, a friend's party — and would make the feed feel narrower the more
 * honestly someone answered onboarding.
 */

const OVERLAP_WEIGHT = 3
const ALL_WELCOME_WEIGHT = 1
const SOON_WEIGHT = 1
const WEEK = 7 * 24 * 60 * 60 * 1000

export const scoreEvent = (event, preferenceTags = []) => {
  if (!preferenceTags.length) return 0

  const identityTags = event.identity_tags || []
  const overlap = identityTags.filter((tag) => preferenceTags.includes(tag)).length
  let score = overlap * OVERLAP_WEIGHT

  // An open event is a weak positive, not a match — it must not outrank a real one.
  if (!overlap && identityTags.includes('all_welcome')) score += ALL_WELCOME_WEIGHT

  // Among events that actually match, the one happening this week is more useful.
  // Deliberately smaller than OVERLAP_WEIGHT and gated on a real overlap, so a
  // soon-ish "all welcome" event can never tie a genuine match.
  const until = new Date(event.start_date).getTime() - Date.now()
  if (overlap > 0 && until > 0 && until < WEEK) score += SOON_WEIGHT

  return score
}

export const rankEvents = (events, preferenceTags = []) =>
  [...events]
    .map((event) => ({ event, score: scoreEvent(event, preferenceTags) }))
    .sort(
      (a, b) =>
        b.score - a.score || new Date(a.event.start_date) - new Date(b.event.start_date)
    )
    .map(({ event, score }) => ({ ...event, matchScore: score }))

export const matchedTags = (event, preferenceTags = []) =>
  (event.identity_tags || []).filter((tag) => preferenceTags.includes(tag))
