import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            {
              name: 'pdf-renderer',
              test: /node_modules[\\/]@react-pdf[\\/](renderer|reconciler|layout|pdfkit)/,
              priority: 3,
            },
            {
              name: 'pdf-font-engine',
              test: /node_modules[\\/](fontkit|unicode-properties|unicode-trie|linebreak|brotli|dfa|hyphenation|yoga-layout)/,
              priority: 2,
            },
            {
              name: 'pdf-support',
              test: /node_modules[\\/]@react-pdf/,
              priority: 1,
            },
          ],
        },
      },
    },
  }
})
