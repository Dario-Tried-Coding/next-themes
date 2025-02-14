import { NextThemes } from "@next-themes/core/types";

declare global {
  interface Window {
    NextThemes: NextThemes
  }
}