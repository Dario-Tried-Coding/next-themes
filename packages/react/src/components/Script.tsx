import { script } from '@next-themes/core'
import type { ScriptArgs } from '@next-themes/core/types'
import { ScriptHTMLAttributes } from 'react'

interface ScriptProps extends Omit<ScriptHTMLAttributes<HTMLScriptElement>, 'nonce'> {
  scriptArgs: ScriptArgs
}
export const Script = ({ scriptArgs: provScriptArgs, ...props }: ScriptProps) => {
  const scriptArgs = JSON.stringify(provScriptArgs)
  return <script nonce={provScriptArgs.nonce} dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${scriptArgs})` }} {...props} />
}
