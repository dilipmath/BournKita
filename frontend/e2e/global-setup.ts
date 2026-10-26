import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { e2eAdmin } from './credentials.ts'

// Creates the e2e Admin in the running stack. Exit code 2 means accounts already exist,
// which is fine when an earlier run created this same Admin.
export default function globalSetup(): void {
  try {
    execFileSync('docker', ['compose', 'exec', '-T', 'api', 'kita-admin', 'create-admin', '--email', e2eAdmin.email], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      input: `${e2eAdmin.password}\n${e2eAdmin.password}\n`,
      stdio: ['pipe', 'inherit', 'pipe'],
    })
  } catch (error) {
    if ((error as { status?: number }).status !== 2) throw error
  }
}
