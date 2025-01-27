import { CssSelector, ModeProp, ResolvedMode } from "./config/mode"
import { NullOr } from "./utils"

export type ScriptArgs = {
  keys: {
    stateSK: string
    modeSK: string
  }
  constraints: Record<string, { allowed: string[]; fallback: string }>
  modeHandling: NullOr<{ prop: string; stratObj: ModeProp; resolvedModes: Record<string, ResolvedMode>; selectors: CssSelector[]; store: boolean }>
}