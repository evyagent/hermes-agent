/**
 * evy-connect.ts — EVY's first-run door (fork patch, EVY-1188).
 *
 * The EVY desktop never installs a local Hermes runtime: it always talks to
 * the customer's assistant (the engine dashboard on the tenant VPS). On the
 * first launch there is no registered gateway yet, so instead of the Hermes
 * "connect or install" choice we ask the EVY central where the assistant is:
 *
 *   1. bind a loopback listener on 127.0.0.1:<ephemeral>;
 *   2. open the system browser at <central>/desktop/connect?port=&state=
 *      (the central makes the user sign in / sign up as needed, waits for
 *      the VPS if it is still provisioning, and finally redirects to
 *      http://127.0.0.1:<port>/connect?state=&url=&name=);
 *   3. resolve with the gateway URL; the caller registers it as the primary
 *      remote OAuth connection and runs the normal native sign-in.
 *
 * Pure over injected `openExternal` / `createServer` so it is unit-testable
 * without Electron. Nothing secret travels here: the gateway URL is public
 * and the sign-in that follows is the phase-1 OIDC flow.
 */
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

export const EVY_CONNECTION_ID = 'evy'
export const EVY_CONNECTION_LABEL = 'Mi asistente'
export const DEFAULT_EVY_CENTRAL_URL = 'https://app.evyagent.ai'
export const EVY_CONNECT_TIMEOUT_MS = 15 * 60 * 1000

export interface EvyBuildInfo {
  flavor?: 'dev' | 'pro'
  central?: string
  appName?: string
}

/** `evy-build.json` next to the packaged app (scripts/evy-flavor.mjs); {} when absent. */
export function readEvyBuildInfo(
  resourcesPath: string | undefined,
  readFile: (p: string) => string
): EvyBuildInfo {
  if (!resourcesPath) return {}
  try {
    const parsed = JSON.parse(readFile(`${resourcesPath}/evy-build.json`)) as EvyBuildInfo
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** The central this build talks to: env override, then the build flavor, then production. */
export function evyCentralUrl(env: NodeJS.ProcessEnv = process.env, build: EvyBuildInfo = {}): string {
  const raw = (env.EVY_CENTRAL_URL || build.central || '').trim()
  return (raw || DEFAULT_EVY_CENTRAL_URL).replace(/\/+$/, '')
}

/** Only an EVY-published gateway is accepted back from the browser. */
export function isAcceptableGatewayUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password || url.search || url.hash) return false
  const host = url.hostname.toLowerCase()
  return host.endsWith('.sslip.io') || host.endsWith('.evyagent.ai') || host.endsWith('.evyagent.com')
}

export interface EvyConnectResult {
  url: string
  name: string
}

export interface EvyConnectDeps {
  openExternal: (url: string) => Promise<void> | void
  createServer?: typeof http.createServer
  centralUrl?: string
  timeoutMs?: number
  log?: (line: string) => void
}

const DONE_HTML =
  '<!doctype html><html lang="es"><meta charset="utf-8"><title>EVY</title>' +
  '<body style="font-family:system-ui;max-width:32rem;margin:4rem auto"><h1>Listo</h1>' +
  '<p>Ya puedes cerrar esta pestaña y volver a la aplicación EVY.</p></body></html>'

export function runEvyConnect(deps: EvyConnectDeps): Promise<EvyConnectResult> {
  const createServer = deps.createServer || http.createServer
  const central = (deps.centralUrl || evyCentralUrl()).replace(/\/+$/, '')
  const state = randomBytes(18).toString('base64url')
  const log = deps.log || (() => {})
  return new Promise<EvyConnectResult>((resolve, reject) => {
    let settled = false
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (url.pathname !== '/connect') {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not found')
        return
      }
      const gotState = url.searchParams.get('state') || ''
      const gateway = url.searchParams.get('url') || ''
      if (gotState !== state || !isAcceptableGatewayUrl(gateway)) {
        log(`[evy-connect] rejected callback (state ok=${gotState === state}, url ok=${isAcceptableGatewayUrl(gateway)})`)
        res.writeHead(400, { 'content-type': 'text/plain' })
        res.end('bad request')
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(DONE_HTML)
      finish(null, { url: gateway.replace(/\/+$/, ''), name: url.searchParams.get('name') || EVY_CONNECTION_LABEL })
    })
    const timer = setTimeout(() => finish(new Error('EVY connect timed out waiting for the browser')), deps.timeoutMs ?? EVY_CONNECT_TIMEOUT_MS)
    timer.unref?.()
    const finish = (error: Error | null, result?: EvyConnectResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      if (error) reject(error)
      else resolve(result as EvyConnectResult)
    }
    server.once('error', error => finish(error))
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      const target = `${central}/desktop/connect?port=${port}&state=${encodeURIComponent(state)}`
      log(`[evy-connect] waiting on 127.0.0.1:${port}; opening ${central}/desktop/connect`)
      Promise.resolve(deps.openExternal(target)).catch(error => finish(error instanceof Error ? error : new Error(String(error))))
    })
  })
}

/** The registry entry the app saves for the customer's assistant. */
export function evyConnectionEntry(result: EvyConnectResult) {
  return {
    id: EVY_CONNECTION_ID,
    kind: 'remote' as const,
    label: result.name || EVY_CONNECTION_LABEL,
    url: result.url,
    authMode: 'oauth' as const
  }
}

/**
 * A just-provisioned assistant answers a little later than the central's
 * redirect: the VPS is "ready" before its gated dashboard has finished
 * starting, and the 8443 proxy answers 503 until then. Poll the public
 * `/api/status` until it reports `auth_required: true` (the phase-1 gate), so
 * the sign-in that follows never probes a half-started gateway and falls back
 * to the wrong login flow. Resolves true when gated, false on timeout.
 */
export async function waitForGatewayGate(
  gatewayUrl: string,
  deps: {
    fetchJson?: (url: string) => Promise<unknown>
    timeoutMs?: number
    intervalMs?: number
    onTick?: (attempt: number) => void
    sleep?: (ms: number) => Promise<void>
  } = {}
): Promise<boolean> {
  const fetchJson =
    deps.fetchJson ||
    (async (url: string) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      return res.json()
    })
  const sleep = deps.sleep || (ms => new Promise<void>(r => setTimeout(r, ms)))
  const timeoutMs = deps.timeoutMs ?? 5 * 60 * 1000
  const intervalMs = deps.intervalMs ?? 5000
  const deadline = Date.now() + timeoutMs
  let attempt = 0
  while (Date.now() <= deadline) {
    attempt += 1
    deps.onTick?.(attempt)
    try {
      const body = (await fetchJson(`${gatewayUrl.replace(/\/+$/, '')}/api/status`)) as { auth_required?: unknown }
      if (body && body.auth_required === true) return true
    } catch {
      // not up yet
    }
    if (Date.now() + intervalMs > deadline) break
    await sleep(intervalMs)
  }
  return false
}

