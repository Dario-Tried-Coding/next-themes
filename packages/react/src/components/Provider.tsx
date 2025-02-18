'use client'

import { ScriptArgs } from '@next-themes/core/types'
import { Config, Props } from '@next-themes/core/types/config'
import { NullOr } from '@repo/typescript-utils/nullable'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { NextThemesContext } from '../context'
import { State as MState } from '../types/state'
import { Script } from './Script'

interface NextThemesProviderProps<Ps extends Props, C extends Config<Ps>> extends PropsWithChildren, ScriptArgs {
  config: C
}
export const NextThemesProvider = <Ps extends Props, C extends Config<Ps>>({ children, ...scriptArgs }: NextThemesProviderProps<Ps, C>) => {
  const [state, setState] = useState<NullOr<MState<Ps, C>>>(null)
  const options = useRef<NextThemesContext<Ps, C>['options']>({} as NextThemesContext<Ps, C>['options'])

  useEffect(() => {
    setState(Object.fromEntries(window.NextThemes.state) as MState<Ps, C>)
    options.current = Object.fromEntries(Array.from(window.NextThemes.options.entries(), ([key, { options }]) => [key, Array.from(options)])) as NextThemesContext<Ps, C>['options']
    window.NextThemes.subscribe((values) => setState(Object.fromEntries(values) as MState<Ps, C>))
  }, [])

  const updateState: NextThemesContext<Ps, C>['updateState'] = (prop, value) => {
    const currValue = state?.[prop]
    const newValue = typeof value === 'function' ? (value as (currValue: MState<Ps, C>[typeof prop] | undefined) => MState<Ps, C>[typeof prop])(currValue) : value
    window.NextThemes.update(prop, newValue)
  }

  return (
    <NextThemesContext.Provider value={{ state, updateState, options: options.current }}>
      <Script scriptArgs={scriptArgs} />
      {children}
    </NextThemesContext.Provider>
  )
}
