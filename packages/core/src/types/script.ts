import { State } from '../script';
import { Config } from './config';

export type Observer = 'storage' | 'DOM-attrs'

export type ScriptArgs = {
  storageKey?: string
  config: Config
  observers?: Observer[]
}

export interface NextThemes {
  state: State
  subscribe: (cb: (values: Map<string, string>) => void) => void
  update: (prop: string, value: string) => void
}