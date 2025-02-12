import { ScriptArgs } from './types'
import { ModeProp, ResolvedMode, Selector, Strat } from './types/config/mode'
import { Observer } from './types/script'
import { NullOr, UndefinedOr } from './types/utils'

export function script({ storageKey, config, observers: provObservers }: ScriptArgs) {
  // #region DEFAULTS
  const defaults = {
    storageKey: 'next-themes',
    modeHandling: {
      storageKey: 'theme',
      store: false,
      Selectors: [] as const satisfies Selector[],
    },
    observers: [] as const satisfies Observer[],
  } as const

  // #region CONFIG PROCESSOR (CP)
  type Constraints = Map<string, { base: string; options: Set<string> }>
  type ModeHandling = { prop: string; strategy: Strat; resolvedModes: Map<string, ResolvedMode>; system: UndefinedOr<{ mode: string; fallback: string }>; selectors: Selector[]; store: boolean; storageKey: string }
  type Observers = Observer[]
  class ConfigProcessor {
    private static instance: ConfigProcessor
    private _storageKey: string
    private _constraints: Constraints
    private _modeHandling: NullOr<ModeHandling>
    private _observers: Observers

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
      this._constraints = constraints

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

      this._modeHandling = modeConfig
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
            selectors: modeConfig[1].selector ? (Array.isArray(modeConfig[1].selector) ? modeConfig[1].selector : [modeConfig[1].selector]) : defaults.modeHandling.Selectors,
            store: modeConfig[1].store ?? defaults.modeHandling.store,
            storageKey: modeConfig[1].storageKey ?? defaults.modeHandling.storageKey,
          }
        : null

      this._storageKey = storageKey ?? defaults.storageKey
      this._observers = provObservers ?? defaults.observers
    }

    private static getInstance() {
      if (!ConfigProcessor.instance) ConfigProcessor.instance = new ConfigProcessor()
      return ConfigProcessor.instance
    }

    public static get modeHandling() {
      return ConfigProcessor.getInstance()._modeHandling
    }

    public static get constraints() {
      return ConfigProcessor.getInstance()._constraints
    }

    public static get observers() {
      return ConfigProcessor.getInstance()._observers
    }

    public static get storageKey() {
      return ConfigProcessor.getInstance()._storageKey
    }
  }

  // #region UTILS
  class Utils {
    private constructor() {}

    static merge<T extends NullOr<Map<string, string>>[]>(...maps: T): T[number] extends null ? null : Map<string, string> {
      const merged = maps.reduce((acc, map) => {
        if (!map) return acc
        return new Map([...(acc ?? []), ...map])
      }, new Map<string, string>())

      return merged as T[number] extends null ? null : Map<string, string>
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

    static validate(prop: string, value: NullOr<string>, fallback?: NullOr<string>) {
      const isHandled = ConfigProcessor.constraints.has(prop)
      const isAllowed = isHandled && !!value ? ConfigProcessor.constraints.get(prop)!.options.has(value) : false
      const isAllowedFallback = isHandled && !!fallback ? ConfigProcessor.constraints.get(prop)!.options.has(fallback) : false

      const preferred = isHandled ? ConfigProcessor.constraints.get(prop)!.base : undefined
      const valValue = !isHandled ? undefined : isAllowed ? value! : isAllowedFallback ? fallback! : preferred

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
        const { passed, value: sanValue } = Validator.validate(prop, fallback)
        results.set(prop, { passed, value: fallback })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      for (const [prop, value] of this.values.entries()) {
        const { passed, value: sanValue } = Validator.validate(prop, value)
        results.set(prop, { passed, value })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      return { passed: true, values: sanValues, results } as TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    }
  }

  // #region EVENTS
  type EventMap = {
    DOMUpdate: Map<string, string>
  }
  class EventManager {
    private static events: Map<string, Set<(...args: any[]) => void>> = new Map()

    static on<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
      if (!this.events.has(event)) {
        this.events.set(event, new Set())
      }
      this.events.get(event)!.add(callback)
    }

    static off<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
      this.events.get(event)?.delete(callback)
    }

    static emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
      this.events.get(event)?.forEach((callback) => callback(payload))
    }

    static clear(event?: keyof EventMap): void {
      if (event) {
        this.events.delete(event)
      } else {
        this.events.clear()
      }
    }
  }

  // #region STORAGE
  class StorageManager {
    private static instance: StorageManager
    private _state: NullOr<Map<string, string>>

    private constructor() {
      const stateString = StorageManager.retrieve(ConfigProcessor.storageKey)
      const { values } = Validator.ofJSON(stateString).validate()

      this._state = values
      StorageManager.storeState(values)

      EventManager.on('DOMUpdate', (values) => (StorageManager.state = values))
    }

    private static retrieve(storageKey: string) {
      return window.localStorage.getItem(storageKey)
    }

    private static store(storageKey: string, string: string) {
      const needsUpdate = string !== this.retrieve(storageKey)
      if (needsUpdate) window.localStorage.setItem(storageKey, string)
    }

    private static storeState(values: Map<string, string>) {
      StorageManager.store(ConfigProcessor.storageKey, Utils.mapToJSON(values))

      if (ConfigProcessor.modeHandling?.store) {
        const mode = values.get(ConfigProcessor.modeHandling.prop)
        if (mode) this.store(ConfigProcessor.modeHandling.storageKey, mode)
      }
    }

    public static get state() {
      if (!StorageManager.instance) StorageManager.instance = new StorageManager()
      return StorageManager.instance._state!
    }

    public static set state(values: Map<string, string>) {
      const currState = StorageManager.state
      const merged = Utils.merge(currState, values)
      StorageManager.instance._state = merged
      StorageManager.storeState(merged)
    }
  }

  class DOMManager {
    private static instance: DOMManager
    private static target = document.documentElement
    private _state: NullOr<Map<string, string>> = null
    private _resolvedMode: UndefinedOr<ResolvedMode>

    private constructor(values: Map<string, string>) {
      this.applyState(values)

      if (ConfigProcessor.observers.includes('DOM-attrs')) {
        const handleMutations = (mutations: MutationRecord[]) => {
          for (const { attributeName, oldValue } of mutations) {
            // prettier-ignore
            switch (attributeName) {
              case 'style': { }; break;
              case 'class': { }; break;
              default: {
                if (!attributeName) return

                const prop = attributeName.replace('data-', '')
                const stateValue = DOMManager.state.get(prop)
                const newValue = DOMManager.target.getAttribute(attributeName)
                const { passed, value: sanValue } = Validator.validate(prop, newValue, oldValue)
                
                DOMManager.state = new Map([[prop, sanValue!]])
                if (sanValue! !== stateValue) EventManager.emit('DOMUpdate', new Map([[prop, sanValue!]]))
              }
            }
          }
        }

        const observer = new MutationObserver(handleMutations)
        observer.observe(DOMManager.target, {
          attributes: true,
          attributeOldValue: true,
          attributeFilter: [
            ...Array.from(ConfigProcessor.constraints.keys()).map((prop) => `data-${prop}`),
            ...(ConfigProcessor.modeHandling?.selectors.includes('colorScheme') ? ['style'] : []),
            ...(ConfigProcessor.modeHandling?.selectors.includes('class') ? ['class'] : []),
          ],
        })
      }
    }

    private static getSystemPref() {
      const supportsPref = window.matchMedia('(prefers-color-scheme)').media !== 'not all'
      return supportsPref ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : undefined
    }

    private static resolveMode(values: Map<string, string>) {
      if (!ConfigProcessor.modeHandling) return

      const mode = values.get(ConfigProcessor.modeHandling.prop)
      if (!mode) return

      const isSystemStrat = ConfigProcessor.modeHandling.strategy === 'system'
      const isSystemMode = ConfigProcessor.modeHandling.system?.mode === mode
      const isSystem = isSystemStrat && isSystemMode
      const fallbackMode = ConfigProcessor.modeHandling.system?.fallback
      if (isSystem) return this.getSystemPref() ?? ConfigProcessor.modeHandling.resolvedModes.get(fallbackMode!)

      return ConfigProcessor.modeHandling.resolvedModes.get(mode)
    }

    private applyState(values: Map<string, string>) {
      this._state = Utils.merge(this._state, values)
      this._state.forEach((value, key) => {
        const currValue = DOMManager.target.getAttribute(`data-${key}`)
        const needsUpdate = currValue !== value
        if (needsUpdate) DOMManager.target.setAttribute(`data-${key}`, value)
      })

      const resolvedMode = DOMManager.resolveMode(this._state)
      if (resolvedMode) {
        this._resolvedMode = resolvedMode
        if (ConfigProcessor.modeHandling?.selectors.includes('colorScheme')) {
          const currValue = DOMManager.target.style.colorScheme
          const needsUpdate = currValue !== resolvedMode
          if (needsUpdate) DOMManager.target.style.colorScheme = resolvedMode
        }
        if (ConfigProcessor.modeHandling?.selectors.includes('class')) {
          const isSet = DOMManager.target.classList.contains('light') ? 'light' : DOMManager.target.classList.contains('dark') ? 'dark' : undefined
          if (isSet === resolvedMode) return

          const other = resolvedMode === 'light' ? 'dark' : 'light'
          DOMManager.target.classList.replace(other, resolvedMode) || DOMManager.target.classList.add(resolvedMode)
        }
      }
    }

    public static get state() {
      if (!DOMManager.instance) throw new Error('DOMManager must be initialized before accessing state')
      return DOMManager.instance._state as NonNullable<DOMManager['_state']>
    }

    public static set state(values: Map<string, string>) {
      if (!DOMManager.instance) DOMManager.instance = new DOMManager(values)
      else DOMManager.instance.applyState(values)
    }
  }

  class Main {
    private static instance: Main
    private _state: NullOr<Map<string, string>>

    private constructor() {
      const storageState = StorageManager.state
      this._state = storageState
      DOMManager.state = storageState
    }

    public static init() {
      if (!Main.instance) Main.instance = new Main()
    }
  }

  window.NextThemes = Main
  window.NextThemes.init()
}
