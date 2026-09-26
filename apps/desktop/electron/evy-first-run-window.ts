/**
 * evy-first-run-window.ts — the small EVY window shown while the customer
 * signs in through the system browser (fork patch, EVY-1188).
 *
 * Plain HTML through a data: URL, no preload, no IPC: the window only tells
 * the user what is happening. "Abrir el navegador de nuevo" is a link the
 * main process routes to shell.openExternal; "Copiar enlace" copies the same
 * URL inside the page (execCommand, no clipboard permission needed on a
 * data: origin) for a browser the app cannot open itself. Everything the
 * flow needs (registry, tokens) lives in main.ts; this file owns the window.
 */
import { BrowserWindow, shell } from 'electron'

export type EvyFirstRunStep = 'connect' | 'waiting' | 'signin' | 'error'

export interface EvyFirstRunWindow {
  show(step: EvyFirstRunStep, detail?: string, reopenUrl?: string | null): void
  close(): void
  isOpen(): boolean
}

const STEP_TEXT: Record<EvyFirstRunStep, { title: string; body: string }> = {
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

// Same V mark as the EVY panel and landing logo.
const MARK_VIEWBOX = '259 202 110 116'
const MARK_PATH =
  'M364.44,212.44c0-5.86-6.16-8.61-9.32-3.79l-29.2,47.41c-2.73,4.45-7.31,6.68-11.91,6.7h0c-4.59-.02-9.18-2.25-11.91-6.7l-29.2-47.41c-3.15-4.83-9.32-2.07-9.32,3.79,0,0-.21,24.71,0,33.17.22,8.91,3.64,24.85,18.43,36.96,10.4,8.52,15.8,15.6,18.82,20.39,1.21,1.92,2.25,4.09,3.71,6.07,2.25,3.03,5.98,4.21,9.46,4.36h0c3.48-.15,7.21-1.33,9.46-4.36,1.47-1.98,2.5-4.15,3.71-6.07,3.02-4.79,8.42-11.87,18.82-20.39,14.8-12.11,18.22-28.05,18.43-36.96.21-8.46,0-33.17,0-33.17Z'

export function evyFirstRunHtml(step: EvyFirstRunStep, detail: string, reopenUrl: string | null): string {
  const t = STEP_TEXT[step]
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const spinner = step === 'error' ? '' : '<div class="spin" aria-hidden="true"></div>'
  const actions: string[] = []
  if (reopenUrl) {
    actions.push(
      `<a class="btn primary" href="${esc(reopenUrl)}" target="_blank" rel="noopener">Abrir el navegador de nuevo</a>`
    )
    actions.push(`<button class="btn" type="button" id="copy" data-url="${esc(reopenUrl)}">Copiar enlace</button>`)
  }
  if (step === 'error') {
    actions.push('<a class="btn primary" href="evy-first-run://retry">Reintentar</a>')
  }
  const actionBlock = actions.length ? `<div class="actions">${actions.join('')}</div><p class="copied" id="copied"></p>` : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>EVY</title>
<style>
  html,body{height:100%;margin:0}
  body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#f6f6f4;color:#111;display:flex;align-items:center;justify-content:center;-webkit-user-select:none;user-select:none}
  main{width:22.5rem;padding:2rem 2rem 1.75rem;text-align:center;background:#fff;border:1px solid #e6e6e3;border-radius:1.25rem;box-shadow:0 10px 30px rgba(17,17,17,.06)}
  .logo{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:1.25rem}
  .logo svg{width:1.75rem;height:1.85rem;fill:#111}
  .logo span{font-size:1.35rem;font-weight:500;letter-spacing:-.01em}
  h1{font-size:1.2rem;font-weight:600;margin:0 0 .5rem;letter-spacing:-.01em}
  p{color:#555;line-height:1.5;margin:.4rem 0;font-size:.95rem}
  .detail{font-size:.85rem;color:#8a8a86;word-break:break-word}
  .spin{width:1.35rem;height:1.35rem;margin:1rem auto .25rem;border:2px solid #dcdcd8;border-top-color:#335FDD;border-radius:50%;animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .actions{display:flex;flex-direction:column;gap:.5rem;margin-top:1.25rem}
  .btn{display:block;padding:.6rem 1rem;border-radius:999px;border:1px solid #dcdcd8;background:#fff;color:#111;font:inherit;font-size:.95rem;font-weight:500;text-decoration:none;cursor:pointer}
  .btn:hover{background:#f3f3f0}
  .btn.primary{background:#335FDD;border-color:#335FDD;color:#fff}
  .btn.primary:hover{background:#2a4fbd}
  .copied{font-size:.85rem;color:#335FDD;min-height:1.2em;margin:.35rem 0 0}
</style></head><body><main>
  <div class="logo"><svg viewBox="${MARK_VIEWBOX}" aria-hidden="true"><path d="${MARK_PATH}"/></svg><span>Evy</span></div>
  <h1>${esc(t.title)}</h1>
  <p>${esc(t.body)}</p>
  ${detail ? `<p class="detail">${esc(detail)}</p>` : ''}
  ${spinner}
  ${actionBlock}
<script>
  var b = document.getElementById('copy');
  if (b) b.addEventListener('click', function () {
    var ta = document.createElement('textarea');
    ta.value = b.getAttribute('data-url') || '';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    document.getElementById('copied').textContent = ok ? 'Enlace copiado. Pégalo en el navegador que prefieras.' : 'No se pudo copiar.';
  });
</script>
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
      height: 540,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'EVY',
      backgroundColor: '#f6f6f4',
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
      void w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(evyFirstRunHtml(step, detail, reopenUrl))}`)
      if (!w.isVisible()) w.show()
    },
    close() {
      if (win && !win.isDestroyed()) win.close()
      win = null
    },
    isOpen: () => win !== null && !win.isDestroyed()
  }
}
