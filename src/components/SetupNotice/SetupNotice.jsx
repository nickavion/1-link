import styles from './SetupNotice.module.css'

/**
 * Shown instead of the app when .env has no Supabase keys in it. A blank page with a
 * console error is a bad first five minutes for anyone cloning this repo.
 */
const SetupNotice = () => (
  <div className={styles.wrap}>
    <div className={styles.card}>
      <h1 className={styles.title}>Almost there</h1>
      <p className={styles.lead}>
        The site is running, but it has no database to talk to yet. Pick one:
      </p>

      <div className={styles.option}>
        <h2>Just want to look around?</h2>
        <p>
          Stop this server (<kbd>Ctrl</kbd>+<kbd>C</kbd>) and run:
        </p>
        <pre className={styles.code}>npm run dev:mock</pre>
        <p className={styles.note}>
          Starts a pretend database with a few example events. Nothing is saved, and no
          account is needed.
        </p>
      </div>

      <div className={styles.option}>
        <h2>Setting it up for real?</h2>
        <ol className={styles.steps}>
          <li>
            Make a free project at <code>supabase.com</code>
          </li>
          <li>
            Copy <code>.env.example</code> to a file called <code>.env</code>
          </li>
          <li>
            Paste in your project URL and <strong>anon</strong> key from
            Project&nbsp;Settings&nbsp;→&nbsp;API
          </li>
          <li>
            Run <code>supabase db push</code> to create the tables
          </li>
          <li>Start this server again</li>
        </ol>
        <p className={styles.note}>
          The anon key is the public one and is meant to be in the app. Never put the
          service_role key in <code>.env</code> — it bypasses every security rule.
        </p>
      </div>

      <p className={styles.footer}>Full instructions are in README.md.</p>
    </div>
  </div>
)

export default SetupNotice
