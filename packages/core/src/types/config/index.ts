import { UndefinedOr } from '@repo/typescript-utils/nullable'
import { GenericMono, GenericMulti, GenericProp } from './generic'
import { ModeMono, ModeMulti, ModeProp, ModeSystem } from './mode'
import { ExplicitProp, Props, SystemValues } from './props'

export type { Props } from './props'

export type ExtractProps<Ps extends Props> = Ps[number] extends infer U ? (U extends string ? U : U extends ExplicitProp ? U['prop'] : never) : never
type ResolveProp<P extends Props[number]> = P extends ExplicitProp
  ? P['values'] extends string
    ? GenericMono<P['values']> | ModeMono<P['values']>
    : P['values'] extends string[]
      ? GenericMulti<P['values']> | ModeMulti<P['values']>
      : P['values'] extends SystemValues
        ? ModeSystem<P['values']>
        : never
  : GenericMono<'default'> | ModeMono<'default'> | ModeSystem<{}>

export type Config<Ps extends UndefinedOr<Props> = undefined> = Ps extends Props
  ? {
      [P in ExtractProps<Ps>]: ResolveProp<Extract<Ps[number], { prop: P } | P>>
    }
  : {
      [key: string]: GenericProp | ModeProp
    }

export type { ResolvedMode } from './mode'
