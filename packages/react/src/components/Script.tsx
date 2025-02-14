import { script } from '@next-themes/core'
import type { ScriptArgs } from '@next-themes/core/types'

interface ScriptProps {
  scriptArgs: ScriptArgs
}
export const Script = ({ scriptArgs: provScriptArgs }: ScriptProps) => {
  const scriptArgs = JSON.stringify(provScriptArgs)
  return <script dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${scriptArgs})` }} />
}
