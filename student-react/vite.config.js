import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/assets/student-react/',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@student': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: '../assets/student-react',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/main.jsx'),
        'write-main': path.resolve(__dirname, 'src/write-main.jsx'),
        'teacher-main': path.resolve(__dirname, '../big_project/teacher_mode/teacher-main.jsx'),
        'profile-main': path.resolve(__dirname, 'src/profile-main.jsx'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
