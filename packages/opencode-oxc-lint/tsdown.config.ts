import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'esnext',
  dts: true,
  clean: true,
  sourcemap: true,
  // @opencode-ai/* 由 opencode 运行时注入，不打包进产物
  deps: {
    neverBundle: [/^@opencode-ai/],
  },
})
