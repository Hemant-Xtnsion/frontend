import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Centralized agent URL - change this ONE variable to update all proxy targets
const AGENT_URL = process.env.VITE_API_BASE_URL || 'https://my-app-agent.onrender.com'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      // HTTP requests go directly to agent service
      // All proxies use the centralized AGENT_URL variable above
      '/chat': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/diag': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/availability': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/feedback': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/close-session': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/evaluation': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/logs': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/knowledge-gap': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/sentiment': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/tickets': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/upload-promotional-data': {
        target: AGENT_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: AGENT_URL.replace('http://', 'ws://').replace('https://', 'wss://'),
        ws: true,
        changeOrigin: true,
      }
    }
  },
  // Make AGENT_URL available globally in the app via import.meta.env
  define: {
    'import.meta.env.VITE_AGENT_URL': JSON.stringify(AGENT_URL),
  }
})
