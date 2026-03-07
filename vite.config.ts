import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  // Required for @aztec/bb.js: prevents Vite from rewriting worker URLs inside the WASM bundle
  optimizeDeps: {
    exclude: [
      '@aztec/bb.js',
      '@dojoengine/torii-client',
      '@noir-lang/noir_js',
      '@noir-lang/acvm_js',
      '@noir-lang/noirc_abi',
    ],
    include: ['@aztec/bb.js > pino'],
  },
  // Required for SharedArrayBuffer (multi-threaded WASM in bb.js proof generation)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Proxy Torii gRPC-web requests through Vite to avoid CORS/COEP conflicts.
    // COEP require-corp blocks cross-origin fetches to Torii; same-origin proxy bypasses this.
    proxy: {
      '/world.World': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'cartridge': ['@cartridge/controller'],
          'starknet': ['starknet', 'starkzap'],
          'react-vendor': ['react', 'react-dom', 'framer-motion'],
        },
      },
    },
  },
})
