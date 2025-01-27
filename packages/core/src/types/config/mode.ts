import { HasKeys } from "../utils";
import { SystemValues } from "./props";

export type CssSelector = 'class' | 'colorScheme'
export type ResolvedMode = 'light' | 'dark'

type Mode = { type: 'mode'; selector?: CssSelector[]; store?: boolean }
export type ModeMono<V extends string = string> = Mode & { strategy: 'mono'; key: V; colorScheme: ResolvedMode }
export type ModeMulti<V extends string[] = string[]> = Mode & { strategy: 'multi'; keys: { [K in V[number]]: ResolvedMode }; preferred: V[number] }
export type ModeSystem<V extends SystemValues = { light: undefined; dark: undefined; system: undefined; custom: undefined }> = Mode & {
  strategy: 'system'
} & (
    | ({
        enableSystem: true
        preferred: [V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
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
          : {}))
    | ({
        enableSystem: false
        preferred: [V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
          ? string
          : (V['light'] extends string ? V['light'] : 'light') | (V['dark'] extends string ? V['dark'] : 'dark') | (V['custom'] extends string[] ? V['custom'][number] : never)
      } & ([V['light'], V['dark'], V['system'], V['custom']] extends [undefined, undefined, undefined, undefined]
        ? {
            customKeys?: {
              light?: string
              dark?: string
              custom?: Record<string, ResolvedMode>
            }
          }
        : HasKeys<V> extends true
          ? { customKeys: (V['light'] extends string ? { light: V['light'] } : {}) & (V['dark'] extends string ? { dark: V['dark'] } : {}) & (V['custom'] extends string[] ? { custom: Record<V['custom'][number], ResolvedMode> } : {}) }
          : {}))
  )
export type ModeProp = ModeMono | ModeMulti | ModeSystem