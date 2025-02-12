import { NextThemes } from "./script"

declare global {
  interface Window {
    NextThemes: typeof NextThemes
  }
}

export {}
