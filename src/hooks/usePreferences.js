import { useCallback, useEffect, useMemo, useState } from 'react'
import { preferences } from '../utils/supabase'

/**
 * Loads the signed-in user's private identity tags. Returns an empty list — never a
 * stale one — the moment they sign out.
 */
export const usePreferences = (user) => {
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(Boolean(user))

  useEffect(() => {
    let active = true

    if (!user) {
      setRow(null)
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    preferences.get(user.id).then(({ data }) => {
      if (!active) return
      setRow(data)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])

  const save = useCallback(
    async (identityTags) => {
      if (!user) return { error: { message: 'Sign in to save preferences.' } }
      const { data, error } = await preferences.save(user.id, identityTags)
      if (!error) setRow(data)
      return { data, error }
    },
    [user]
  )

  // Memoised: `row?.identity_tags || []` would hand back a brand new array on every
  // render, and any effect or memo downstream that depends on it would never settle.
  const preferenceTags = useMemo(() => row?.identity_tags || [], [row])

  return {
    preferences: row,
    preferenceTags,
    hasPreferences: Boolean(row),
    loading,
    save
  }
}
