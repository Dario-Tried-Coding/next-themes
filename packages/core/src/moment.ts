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
    static #constraints: UndefinedOr<Constraints> = undefined
    static #modeHandling: Nullable<ModeHandling> = undefined

    private constructor() {}

    static #init() {
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
      this.#constraints = constraints

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

      this.#modeHandling = modeConfig
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

    static get constraints() {
      if (!this.#constraints) this.#init()
      return this.#constraints as Constraints
    }

    static get modeHandling() {
      if (!this.#modeHandling) this.#init()
      return this.#modeHandling as NullOr<ModeHandling>
    }
  }

  // #region CONSTANTS
  const stateSK = storageKey ?? defaults.storageKey
  const modeSK = ConfigProcessor.modeHandling?.storageKey ?? defaults.modeHandling.storageKey

  // #region UTILS
  class Utils {
    static merge(...maps: NullOr<Map<string, string>>[]) {
      return maps.reduce((acc, map) => {
        if (!map) return acc
        return new Map([...(acc ?? new Map()), ...map])
      }, new Map<string, string>())
    }

    static mapToJSON(map: Map<string, string>) {
      return JSON.stringify(Object.fromEntries(map))
    }
  }

  // #region VALIDATOR
  class Validator<TState extends 'uninitialized' | 'initialized' = 'uninitialized'> {
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
      const isHandled = ConfigProcessor.constraints.has(prop)
      const isAllowed = isHandled && !!value ? ConfigProcessor.constraints.get(prop)!.options.has(value) : false
      const isAllowedFallback = isHandled && !!fallback ? ConfigProcessor.constraints.get(prop)!.options.has(fallback) : false

      const preferred = isHandled ? ConfigProcessor.constraints.get(prop)!.base : undefined
      const valValue = !isHandled ? undefined : isAllowed ? value : isAllowedFallback ? (fallback as NonNullable<typeof fallback>) : preferred

      return { passed: isHandled && isAllowed, value: valValue }
    }

    validate(fallbacks?: Map<string, string>): TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    validate(fallbacks?: Map<string, string>) {
      const results: Map<string, { passed: boolean; value: string }> = new Map()
      const sanValues: Map<string, string> = new Map()

      for (const [prop, { base }] of ConfigProcessor.constraints.entries()) {
        results.set(prop, { passed: false, value: undefined as unknown as string })
        sanValues.set(prop, base)
      }

      for (const [prop, fallback] of fallbacks?.entries() ?? []) {
        const { passed, value: sanValue } = this.#validate(prop, fallback)
        results.set(prop, { passed, value: fallback })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      for (const [prop, value] of this.values.entries()) {
        // existing code...
      }

      return { passed: true, values: sanValues, results } as TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    }
  }

  // #region STORAGE MANAGER (SM)
  class StorageManager {
    static #_state: NullOr<Map<string, string>> = null
    static #_mode: Nullable<string> = ConfigProcessor.modeHandling ? null : undefined

    private constructor() {}

    // #region SM - init
    static #init() {
      const retrievedState = this.#retrieve(stateSK)
      const { values: valValues } = Validator.ofJSON(retrievedState).validate()
      this.#_state = valValues

      if (ConfigProcessor.modeHandling?.store) {
        const mode = valValues.get(ConfigProcessor.modeHandling.prop)
        if (mode) this.#_mode = mode
      }

      if (listeners.includes('storage')) {
        window.addEventListener('storage', ({ key, newValue }) => {
          // prettier-ignore
          switch (key) {
            case stateSK: {
              const { values: valValues } = Validator.ofJSON(newValue).validate()
              this.state = valValues
            }; break
            case modeSK: { }; break
            default: {}
          }
        })
      }
    }

    // #region SM - utils
    static #retrieve(key: string) {
      return localStorage.getItem(key)
    }

    static #store(key: string, value: string) {
      const needsUpdate = this.#retrieve(key) !== value
      if (needsUpdate) localStorage.setItem(key, value)
    }

    // #region SM - state getter/setter
    static get state(): Map<string, string> {
      if (!this.#_state) this.#init()
      return this.#_state as Map<string, string>
    }

    static set state(values: Map<string, string>) {
      this.#store(stateSK, Utils.toJSON(values))

      if (ConfigProcessor.modeHandling?.store) {
        const mode = values.get(modeSK)
        if (mode) this.#store(modeSK, mode)
      }
    }
  }

  // #region DOM MANAGER (DM)
  class DOMManager {
    static #initiated = false
    static #target = document.documentElement
    static #state: NullOr<Map<string, string>> = null
    static #resolvedMode: Nullable<ResolvedMode> = ConfigProcessor.modeHandling ? null : undefined

    private constructor() {}

    static #getSystemPref() {
      const supportsPref = window.matchMedia('(prefers-color-scheme)').media !== 'not all'
      return supportsPref ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : undefined
    }

    static #handleMutations(mutations: MutationRecord[]) {
      for (const { attributeName } of mutations) {
        // prettier-ignore
        switch (attributeName) {
          case 'style': () => { }; break
          case 'class': () => { }; break
          default: {
            const prop = attributeName?.replace('data-', '')
            if (!prop) return

            const newValue = this.#target.getAttribute(`data-${prop}`)
            const currValue = StorageManager.state.get(prop)
            if (currValue && newValue !== currValue) this.state = new Map([[prop, currValue]])
          }; break
        }
      }
    }

    static #init() {
      if (listeners?.includes('DOM-attrs')) {
        const observer = new MutationObserver(this.#handleMutations.bind(this))
        observer.observe(this.#target, {
          attributes: true,
          attributeFilter: [
            ...Array.from(ConfigProcessor.constraints.keys()).map((prop) => `data-${prop}`),
            ...(ConfigProcessor.modeHandling?.cssSelectors.includes('colorScheme') ? ['style'] : []),
            ...(ConfigProcessor.modeHandling?.cssSelectors.includes('class') ? ['class'] : []),
          ],
        })
      }
      this.#initiated = true
    }

    static get state(): NullOr<Map<string, string>> {
      return this.#state
    }
    static set state(values: Map<string, string>) {
      const newState = Utils.merge(this.state, values)

      this.#state = newState
      newState?.forEach((value, prop) => {
        const needsUpdate = this.#target.getAttribute(`data-${prop}`) !== value
        if (needsUpdate) this.#target.setAttribute(`data-${prop}`, value)
      })

      if (ConfigProcessor.modeHandling) {
        const mode = newState?.get(ConfigProcessor.modeHandling.prop)!
        if (mode) {
          const isSystem = mode === ConfigProcessor.modeHandling.system?.mode
          const resolvedMode = isSystem ? (this.#getSystemPref() ?? ConfigProcessor.modeHandling.resolvedModes.get(ConfigProcessor.modeHandling.system!.fallback)!) : ConfigProcessor.modeHandling.resolvedModes.get(mode)!
          this.resolvedMode = resolvedMode
        }
      }

      if (!this.#initiated) this.#init()
    }


    static set resolvedMode(resolvedMode: ResolvedMode) {
      this.#resolvedMode = resolvedMode

      if (ConfigProcessor.modeHandling?.cssSelectors.includes('colorScheme')) {
        const isSet = this.#target.style.colorScheme === resolvedMode
        if (!isSet) this.#target.style.colorScheme = resolvedMode
      }

      if (ConfigProcessor.modeHandling?.cssSelectors.includes('class')) {
        const isSet = this.#target.classList.contains('light') ? 'light' : this.#target.classList.contains('dark') ? 'dark' : undefined
        if (isSet === resolvedMode) return

        const other = resolvedMode === 'light' ? 'dark' : 'light'
        this.#target.classList.replace(other, resolvedMode) || this.#target.classList.add(resolvedMode)
      }
    }
  }

  // #region STATE MANAGER (SM)
  class StateManager {
    static #_state: NullOr<Map<string, string>> = null

    static get #state(): NullOr<Map<string, string>> {
      return this.#_state
    }

    static set #state(values: Map<string, string>) {
      const { values: valValues } = Validator.ofMap(values).validate()
      const newState = Utils.merge(this.#state, valValues)
      this.#_state = newState

      if (newState) {
        StorageManager.state = newState
        DOMManager.state = newState
      }
    }

    static init() {
      const state = StorageManager.state
      this.#state = state
    }
  }

  StateManager.init()
}