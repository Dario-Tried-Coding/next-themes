import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/types/index.ts', 'src/types/config/index.ts'],
  // entry: {
  //   index: 'src/index.ts',
  //   types: 'src/types/index.ts',
  //   'types/config': 'src/types/config/index.ts',
  // },
  sourcemap: false,
  minify: true,
  dts: true,
  clean: true,
  format: ['esm', 'cjs'],
  splitting: false,
  bundle: true,
})