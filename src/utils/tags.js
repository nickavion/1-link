/**
 * Single source of truth for the tag vocabulary.
 *
 * The three groups stay separate on purpose: an identity tag says who an event is
 * for, a type tag says what happens there, a vibe tag says what to expect at the
 * door. Merging them would collapse three different filter behaviours into one.
 *
 * The same lists are CHECK constraints in supabase/migrations/0002_identity_tags.sql
 * — change both together.
 */

export const IDENTITY_TAGS = [
  { value: 'trans_masc', label: 'Trans masc' },
  { value: 'trans_fem', label: 'Trans fem' },
  { value: 'sapphic', label: 'Sapphic' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bi_pan', label: 'Bi / pan' },
  { value: 'nb', label: 'Non-binary' },
  { value: 'cis_women', label: 'Cis women' },
  { value: 'cis_men', label: 'Cis men' },
  { value: 'allies', label: 'Allies' },
  { value: 'all_welcome', label: 'All welcome' }
]

export const EVENT_TYPE_TAGS = [
  { value: 'party', label: 'Party' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'sports', label: 'Sports' },
  { value: 'art', label: 'Art' },
  { value: 'dating_mixer', label: 'Dating mixer' },
  { value: 'support_group', label: 'Support group' }
]

export const VIBE_TAGS = [
  { value: '18+', label: '18+' },
  { value: '21+', label: '21+' },
  { value: 'free', label: 'Free' },
  { value: 'ticketed', label: 'Ticketed' },
  { value: 'accessible_venue', label: 'Accessible venue' },
  { value: 'alcohol_free', label: 'Alcohol free' }
]

/** Column name -> group metadata. Drives the filter bar, the pickers and the pills. */
export const TAG_GROUPS = [
  {
    key: 'identity_tags',
    label: "Who it's for",
    tone: 'identity',
    tags: IDENTITY_TAGS,
    hint: 'Communities this event is built around. Pick every one that fits.'
  },
  {
    key: 'event_type_tags',
    label: 'What it is',
    tone: 'type',
    tags: EVENT_TYPE_TAGS,
    hint: 'The shape of the event.'
  },
  {
    key: 'vibe_tags',
    label: 'Good to know',
    tone: 'vibe',
    tags: VIBE_TAGS,
    hint: 'Age limits, cost and access.'
  }
]

export const TAG_COLUMNS = TAG_GROUPS.map((group) => group.key)

export const EMPTY_FILTERS = Object.freeze({
  identity_tags: [],
  event_type_tags: [],
  vibe_tags: []
})

const LABELS = new Map(
  TAG_GROUPS.flatMap((group) => group.tags.map((tag) => [`${group.key}:${tag.value}`, tag.label]))
)

export const tagLabel = (groupKey, value) => LABELS.get(`${groupKey}:${value}`) || value

export const isValidTag = (groupKey, value) => LABELS.has(`${groupKey}:${value}`)

/** Drop anything outside the vocabulary — used before every write and after every read. */
export const sanitizeTags = (groupKey, values) =>
  Array.isArray(values) ? [...new Set(values.filter((value) => isValidTag(groupKey, value)))] : []
