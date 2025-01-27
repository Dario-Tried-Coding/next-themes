import { ScriptArgs } from './types/script'
import { NullOr } from './types/utils'

export function script({ keys: { stateSK, modeSK } }: ScriptArgs) {
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
  }

  class StorageManager {
    private stateSK = stateSK
    private modeSK = modeSK
  }

  class NextThemes {
    private stateManager = StateManager.getInstance()

    public init() {
      console.log('NextThemes initialized')
    }
  }

  window.NextThemes = new NextThemes()
  window.NextThemes.init()
}
