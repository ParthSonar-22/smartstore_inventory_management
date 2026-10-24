import { defineConfig } from 'vite';

export default defineConfig({
  // base './' ensures asset paths work with file:// in Android WebView
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
