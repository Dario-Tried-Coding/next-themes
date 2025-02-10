import { ScriptArgs } from './types'
import { CssSelector, ModeProp, ResolvedMode, Strat } from './types/config/mode'
import { Listener } from './types/script'
import { Nullable, NullOr, UndefinedOr } from './types/utils'

export function script({ storageKey, config, listeners: provListeners }: ScriptArgs) {
  // #region DEFAULTS
  const defaults = {
    storageKey: 'next-themes',
    modeHandling: {
      store: false,
      storageKey: 'theme',
      cssSelectors: [] as const satisfies CssSelector[],
    },
    listeners: [] as const satisfies Listener[],
  } as const

  const listeners = provListeners ?? defaults.listeners

  // #region CONFIG PROCESSOR (CP)
  type Constraints = Map<string, { base: string; options: Set<string> }>
  type ModeHandling = { prop: string; strategy: Strat; resolvedModes: Map<string, ResolvedMode>; system: UndefinedOr<{ mode: string; fallback: string }>; cssSelectors: CssSelector[]; store: boolean; storageKey: UndefinedOr<string> }
  class ConfigProcessor {
    private static instance: ConfigProcessor
    public constraints: Constraints
    public modeHandling: NullOr<ModeHandling>

    private constructor() {
      const constraints: Constraints = new Map()
      for (const [prop, stratObj] of Object.entries(config)) {
        // prettier-ignore
        switch (stratObj.strategy) {
          case 'mono': constraints.set(prop, { options: new Set([stratObj.key]), base: stratObj.key }); break
          case 'multi': constraints.set(prop, { options: new Set(Array.isArray(stratObj.keys) ? stratObj.keys : Object.keys(stratObj.keys)), base: stratObj.base }); break
          case 'light_dark':
            {
              constraints.set(prop, {
                options: new Set([stratObj.customKeys?.light ?? 'light', stratObj.customKeys?.dark ?? 'dark', ...(stratObj.customKeys?.custom ? Object.keys(stratObj.customKeys.custom) : [])]),
                base: stratObj.base,
              })
            }; break
          case 'system':
            {
              constraints.set(prop, {
                options: new Set([stratObj.customKeys?.light ?? 'light', stratObj.customKeys?.dark ?? 'dark', stratObj.customKeys?.system ?? 'system', ...(stratObj.customKeys?.custom ? Object.keys(stratObj.customKeys.custom) : [])]),
                base: stratObj.base,
              })
            }; break
        }
      }
      this.constraints = constraints

      const modeConfig = Object.entries(config).find(([_, { type }]) => type === 'mode') as UndefinedOr<[string, ModeProp]>

      const resolvedModes: Map<string, ResolvedMode> = new Map()
      // prettier-ignore
      switch (modeConfig?.[1].strategy) {
              case 'mono': resolvedModes.set(modeConfig[0], modeConfig[1].colorScheme); break
              case 'multi': Object.entries(modeConfig[1].keys).forEach(([key, colorScheme]) => resolvedModes.set(key, colorScheme)); break
              case 'light_dark':
              case 'system': {
                resolvedModes.set(modeConfig[1].customKeys?.light ?? 'light', 'light')
                resolvedModes.set(modeConfig[1].customKeys?.dark ?? 'dark', 'dark')
                if (modeConfig[1].customKeys?.custom) Object.entries(modeConfig[1].customKeys.custom).forEach(([key, colorScheme]) => resolvedModes.set(key, colorScheme))
              }; break
              default: break
            }

      this.modeHandling = modeConfig
        ? {
            prop: modeConfig[0],
            strategy: modeConfig[1].strategy,
            resolvedModes,
            system:
              modeConfig[1].strategy === 'system'
                ? {
                    mode: modeConfig[1].customKeys?.system ?? 'system',
                    fallback: modeConfig[1].fallback,
                  }
                : undefined,
            cssSelectors: modeConfig[1].selector ? (Array.isArray(modeConfig[1].selector) ? modeConfig[1].selector : [modeConfig[1].selector]) : defaults.modeHandling.cssSelectors,
            store: modeConfig[1].store ?? defaults.modeHandling.store,
            storageKey: modeConfig[1].storageKey,
          }
        : null
    }

    public static getInstance() {
      if (!ConfigProcessor.instance) ConfigProcessor.instance = new ConfigProcessor()
      return ConfigProcessor.instance
    }
  }

  // #region UTILS
  class Utils {
    static merge(...maps: NullOr<Map<string, string>>[]) {
      return maps.reduce((acc, map) => {
        if (!map) return acc
        return new Map([...(acc ?? []), ...map])
      }, new Map<string, string>())
    }

    static mapToJSON(map: Map<string, string>) {
      return JSON.stringify(Object.fromEntries(map))
    }
  }

  // #region VALIDATOR
  class Validator<TState extends 'uninitialized' | 'initialized' = 'uninitialized'> {
    private config = ConfigProcessor.getInstance()
    private values: Map<string, string> = new Map()

    private constructor() {}

    static ofJSON(json: NullOr<string>) {
      const validator = new Validator<'initialized'>()

      if (!json?.trim()) return validator
      try {
        const parsed = JSON.parse(json)
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return validator

        const entries = Object.entries(parsed).filter(([key, value]) => typeof key === 'string' && typeof value === 'string') as [string, string][]
        validator.values = new Map(entries)
      } catch {}

      return validator
    }

    static ofMap(values: Map<string, string>) {
      const validator = new Validator<'initialized'>()
      validator.values = values
      return validator
    }

    #validate(prop: string, value: string, fallback?: string) {
      const isHandled = this.config.constraints.has(prop)
      const isAllowed = isHandled && !!value ? this.config.constraints.get(prop)!.options.has(value) : false
      const isAllowedFallback = isHandled && !!fallback ? this.config.constraints.get(prop)!.options.has(fallback) : false

      const preferred = isHandled ? this.config.constraints.get(prop)!.base : undefined
      const valValue = !isHandled ? undefined : isAllowed ? value : isAllowedFallback ? (fallback as NonNullable<typeof fallback>) : preferred

      return { passed: isHandled && isAllowed, value: valValue }
    }

    validate(fallbacks?: Map<string, string>): TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    validate(fallbacks?: Map<string, string>) {
      const results: Map<string, { passed: boolean; value: string }> = new Map()
      const sanValues: Map<string, string> = new Map()

      for (const [prop, { base }] of this.config.constraints.entries()) {
        results.set(prop, { passed: false, value: undefined as unknown as string })
        sanValues.set(prop, base)
      }

      for (const [prop, fallback] of fallbacks?.entries() ?? []) {
        const { passed, value: sanValue } = this.#validate(prop, fallback)
        results.set(prop, { passed, value: fallback })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      for (const [prop, value] of this.values.entries()) {
        const { passed, value: sanValue } = this.#validate(prop, value)
        results.set(prop, { passed, value })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      return { passed: true, values: sanValues, results } as TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    }
  }

  // #region CONSTANTS
  const stateSK = storageKey ?? defaults.storageKey
  const modeSK = ConfigProcessor.getInstance().modeHandling?.storageKey ?? defaults.modeHandling.storageKey
}
