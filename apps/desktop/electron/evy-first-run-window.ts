/**
 * evy-first-run-window.ts — the small EVY window shown while the customer
 * signs in through the system browser (fork patch, EVY-1188).
 *
 * Plain HTML through a data: URL, no preload, no IPC: the window only tells
 * the user what is happening and offers "Abrir el navegador de nuevo", which
 * is a link the main process routes to shell.openExternal. Everything the
 * flow needs (registry, tokens) lives in main.ts; this file owns the window.
 */
import { BrowserWindow, shell } from 'electron'

export interface EvyFirstRunWindow {
  show(step: 'connect' | 'waiting' | 'signin' | 'error', detail?: string, reopenUrl?: string | null): void
  close(): void
  isOpen(): boolean
}

const STEP_TEXT: Record<'connect' | 'waiting' | 'signin' | 'error', { title: string; body: string }> = {
  connect: {
    title: 'Entra con tu cuenta EVY',
    body: 'Se ha abierto tu navegador. Inicia sesión (o crea tu cuenta) y vuelve aquí: la aplicación se conectará sola a tu asistente.'
  },
  waiting: {
    title: 'Tu asistente está arrancando',
    body: 'Un momento: en cuanto responda te pediremos confirmar tu cuenta en el navegador.'
  },
  signin: {
    title: 'Confirma tu cuenta',
    body: 'Un paso más en el navegador para autorizar la aplicación en tu asistente.'
  },
  error: {
    title: 'No se pudo conectar',
    body: 'Vuelve a intentarlo. Si el problema sigue, escríbenos.'
  }
}

function html(step: 'connect' | 'waiting' | 'signin' | 'error', detail: string, reopenUrl: string | null): string {
  const t = STEP_TEXT[step]
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const reopen = reopenUrl
    ? `<p><a href="${esc(reopenUrl)}" target="_blank" rel="noopener">Abrir el navegador de nuevo</a></p>`
    : ''
  const retry = step === 'error' ? '<p><a href="evy-first-run://retry">Reintentar</a></p>' : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>EVY</title>
<style>
  html,body{height:100%;margin:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#fff;color:#111;display:flex;align-items:center;justify-content:center}
  main{max-width:26rem;padding:2rem;text-align:center}
  .mark{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:2.2rem;letter-spacing:.06em;color:#0033ff;margin-bottom:1rem}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{color:#444;line-height:1.5;margin:.5rem 0}
  a{color:#0033ff}
  .detail{font-size:.85rem;color:#888;word-break:break-word}
</style></head><body><main>
  <div class="mark">EVY</div>
  <h1>${esc(t.title)}</h1>
  <p>${esc(t.body)}</p>
  ${detail ? `<p class="detail">${esc(detail)}</p>` : ''}
  ${reopen}${retry}
</main></body></html>`
}

export function createEvyFirstRunWindow(opts: {
  icon?: string | undefined
  onRetry: () => void
  log: (line: string) => void
}): EvyFirstRunWindow {
  let win: BrowserWindow | null = null
  const ensure = () => {
    if (win && !win.isDestroyed()) return win
    win = new BrowserWindow({
      width: 520,
      height: 420,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'EVY',
      ...(opts.icon ? { icon: opts.icon } : {}),
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    win.setMenuBarVisibility(false)
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('evy-first-run://retry')) {
        event.preventDefault()
        opts.log('[evy-first-run] retry requested')
        opts.onRetry()
        return
      }
      if (/^https?:/.test(url)) {
        event.preventDefault()
        void shell.openExternal(url)
      }
    })
    win.on('closed', () => {
      win = null
    })
    return win
  }
  return {
    show(step, detail = '', reopenUrl = null) {
      const w = ensure()
      void w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html(step, detail, reopenUrl))}`)
      if (!w.isVisible()) w.show()
    },
    close() {
      if (win && !win.isDestroyed()) win.close()
      win = null
    },
    isOpen: () => win !== null && !win.isDestroyed()
  }
}
