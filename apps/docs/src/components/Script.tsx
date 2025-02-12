import { script } from '@next-themes/core'
import {ScriptArgs} from '@next-themes/core/types'

export const Script = () => {
  const scriptArgs = JSON.stringify({
    config: {
      mode: {
        type: 'mode',
        strategy: 'system',
        base: 'system',
        fallback: 'light',
        selector: 'colorScheme',
        store: true,
      },
    },
    observers: ['DOM-attrs', 'storage'],
  } as const satisfies ScriptArgs)

  return <script dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${scriptArgs})` }} />
}