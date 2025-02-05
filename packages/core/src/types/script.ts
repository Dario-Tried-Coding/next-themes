import { DEFAULTS } from '../constants'
import { CssSelector, ResolvedMode, Strat } from './config/mode'
import { NullOr } from './utils'

export type Listener = 'storage' | 'DOM-attrs'

type ModeConstraints = { strategy: Strat, allowed: { key: string; colorScheme: ResolvedMode }[]; preferred: string; fallback?: string }
type ModeHandling = { prop: string; constraints: ModeConstraints; selectors?: CssSelector[]; store?: boolean; storageKey?: string }

export type ScriptArgs = {
  storageKey?: string
  constraints: Record<string, { allowed: string[]; preferred: string }>
  modeHandling: NullOr<ModeHandling>
  listeners: Listener[]
  defaults: DEFAULTS
}
