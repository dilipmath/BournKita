// Runs the end-to-end tests against a throwaway stack (compose.e2e.yaml): starts it fresh, runs
// Playwright, then removes it with its data. Arguments go to Playwright, e.g.
// `npm run test:e2e -- e2e/backlog.spec.ts`; `--keep` leaves the stack running afterwards
// (at http://localhost:8081, Mailpit at http://localhost:8026), to look around.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const frontend = fileURLToPath(new URL('..', import.meta.url))

// Every `docker compose` below, and the one in global-setup, then works on the e2e stack.
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: 'kita-e2e',
  COMPOSE_PATH_SEPARATOR: ',',
  COMPOSE_FILE: 'compose.yaml,compose.e2e.yaml',
  E2E_BASE_URL: 'http://localhost:8081',
  E2E_MAILPIT_URL: 'http://localhost:8026',
}

function run(command: string, args: string[], cwd: string): number {
  // A shell, so Windows finds npx.cmd.
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' })
  return result.status ?? 1
}

const keep = process.argv.includes('--keep')
const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== '--keep')

// Removes what an earlier run may have left, then starts afresh.
run('docker', ['compose', 'down', '--volumes', '--remove-orphans'], root)
let status = run('docker', ['compose', 'up', '--detach', '--build', '--wait'], root)
if (status === 0) status = run('npx', ['playwright', 'test', ...playwrightArgs], frontend)
if (status !== 0) run('docker', ['compose', 'logs'], root)
if (keep) {
  console.log('The e2e stack is still running at http://localhost:8081 (Mailpit: http://localhost:8026).')
  console.log('Remove it with: docker compose -p kita-e2e down --volumes')
} else {
  run('docker', ['compose', 'down', '--volumes', '--remove-orphans'], root)
}
process.exit(status)
