import { Config, Props } from '@next-themes/core/types/config'
import { Prettify } from '@repo/typescript-utils/prettify'
import { State } from './state'

export type Options<Ps extends Props, C extends Config<Ps>, S extends State<Ps, C>> = Prettify<{
  [P in keyof S]: S[P][]
}>