import { CssSelector } from "./types/config/mode";
import { Listener } from "./types/script";

export const DEFAULTS = {
  keys: {
    stateSK: 'next-themify',
    modeSK: 'theme',
  },
  modeHandling: {
    store: false,
    cssSelector: [] as const satisfies CssSelector[]
  },
  listener: [] as const satisfies Listener[] 
} as const

export type DEFAULTS = typeof DEFAULTS