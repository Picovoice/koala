import { fileURLToPath, URL } from "node:url";
import path from "path";

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { base64 } from "@picovoice/web-utils/plugins";

const pkg = require('./package.json');

function capitalizeFirstLetter(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const iifeBundleName = pkg.name
  .split('@picovoice/')[1]
  .split('-')
  .map((word: string) => capitalizeFirstLetter(word))
  .join('');

export default defineConfig({
  plugins: [dts()],
  build: {
    rollupOptions: {
      input: [path.resolve(__dirname, pkg.entry)],
      output: [
        {
          file: path.resolve(__dirname, pkg.module),
          format: 'esm',
          sourcemap: false,
        },
        {
          file: path.resolve(__dirname, 'dist', 'esm', 'index.min.js'),
          format: 'esm',
          sourcemap: false,
        },
        {
          file: path.resolve(__dirname, pkg.iife),
          format: 'iife',
          name: iifeBundleName,
          sourcemap: false,
        },
        {
          file: path.resolve(__dirname, 'dist', 'iife', 'index.min.js'),
          format: 'iife',
          name: iifeBundleName,
          sourcemap: false,
        },
      ],
      plugins: [
        base64({
          include: ['./lib/**/*.wasm']
        })
      ]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./lib", import.meta.url)),
    }
  },
  optimizeDeps: {
    exclude: ["@/"]
  }
});
