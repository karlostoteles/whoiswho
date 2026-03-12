import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', '@react-three/fiber'],
  },
  plugins: [
    react(),
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
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
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
