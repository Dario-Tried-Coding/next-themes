import { Strats as BaseStrats } from './shared'
import { SystemValues } from './props'
import { HasKeys } from '@repo/typescript-utils/object'

type Strats = BaseStrats & {
  light_dark: 'light_dark'
  system: 'system'
}
export type Strat = Strats[keyof Strats]

export type Selector = 'class' | 'colorScheme'
export type ResolvedMode = 'light' | 'dark'

type Mode = { type: 'mode' }

export type ModeMono<V extends string = string> = Mode & { strategy: Strats['mono']; key: V; colorScheme: ResolvedMode }

export type ModeMulti<V extends string[] = string[]> = Mode & { strategy: Strats['multi']; keys: { [K in V[number]]: ResolvedMode }; base: V[number] }

export type ModeLightDark<V extends Omit<SystemValues, 'system'> = { light: undefined; dark: undefined; custom: undefined }> = Mode & {
  strategy: Strats['light_dark']
  base: [V['light'], V['dark'], V['custom']] extends [undefined, undefined, undefined]
    ? string
    : (V['light'] extends string ? V['light'] : 'light') | (V['dark'] extends string ? V['dark'] : 'dark') | (V['custom'] extends string[] ? V['custom'][number] : never)
} & ([V['light'], V['dark'], V['custom']] extends [undefined, undefined, undefined]
    ? {
        customKeys?: {
          light?: string
          dark?: string
          custom?: Record<string, ResolvedMode>
        }
      }
    : HasKeys<V> extends true
      ? // prettier-ignore
        {
          customKeys: (V['light'] extends string ? { light: V['light'] } : {}) &
            (V['dark'] extends string ? { dark: V['dark'] } : {}) &
            (V['custom'] extends string[] ? { custom: Record<V['custom'][number], ResolvedMode> } : {})
        }
      : {})

export type ModeSystem<V extends SystemValues = { light: undefined; dark: undefined; system: undefined; custom: undefined }> = Mode & {
  strategy: Strats['system']
  base: [V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
    ? string
    : (V['light'] extends string ? V['light'] : 'light') | (V['dark'] extends string ? V['dark'] : 'dark') | (V['system'] extends string ? V['system'] : 'system') | (V['custom'] extends string[] ? V['custom'][number] : never)
  fallback: [V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
    ? string
    : (V['light'] extends string ? V['light'] : 'light') | (V['dark'] extends string ? V['dark'] : 'dark') | (V['custom'] extends string[] ? V['custom'][number] : never)
} & ([V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
    ? {
        customKeys?: {
          light?: string
          dark?: string
          system?: string
          custom?: Record<string, ResolvedMode>
        }
      }
    : HasKeys<V> extends true
      ? {
          customKeys: (V['light'] extends string ? { light: V['light'] } : {}) &
            (V['dark'] extends string ? { dark: V['dark'] } : {}) &
            (V['system'] extends string ? { system: V['system'] } : {}) &
            (V['custom'] extends string[] ? { custom: Record<V['custom'][number], ResolvedMode> } : {})
        }
      : {})

export type ModeProp = ModeMono | ModeMulti | ModeLightDark | ModeSystem
