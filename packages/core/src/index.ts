import { ResolvedMode } from './types/config/mode'
import { ScriptArgs } from './types/script'
import { Nullable, NullOr, UndefinedOr } from './types/utils'

export function script({ keys: { stateSK, modeSK }, constraints: provConstraints, modeHandling, listeners }: ScriptArgs) {
  const constraints = new Map(Object.entries(provConstraints).map(([key, { allowed, ...rest }]) => [key, { allowed: new Set(allowed), ...rest }]))

  const utils = {
    jsonToMap(json: NullOr<string>) {
      if (!json?.trim()) return new Map()
      try {
        const parsed = JSON.parse(json)
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return new Map()
        const entries = Object.entries(parsed).filter(([key, value]) => typeof key === 'string' && typeof value === 'string') as [string, string][]
        return new Map(entries)
      } catch {
        return new Map()
      }
    },
    mapToJson(map: Map<string, string>) {
      return JSON.stringify(Object.fromEntries(map))
    },
    isSameObj(obj1: Record<string, string>, obj2: Record<string, string>) {
      if (obj1 === obj2) return true

      const keys1 = Object.keys(obj1)
      const keys2 = Object.keys(obj2)

      if (keys1.length !== keys2.length) return false

      for (const key of keys1) {
        if (!keys2.includes(key) || obj1[key] !== obj2[key]) return false
      }

      return true
    },
    getSystemPref() {
      const supportsPref = window.matchMedia('(prefers-color-scheme)').media !== 'not all'
      return supportsPref ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : undefined
    },
  }

  const validation = {
    validateValue(prop: string, value: string, fallback?: string) {
      const isHandled = constraints.has(prop)
      const isAllowed = isHandled && !!value ? constraints.get(prop)!.allowed.has(value) : false
      const isAllowedFallback = isHandled && !!fallback ? constraints.get(prop)!.allowed.has(fallback) : false

      const preferred = isHandled ? constraints.get(prop)!.preferred : undefined
      const valValue = !isHandled ? undefined : isAllowed ? value : isAllowedFallback ? (fallback as NonNullable<typeof fallback>) : preferred

      return { passed: isHandled && isAllowed, value: valValue }
    },
    validateValues(values: Map<string, string>, fallbacks?: Map<string, string>) {
      const results: Map<string, { passed: boolean; value: string }> = new Map()
      const sanValues: Map<string, string> = new Map()

      for (const [prop, { preferred }] of constraints.entries()) {
        results.set(prop, { passed: false, value: undefined as unknown as string })
        sanValues.set(prop, preferred)
      }

      for (const [prop, fallback] of fallbacks?.entries() ?? []) {
        const { passed, value: sanValue } = this.validateValue(prop, fallback)
        results.set(prop, { passed, value: fallback })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      for (const [prop, value] of values.entries()) {
        const { passed, value: sanValue } = this.validateValue(prop, value, fallbacks?.get(prop))
        results.set(prop, { passed, value })
        if (sanValue) sanValues.set(prop, sanValue)
      }

      const passed = Object.values(results).every(({ passed }) => passed)

      return { passed, values: sanValues, results }
    },
  }
  
  class StateManager {
    private static instance: StateManager
    private _state: NullOr<Map<string, string>> = null

    private constructor() {}

    public static getInstance(): StateManager {
      if (!StateManager.instance) {
        StateManager.instance = new StateManager()
      }
      return StateManager.instance
    }

    get state(): StateManager['_state'] {
      return this._state
    }

    set state(value: NonNullable<StateManager['_state']>) {
      const newState = new Map([...(this._state ? this._state : []), ...value])
      this._state = newState
    }

    get mode(): UndefinedOr<{ prop: string; value: string }> {
      if (!modeHandling) return undefined

      const { prop } = modeHandling
      const value = this._state?.get(prop) as NonNullable<ReturnType<NonNullable<StateManager['_state']>['get']>>
      return { prop, value }
    }

    set mode(value: string) {
      if (!modeHandling) return

      const { prop } = modeHandling
      this.state = new Map([[prop, value]])
    }
  }
  
  class StorageManager {
    get state(): NullOr<string> {
      return localStorage.getItem(stateSK)
    }

    set state(value: string) {
      const isStored = value === this.state
      if (!isStored) localStorage.setItem(stateSK, value)

      const mode = utils.jsonToMap(value).get(modeHandling?.prop) as string
      const isSet = mode === this.mode
      if (mode && modeHandling?.store && !isSet) this.mode = mode
    }
    
    get mode(): Nullable<string> {
      if (!modeHandling?.store) return
      return localStorage.getItem(modeSK)
    }

    set mode(value: string) {
      if (!modeHandling?.store) return

      const isStored = value === this.mode
      if (!isStored) localStorage.setItem(modeSK, value)

      const isSet = utils.jsonToMap(this.state).get(modeHandling?.prop) === value
      const mappedValue = new Map([[modeHandling?.prop, value]])
      if (!isSet) this.state = utils.mapToJson(mappedValue)
    }
  }

  class DOMManager {
    private target = document.documentElement

    #deriveRM(mode: string) {
      if (!modeHandling) return
      const { stratObj, resolvedModes } = modeHandling

      const isSystemMode = stratObj.strategy === 'system' && stratObj.enableSystem && mode === (stratObj.customKeys?.system ?? 'system')
      if (isSystemMode) return utils.getSystemPref() ?? resolvedModes[stratObj.fallback]

      return resolvedModes[mode]
    }

    #setCS(RM: ResolvedMode) {
      const isSet = this.target.style.colorScheme === RM
      if (!isSet) this.target.style.colorScheme = RM
    }

    #setMC(RM: ResolvedMode) {
      const isSet = this.target.classList.contains('light') ? 'light' : this.target.classList.contains('dark') ? 'dark' : undefined
      if (isSet === RM) return

      const other = RM === 'light' ? 'dark' : 'light'
      this.target.classList.replace(other, RM) || this.target.classList.add(RM)
    }

    public setAttr(prop: string, value: string) {
      const isSet = this.target.getAttribute(`data-${prop}`) === value
      if (isSet) return

      this.target.setAttribute(`data-${prop}`, value)

      const isModeAttr = modeHandling?.prop === prop
      if (!isModeAttr) return

      const RM = this.#deriveRM(value) as ResolvedMode
      if (modeHandling?.selectors.includes('colorScheme')) this.#setCS(RM)
      if (modeHandling?.selectors.includes('class')) this.#setMC(RM)
    }

    setAttrs(values: Map<string, string>) {
      for (const [prop, value] of values.entries()) this.setAttr(prop, value)
    }
  }

  class NextThemes {
    #stateManager = StateManager.getInstance()
    #storageManager = new StorageManager()
    #domManager = new DOMManager()

    private static instance: NextThemes

    private constructor() {
      this.#init()
    }

    public static getInstance(): NextThemes {
      if (!NextThemes.instance) {
        NextThemes.instance = new NextThemes()
      }
      return NextThemes.instance
    }

    #init() {
      const { values } = validation.validateValues(utils.jsonToMap(this.#storageManager.state))

      this.#storageManager.state = utils.mapToJson(values)
      this.#stateManager.state = values
      this.#domManager.setAttrs(values)

      if (listeners.includes('storage')) {
        window.addEventListener('storage', ({ oldValue, newValue, key }) => {
          if (key === stateSK) {
            const oldValues = utils.jsonToMap(oldValue)
            const newValues = utils.jsonToMap(newValue)
            const { values } = validation.validateValues(newValues, oldValues)

            this.#storageManager.state = utils.mapToJson(values)
            this.#stateManager.state = values
            this.#domManager.setAttrs(values)
          }

          if (key === modeSK && modeHandling?.store) {
            const { value } = validation.validateValue(modeHandling?.prop, newValue ?? '', oldValue ?? '')
            if (!value) return

            this.#storageManager.mode = value
            this.#stateManager.mode = value
            this.#domManager.setAttr(modeHandling.prop, value)
          }
        })
      }
    }

    public test() {
      console.log('test')
    }
  }

  const instance = NextThemes.getInstance()
  window.nextThemes = {
    test: instance.test,
  }
}
