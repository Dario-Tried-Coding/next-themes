'use client'

import { State } from '@next-themes/core/types'
import { PropsWithChildren, useEffect, useState } from 'react'
import { Script } from './Script'

interface ThemeProviderProps extends PropsWithChildren {}
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [state, setState] = useState<State>(null)

  useEffect(() => {
    setState(window.NextThemes.state)
    window.NextThemes.subscribe((values) => setState(values))
  })

  return (
    <>
      <Script />
      <pre>{JSON.stringify(state ? Object.fromEntries(state) : state)}</pre>
      {state && <button onClick={() => window.NextThemes.update('mode', state.get('mode') === 'light' ? 'dark' : 'light')}>mode</button>}
      {children}
    </>
  )
}
