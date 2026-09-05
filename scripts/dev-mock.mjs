/**
 * `npm run dev:mock` — starts the pretend Supabase (scripts/mock-supabase.mjs) and
 * the Vite dev server together, and points the app at the pretend one. No .env and
 * no Supabase account needed; nothing you do in the site is saved permanently.
 *
 * For the real thing, put your project's keys in .env and use `npm run dev`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const MOCK_PORT = process.env.MOCK_PORT || '54321'

const children = []
const run = (command, args, env) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env }
  })
  children.push(child)
  return child
}

const shutdown = () => {
  for (const child of children) child.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('Starting the pretend Supabase (development only, nothing is saved)...')
run('node', [join(here, 'mock-supabase.mjs')], { MOCK_PORT })

// Give the mock a moment to bind its port before Vite serves a page that calls it.
setTimeout(() => {
  run('npm', ['run', 'dev'], {
    VITE_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
    VITE_SUPABASE_ANON_KEY: 'pretend-anon-key-for-local-development'
  })
}, 400)
