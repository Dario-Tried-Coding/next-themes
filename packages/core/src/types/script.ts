import { Config } from './config';

export type Observer = 'storage' | 'DOM-attrs'

export type ScriptArgs = {
  storageKey?: string
  config: Config
  observers?: Observer[]
}

export abstract class NextThemes {
  static init() {}
}