import { Config, Props } from '@next-themes/react/types'
import { NextThemesProvider, useNextThemes } from '@next-themes/react'
import { FC, PropsWithChildren } from 'react'

const props = ['mode', { prop: 'radius', values: ['0.5', '1'] }] as const satisfies Props
type TProps = typeof props

const config = {
  mode: {
    type: 'mode',
    strategy: 'system',
    base: 'system',
    fallback: 'dark',
    selector: 'colorScheme',
    store: true
  },
  radius: {
    type: 'generic',
    strategy: 'multi',
    base: '1',
    keys: ['0.5', '1'],
  },
} as const satisfies Config<TProps>
type TConfig = typeof config

export const ThemingProvider: FC<PropsWithChildren> = ({ children }) => (
  <NextThemesProvider<TProps, TConfig> config={config} observers={['DOM-attrs', 'storage']}>
    {children}
  </NextThemesProvider>
)
export const useTheming = useNextThemes<TProps, TConfig>
