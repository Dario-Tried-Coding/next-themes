import { ScriptArgs } from './types'
import { ModeProp, ResolvedMode, Selector, Strat } from './types/config/mode'
import { EventMap } from './types/events'
import { Observer } from './types/script'
import { NullOr, UndefinedOr } from './types/utils'

export type State = NullOr<Map<string, string>>

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

    static jsonToMap(json: NullOr<string>): Map<string, string> {
      if (!json?.trim()) return new Map()
      try {
        const parsed = JSON.parse(json)
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return new Map()
        return new Map(Object.entries(parsed).filter(([key, value]) => typeof key === 'string' && typeof value === 'string') as [string, string][])
      } catch {
        return new Map()
      }
    }

    static isSameMap(map1: NullOr<Map<string, string>>, map2: NullOr<Map<string, string>>) {
      if (!map1 || !map2) return false
      if (map1 === map2) return true

      if (map1.size !== map2.size) return false

      for (const [key, value] of map1) {
        if (!map2.has(key) || map2.get(key) !== value) return false
      }

      return true
    }
  }

  // #region VALIDATOR
  class Validator<TState extends 'uninitialized' | 'initialized' = 'uninitialized'> {
    private values: Map<string, string> = new Map()

    private constructor() {}

    static ofJSON(json: NullOr<string>) {
      const validator = new Validator<'initialized'>()
      validator.values = Utils.jsonToMap(json)
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

    validate(fallbacks?: NullOr<string> | Map<string, string>): TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    validate(fallbacks?: NullOr<string> | Map<string, string>) {
      const results: Map<string, { passed: boolean; value: string }> = new Map()
      const sanValues: Map<string, string> = new Map()
      let passed = false
      const normFallbacks = typeof fallbacks === 'string' ? Utils.jsonToMap(fallbacks) : fallbacks

      for (const [prop, { base }] of ConfigProcessor.constraints.entries()) {
        results.set(prop, { passed: false, value: undefined as unknown as string })
        sanValues.set(prop, base)
      }

      for (const [prop, fallback] of normFallbacks?.entries() ?? []) {
        const { passed, value: sanValue } = Validator.validate(prop, fallback)
        results.set(prop, { passed, value: fallback })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      for (const [prop, value] of this.values.entries()) {
        const { passed: valuePassed, value: sanValue } = Validator.validate(prop, value, normFallbacks?.get(prop))
        results.set(prop, { passed, value })
        if (sanValue) sanValues.set(prop, sanValue)
        if (valuePassed) passed = true
      }

      return { passed: true, values: sanValues, results } as TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    }
  }

  // #region EVENTS
  class EventManager {
    private static events: Map<string, Set<(...args: any[]) => void>> = new Map()

    public static on<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
      if (!EventManager.events.has(event)) {
        EventManager.events.set(event, new Set())
      }
      EventManager.events.get(event)!.add(callback)
    }

    public static emit<K extends keyof EventMap>(event: K, ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]): void {
      EventManager.events.get(event)?.forEach((callback) => {
        const payload = args[0]
        if (payload) callback(payload)
        else callback()
      })
    }
  }

  // #region STORAGE
  class StorageManager {
    private static instance: UndefinedOr<StorageManager> = undefined
    private _state: NullOr<Map<string, string>> = null

    private constructor() {
      const stateString = StorageManager.retrieve(ConfigProcessor.storageKey)
      const { values } = Validator.ofJSON(stateString).validate()

      this._state = values
      StorageManager.storeState(values)

      if (ConfigProcessor.observers.includes('storage')) {
        window.addEventListener('storage', ({ key, newValue, oldValue }) => {
          if (key === ConfigProcessor.storageKey) {
            const state = StorageManager.state
            const { values, passed, results } = Validator.ofJSON(newValue).validate(oldValue)

            StorageManager.state = values
            if (!Utils.isSameMap(values, state)) EventManager.emit('Storage:update', values)
          }
        })
      }
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

      const mode = values.get(ConfigProcessor.modeHandling?.prop ?? '')
      if (mode) StorageManager.storeMode(mode)
    }

    private static storeMode(mode: string) {
      if (!ConfigProcessor.modeHandling?.store) return
      StorageManager.store(ConfigProcessor.modeHandling.storageKey, mode)
    }

    public static get state() {
      if (!StorageManager.instance) StorageManager.instance = new StorageManager()
      return StorageManager.instance._state!
    }

    public static set state(values: Map<string, string>) {
      const currState = StorageManager.state
      const merged = Utils.merge(currState, values)

      const needsUpdate = !Utils.isSameMap(currState, merged)
      if (needsUpdate) StorageManager.instance!._state = merged
      StorageManager.storeState(merged)
    }
  }

  class DOMManager {
    private static instance: UndefinedOr<DOMManager> = undefined
    private static target = document.documentElement
    private _state: NullOr<Map<string, string>> = null
    private _resolvedMode: UndefinedOr<ResolvedMode> = undefined

    private constructor(values: Map<string, string>) {
      this._state = values
      this._resolvedMode = DOMManager.resolveMode(values)

      DOMManager.applyState(values)

      if (ConfigProcessor.observers.includes('DOM-attrs')) {
        const handleMutations = (mutations: MutationRecord[]) => {
          for (const { attributeName, oldValue } of mutations) {
            // prettier-ignore
            switch (attributeName) {
              case 'style': {
                if (!ConfigProcessor.modeHandling?.selectors.includes('colorScheme')) return

                const stateRM = DOMManager.resolvedMode!
                const newRM = DOMManager.target.style.colorScheme
                
                if (stateRM !== newRM) DOMManager.target.style.colorScheme = stateRM
              }; break;
              case 'class': { 
                if (!ConfigProcessor.modeHandling?.selectors.includes('class')) return

                const stateRM = DOMManager.resolvedMode!
                const newRM = DOMManager.target.classList.contains('light') ? 'light' : DOMManager.target.classList.contains('dark') ? 'dark' : undefined

                if (stateRM !== newRM) {
                  const other = stateRM === 'light' ? 'dark' : 'light'
                  DOMManager.target.classList.replace(other, stateRM) || DOMManager.target.classList.add(stateRM)
                }
              }; break;
              default: {
                if (!attributeName) return

                const prop = attributeName.replace('data-', '')
                const stateValue = DOMManager.state?.get(prop)
                const newValue = DOMManager.target.getAttribute(attributeName)
                const { value: sanValue } = Validator.validate(prop, newValue, oldValue)
                
                DOMManager.state = new Map([[prop, sanValue!]])
                if (sanValue! !== stateValue) EventManager.emit('DOM:update', new Map([[prop, sanValue!]]))
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

    private static applyState(values: Map<string, string>) {
      values.forEach((value, key) => {
        const currValue = DOMManager.target.getAttribute(`data-${key}`)
        const needsUpdate = currValue !== value
        if (needsUpdate) DOMManager.target.setAttribute(`data-${key}`, value)
      })

      const resolvedMode = DOMManager.resolveMode(values)
      if (resolvedMode) DOMManager.applyResolvedMode(resolvedMode)
    }

    private static applyResolvedMode(resolvedMode: ResolvedMode) {
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

    public static get state() {
      if (!DOMManager.instance) throw new Error('DOMManager not initialized')
      return DOMManager.instance._state!
    }

    public static set state(values: Map<string, string>) {
      if (!DOMManager.instance) DOMManager.instance = new DOMManager(values)
      else {
        const currState = DOMManager.state
        const merged = Utils.merge(currState, values)

        const stateNeedsUpdate = !Utils.isSameMap(currState, merged)
        if (stateNeedsUpdate) DOMManager.instance._state = merged

        const resModeNeedsUpdate = DOMManager.resolveMode(merged) !== DOMManager.resolvedMode
        if (resModeNeedsUpdate) DOMManager.instance._resolvedMode = DOMManager.resolveMode(merged)

        DOMManager.applyState(merged)
      }
    }

    public static get resolvedMode() {
      if (!DOMManager.instance) throw new Error('DOMManager not initialized')
      return DOMManager.instance._resolvedMode!
    }
  }

  class Main {
    private static instance: UndefinedOr<Main> = undefined
    private _state: NullOr<Map<string, string>> = null

    private constructor() {
      const storageState = StorageManager.state
      this._state = storageState
      DOMManager.state = storageState

      EventManager.on('DOM:update', (values) => (Main.state = values))
      EventManager.on('Storage:update', (values) => (Main.state = values))
    }

    public static init() {
      if (!Main.instance) Main.instance = new Main()
    }

    public static get state() {
      if (!Main.instance) Main.instance = new Main()
      return Main.instance._state!
    }

    public static set state(values: Map<string, string>) {
      if (!Main.instance) Main.instance = new Main()
      else {
        const currState = Main.state
        const { values: valValues } = Validator.ofMap(values).validate(currState)
        const merged = Utils.merge(currState, valValues)

        const needsUpdate = !Utils.isSameMap(currState, merged)
        if (needsUpdate) {
          Main.instance._state = merged
          StorageManager.state = merged
          DOMManager.state = merged
          EventManager.emit('State:update', merged)
        }
      }
    }
  }

  class NextThemes {
    public static get state() {
      return Main.state
    }

    public static set state(values: Map<string, string>) {
      Main.state = values
    }

    public static subscribe(cb: (values: Map<string, string>) => void) {
      EventManager.on('State:update', cb)
    }

    public static update(prop: string, value: string) {
      NextThemes.state = new Map([[prop, value]])
    }
  }

  Main.init()
  window.NextThemes = NextThemes
}