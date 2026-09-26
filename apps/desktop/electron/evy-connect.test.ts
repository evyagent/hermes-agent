import { describe, expect, it } from 'vitest'
import { evyCentralUrl, evyConnectionEntry, isAcceptableGatewayUrl, runEvyConnect, waitForGatewayGate } from './evy-connect'

async function get(url: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url)
  return { status: res.status, text: await res.text() }
}

describe('evy-connect', () => {
  it('accepts only https EVY gateways', () => {
    expect(isAcceptableGatewayUrl('https://65-108-1-2.sslip.io:8443')).toBe(true)
    expect(isAcceptableGatewayUrl('https://acme.desktop.evyagent.ai')).toBe(true)
    expect(isAcceptableGatewayUrl('http://65-108-1-2.sslip.io:8443')).toBe(false)
    expect(isAcceptableGatewayUrl('https://evil.example')).toBe(false)
    expect(isAcceptableGatewayUrl('https://65-108-1-2.sslip.io:8443/?x=1')).toBe(false)
    expect(isAcceptableGatewayUrl('nope')).toBe(false)
  })

  it('reads the central from the env with the production default', () => {
    expect(evyCentralUrl({})).toBe('https://app.evyagent.ai')
    expect(evyCentralUrl({ EVY_CENTRAL_URL: 'https://evy-git-develop-evys-projects.vercel.app/' })).toBe(
      'https://evy-git-develop-evys-projects.vercel.app'
    )
  })

  it('opens the central with a loopback port + state and resolves on the matching callback', async () => {
    let opened = ''
    const result = await runEvyConnect({
      centralUrl: 'https://app.evyagent.ai',
      timeoutMs: 5000,
      openExternal: async url => {
        opened = url
        const target = new URL(url)
        const port = target.searchParams.get('port') as string
        const state = target.searchParams.get('state') as string
        // A wrong state is refused and keeps the listener waiting.
        const bad = await get(`http://127.0.0.1:${port}/connect?state=nope&url=https%3A%2F%2F65-108-1-2.sslip.io%3A8443`)
        expect(bad.status).toBe(400)
        const evil = await get(`http://127.0.0.1:${port}/connect?state=${state}&url=https%3A%2F%2Fevil.example`)
        expect(evil.status).toBe(400)
        const ok = await get(
          `http://127.0.0.1:${port}/connect?state=${state}&url=https%3A%2F%2F65-108-1-2.sslip.io%3A8443%2F&name=Acme`
        )
        expect(ok.status).toBe(200)
        expect(ok.text).toContain('volver a la aplicación EVY')
      }
    })
    expect(opened.startsWith('https://app.evyagent.ai/desktop/connect?port=')).toBe(true)
    expect(result).toEqual({ url: 'https://65-108-1-2.sslip.io:8443', name: 'Acme' })
    expect(evyConnectionEntry(result)).toEqual({
      id: 'evy',
      kind: 'remote',
      label: 'Acme',
      url: 'https://65-108-1-2.sslip.io:8443',
      authMode: 'oauth'
    })
  })

  it('rejects when the browser never comes back', async () => {
    await expect(runEvyConnect({ centralUrl: 'https://app.evyagent.ai', timeoutMs: 50, openExternal: () => {} })).rejects.toThrow(
      /timed out/
    )
  })
})

describe('waitForGatewayGate', () => {
  it('waits through 503s and an ungated status until the gate is on', async () => {
    const answers = [
      () => Promise.reject(new Error('fetch failed')),
      () => Promise.resolve({ error: 'dashboard_unavailable' }),
      () => Promise.resolve({ auth_required: false }),
      () => Promise.resolve({ auth_required: true, auth_providers: ['self-hosted'] })
    ]
    const ticks: number[] = []
    const ok = await waitForGatewayGate('https://65-108-1-2.sslip.io:8443/', {
      fetchJson: () => (answers.shift() as () => Promise<unknown>)(),
      intervalMs: 1,
      timeoutMs: 1000,
      onTick: n => ticks.push(n),
      sleep: async () => {}
    })
    expect(ok).toBe(true)
    expect(ticks).toEqual([1, 2, 3, 4])
  })
  it('gives up after the deadline', async () => {
    const ok = await waitForGatewayGate('https://65-108-1-2.sslip.io:8443', {
      fetchJson: () => Promise.reject(new Error('fetch failed')),
      intervalMs: 1,
      timeoutMs: 5,
      sleep: ms => new Promise(r => setTimeout(r, ms))
    })
    expect(ok).toBe(false)
  })
})

