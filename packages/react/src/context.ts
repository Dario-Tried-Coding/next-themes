'use client'

import { Config, Props } from '@next-themes/core/types/config'
import { State } from './types/state'
import { Context, createContext, useContext } from 'react'
import { NullOr } from '@repo/typescript-utils/nullable'
import { Options } from './types/options'

export type NextThemesContext<Ps extends Props, C extends Config<Ps>> = {
  state: NullOr<State<Ps, C>>
  updateState: <P extends keyof State<Ps, C>>(prop: P, value: State<Ps, C>[P] | ((curr: State<Ps, C>[P]) => State<Ps, C>[P])) => void
  options: Options<Ps, C, State<Ps, C>>
}
export const NextThemesContext = createContext<NullOr<NextThemesContext<any, any>>>(null)

export const useNextThemes = <Ps extends Props, C extends Config<Ps>>() => {
  const context = useContext(NextThemesContext as Context<NullOr<NextThemesContext<Ps, C>>>)
  if (!context) throw new Error('useNextThemes must be used within a NextThemesProvider')
  return context
}