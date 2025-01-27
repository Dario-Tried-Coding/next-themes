import { script } from '@next-themes/core'
import {ScriptArgs} from '@next-themes/core/types'

export const Script = () => {
  const scriptArgs = JSON.stringify({
    constraints: {
      mode: {
        allowed: ['light', 'dark', 'system'],
        fallback: 'light',
      }
    },
    modeHandling: {
      prop: 'mode',
      stratObj: {
        type: 'mode',
        strategy: 'system',
        enableSystem: true,
        preferred: 'system',
        fallback: 'light'
      },
      resolvedModes: {
        light: 'light',
        dark: 'dark'
      },
      selectors: ['colorScheme'],
      store: true
    },
    keys: {
      stateSK: 'next-themes',
      modeSK: 'theme'
    }
  } as const satisfies ScriptArgs)

  return <script dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${scriptArgs})` }} />
}
