import { ScriptArgs } from './types'
import { Nullable, NullOr } from './types/utils'

export function script({ storageKey, constraints: provConstraints, modeHandling, listeners, defaults }: ScriptArgs) {
  const stateSK = storageKey ?? defaults.keys.stateSK

  const modeSK = modeHandling?.storageKey ?? defaults.keys.modeSK
  const storeMode = !!modeHandling ? (modeHandling.store ?? defaults.modeHandling.store) : false

  const utils = {
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

  const modeConstraints = modeHandling ? { allowed: modeHandling.constraints.allowed.map(({ key }) => key), preferred: modeHandling.constraints.preferred } : undefined
  const mergedConstraints = { ...provConstraints, ...(modeHandling ? { [modeHandling.prop]: modeConstraints! } : {}) }
  const constraints = new Map(Object.entries(mergedConstraints).map(([key, { allowed, ...rest }]) => [key, { allowed: new Set(allowed), ...rest }]))

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
      const isHandled = constraints.has(prop)
      const isAllowed = isHandled && !!value ? constraints.get(prop)!.allowed.has(value) : false
      const isAllowedFallback = isHandled && !!fallback ? constraints.get(prop)!.allowed.has(fallback) : false

      const preferred = isHandled ? constraints.get(prop)!.preferred : undefined
      const valValue = !isHandled ? undefined : isAllowed ? value : isAllowedFallback ? (fallback as NonNullable<typeof fallback>) : preferred

      return { passed: isHandled && isAllowed, value: valValue }
    }

    validate(fallbacks?: Map<string, string>): TState extends 'initialized' ? { passed: boolean; values: Map<string, string>; results: Map<string, { passed: boolean; value: string }> } : never
    validate(fallbacks?: Map<string, string>) {
      const results: Map<string, { passed: boolean; value: string }> = new Map()
      const sanValues: Map<string, string> = new Map()

      for (const [prop, { preferred }] of constraints.entries()) {
        results.set(prop, { passed: false, value: undefined as unknown as string })
        sanValues.set(prop, preferred)
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

  class StorageManager {
    #_state: NullOr<Map<string, string>> = null
    #_mode: Nullable<string> = modeHandling ? null : undefined

    constructor() {
      this.#init()
    }

    #retrieve(key: string) {
      return localStorage.getItem(key)
    }

    #store(key: string, value: string) {
      const needsUpdate = this.#retrieve(key) !== value
      if (needsUpdate) localStorage.setItem(key, value)
    }

    #init() {
      const retrievedState = this.#retrieve(stateSK)
      const { values: valValues } = Validator.ofJSON(retrievedState).validate()
      this.#_state = valValues
    }

    get state(): NullOr<Map<string, string>> {
      return this.#_state
    }

    set state(values: Map<string, string>) {
      const newState = new Map([...(this.#_state ? this.#_state : []), ...values])
      this.#store(stateSK, utils.mapToJson(newState))
    }
  }

  class StateManager {
    #_state: NullOr<Map<string, string>> = null

    get state(): NullOr<Map<string, string>> {
      return this.#_state
    }

    set state(values: Map<string, string>) {
      const { values: valValues } = Validator.ofMap(values).validate()
      const newState = new Map([...(this.#_state ? this.#_state : []), ...valValues])
      this.#_state = newState
    }
  }
}
