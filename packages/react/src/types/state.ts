import { Prettify } from "@repo/typescript-utils/prettify";
import { Keyof } from "@repo/typescript-utils/keys";
import { Config, ExtractProps, Props, ResolvedMode } from "@next-themes/core/types/config";

export type State<Ps extends Props, C extends Config<Ps>> = Prettify<{
  [P in ExtractProps<Ps>]: C[P] extends { strategy: 'mono' }
    ? C[P]['key']
    : C[P] extends { strategy: 'multi' }
      ? C[P] extends { type: 'generic' }
        ? C[P]['keys'][number]
        : Keyof<C[P]['keys']>
      : C[P] extends { strategy: 'system' }
        ? C[P] extends { customKeys: any }
          ?
              | (C[P]['customKeys'] extends { light: string } ? C[P]['customKeys']['light'] : 'light')
              | (C[P]['customKeys'] extends { dark: string } ? C[P]['customKeys']['dark'] : 'dark')
              | (C[P]['customKeys'] extends { system: string } ? C[P]['customKeys']['system'] : 'system')
              | (C[P]['customKeys'] extends { custom: Record<string, ResolvedMode> } ? Keyof<C[P]['customKeys']['custom']> : never)
          : 'light' | 'dark' | 'system'
        : C[P] extends { strategy: 'light_dark' }
          ? C[P] extends { customKeys: any }
            ?
                | (C[P]['customKeys'] extends { light: string } ? C[P]['customKeys']['light'] : 'light')
                | (C[P]['customKeys'] extends { dark: string } ? C[P]['customKeys']['dark'] : 'dark')
                | (C[P]['customKeys'] extends { custom: Record<string, ResolvedMode> } ? Keyof<C[P]['customKeys']['custom']> : never)
            : 'light' | 'dark'
          : never
}>
