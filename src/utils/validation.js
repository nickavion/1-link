/**
 * Form validation (section 8: "Form inputs validated — event title/description
 * length limits, URL fields checked"). The same limits exist as CHECK constraints
 * in 0002_identity_tags.sql; this layer is for the error messages.
 */
import { z } from 'zod'
import { EVENT_TYPE_TAGS, IDENTITY_TAGS, VIBE_TAGS } from './tags'

const values = (group) => group.map((tag) => tag.value)

const tagArray = (group) =>
  z
    .array(z.enum(values(group)))
    .default([])
    .transform((tags) => [...new Set(tags)])

const optionalImageUrl = z
  .string()
  .trim()
  .max(2048, 'That URL is too long.')
  .refine(
    (value) => {
      if (!value) return true
      try {
        const parsed = new URL(value)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      } catch {
        return false
      }
    },
    { message: 'Enter a full URL starting with https://' }
  )
  .optional()
  .or(z.literal(''))

export const eventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Give the event a name of at least 3 characters.')
      .max(120, 'Keep the title under 120 characters.'),
    description: z
      .string()
      .trim()
      .max(4000, 'Descriptions are capped at 4000 characters.')
      .optional()
      .or(z.literal('')),
    location: z
      .string()
      .trim()
      .max(200, 'Keep the location under 200 characters.')
      .optional()
      .or(z.literal('')),
    startDate: z.string().min(1, 'Start date is required.'),
    startTime: z.string().min(1, 'Start time is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    endTime: z.string().min(1, 'End time is required.'),
    capacity: z
      .union([z.literal(''), z.coerce.number().int().positive().max(100000)])
      .optional(),
    coverImageUrl: optionalImageUrl,
    identity_tags: tagArray(IDENTITY_TAGS),
    event_type_tags: tagArray(EVENT_TYPE_TAGS),
    vibe_tags: tagArray(VIBE_TAGS)
  })
  .refine((data) => data.event_type_tags.length > 0, {
    path: ['event_type_tags'],
    message: 'Pick at least one event type so people can find this.'
  })
  .refine(
    (data) =>
      new Date(`${data.endDate}T${data.endTime}`) > new Date(`${data.startDate}T${data.startTime}`),
    { path: ['endTime'], message: 'End time must be after start time.' }
  )

export const preferencesSchema = z.object({
  identity_tags: tagArray(IDENTITY_TAGS)
})

/** Flatten a ZodError into { field: message } for inline errors. */
export const fieldErrors = (error) => {
  const out = {}
  for (const issue of error.issues) {
    const key = issue.path[0] || 'form'
    if (!out[key]) out[key] = issue.message
  }
  return out
}
