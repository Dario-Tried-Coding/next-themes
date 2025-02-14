'use client'

import { Config, Props } from '@next-themes/core/types/config'
import { PropsWithChildren, useEffect, useState } from 'react'
import { Script } from './Script'
import { ScriptArgs } from '@next-themes/core/types'
import { NextThemesContext } from '../context'
import { State as MState } from '../types/state'
import { NullOr } from '@repo/typescript-utils/nullable'

interface NextThemesProviderProps<Ps extends Props, C extends Config<Ps>> extends PropsWithChildren, Omit<ScriptArgs, 'config'> {
  config: C
}
export const NextThemesProvider = <Ps extends Props, C extends Config<Ps>>({ config, observers, storageKey, children }: NextThemesProviderProps<Ps, C>) => {
  const [state, setState] = useState<NullOr<MState<Ps, C>>>(null)

  useEffect(() => {
    setState(Object.fromEntries(window.NextThemes.state) as MState<Ps, C>)
    window.NextThemes.subscribe((values) => setState(Object.fromEntries(values) as MState<Ps, C>))
  }, [])

  const updateState: NextThemesContext<Ps, C>['updateState'] = (prop, value) => {
    const currValue = state?.[prop]
    const newValue = typeof value === 'function' ? (value as (currValue: MState<Ps, C>[typeof prop] | undefined) => MState<Ps, C>[typeof prop])(currValue) : value
    window.NextThemes.update(prop, newValue)
  }

  return (
    <NextThemesContext.Provider value={{ state, updateState }}>
      <Script scriptArgs={{ storageKey, config, observers }} />
      {children}
    </NextThemesContext.Provider>
  )
}
