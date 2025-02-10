import { Config } from './config';

export type Listener = 'storage' | 'DOM-attrs'

export type ScriptArgs = {
  storageKey?: string
  config: Config
  listeners?: Listener[]
}