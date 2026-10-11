import { defineConfig } from 'vite'
import icmsTheme from './build/vite-plugin-icms-theme/index.js'

export default defineConfig({
    plugins: [
        icmsTheme({
            entries: ['js/theme.js'],
            exclude: ['index.html'],
        }),
    ],
})
