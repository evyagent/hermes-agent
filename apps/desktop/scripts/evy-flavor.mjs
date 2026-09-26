/**
 * Writes apps/desktop/build/evy-build.json: which EVY central this build talks
 * to. Ships inside the packaged app via electron-builder's extraResources and
 * is read by electron/evy-connect.ts (evyCentralUrl). Two flavors:
 *
 *   EVY_FLAVOR=pro  (default)  -> https://app.evyagent.ai, app name "EVY"
 *   EVY_FLAVOR=dev             -> the develop preview,     app name "EVY dev"
 *
 * EVY_CENTRAL_URL overrides the URL of either flavor at build time.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const flavor = (process.env.EVY_FLAVOR || 'pro').trim() === 'dev' ? 'dev' : 'pro'
const defaults = {
  pro: { central: 'https://app.evyagent.ai', appName: 'EVY' },
  dev: { central: 'https://evy-git-develop-evys-projects.vercel.app', appName: 'EVY dev' }
}
const central = (process.env.EVY_CENTRAL_URL || defaults[flavor].central).replace(/\/+$/, '')
const out = resolve(here, '..', 'build', 'evy-build.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify({ flavor, central, appName: defaults[flavor].appName }, null, 2)}\n`)
console.log(`[evy-flavor] ${flavor}: ${central} (${defaults[flavor].appName})`)
