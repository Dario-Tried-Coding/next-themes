import { Constraints, State } from '../script'
import { Config } from './config'
import { Selector } from './config/mode'

export type Observer = 'storage' | 'DOM-attrs'

export type ScriptArgs = {
  storageKey?: string
  config: Config
  mode?: {
    attribute?: Selector[]
    store?: boolean
    storageKey?: string
  }
  observe?: Observer[]
  nonce?: string
  disableTransitionOnChange?: boolean
}

export type DEFAULTS = Required<Omit<ScriptArgs, 'config'>> & { mode: Required<ScriptArgs['mode']> }

export interface NextThemes {
  state: State
  options: Constraints
  subscribe: (cb: (values: Map<string, string>) => void) => void
  update: (prop: string, value: string) => void
}
