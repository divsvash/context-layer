import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('app/main/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('app/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      sourcemap: true,
    },
  },
  renderer: {
    root: resolve('app/renderer'),
    plugins: [react()],
    build: {
      sourcemap: true,
    },
  },
});