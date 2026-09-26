import { describe, expect, it, vi } from 'vitest'

const notify = vi.fn()
const dismiss = vi.fn()
vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  dismissNotification: (...args: unknown[]) => dismiss(...args)
}))

import { reportBackendContract } from './updates'

describe('EVY fork: backend skew toast', () => {
  it('never nags about an older backend: EVY updates the engine, not the desktop', () => {
    reportBackendContract(0)
    reportBackendContract(undefined)
    expect(notify).not.toHaveBeenCalled()
    expect(dismiss).toHaveBeenCalled()
  })
})
