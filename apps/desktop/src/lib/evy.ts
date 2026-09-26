/**
 * EVY fork switches (EVY-1188). One place for what the EVY desktop hides or
 * turns off compared to upstream Hermes Desktop. The server side (the VPS
 * proxy's allowlists) is the real gate; these only remove the UI that would
 * dead-end against it. Owner decision 2026-09-24: everything Hermes offers
 * the user stays, engine configuration does not.
 */
export const EVY_DESKTOP = true

/** Settings views that are engine configuration or Hermes self-management. */
export const EVY_SETTINGS_HIDDEN: ReadonlySet<string> = new Set([
  'config:model',
  'config:workspace',
  'config:safety',
  'config:browser',
  'config:memory',
  'config:advanced',
  'vault',
  'billing',
  'providers',
  'gateway',
  'keys'
])

/** The first settings view the EVY desktop opens on. */
export const EVY_SETTINGS_DEFAULT_VIEW = 'config:chat'

/** Sidebar rows owned by the EVY panel instead (Conexiones owns messaging). */
export const EVY_SIDEBAR_NAV_HIDDEN: ReadonlySet<string> = new Set(['messaging'])

/** Capabilities tabs: skills stay (EVY skills included); toolsets, connectors
 *  and plugins are engine configuration or owned by the EVY panel. */
export const EVY_CAPABILITY_MODES: readonly string[] = ['skills']

/** Hermes self-update surfaces (backend skew toast, Check for Updates…). */
export const EVY_SELF_UPDATE_ENABLED = false

/** Profiles and gateways are EVY's (one assistant per account): no profile
 *  management window, no create/import, no "connect a gateway" entry. */
export const EVY_PROFILES_MANAGED = true

/** The settings footer (export / import / reset the ENGINE config) is gone:
 *  the engine config is EVY's, and a reset would wipe the tenant's setup. */
export const EVY_SETTINGS_FOOTER = false
