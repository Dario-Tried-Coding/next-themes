import { script } from '@next-themes/core'

export const Script = () => {
  return <script dangerouslySetInnerHTML={{ __html: `(${script.toString()})()` }} />
}
