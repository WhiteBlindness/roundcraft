import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cloudflare(
      command === 'serve'
        ? {
            config: {
              vars: { APP_ENV: 'local' },
            },
          }
        : {},
    ),
  ],
}))
