// Centralized API configuration
// This is the ONLY place where the agent URL should be accessed
// The actual URL is defined in vite.config.ts as AGENT_URL

// Use the variable from vite.config.ts (via import.meta.env) or environment variable
// In production, set VITE_API_BASE_URL=http://your-agent-url:8000
export const API_BASE_URL = import.meta.env.VITE_AGENT_URL || import.meta.env.VITE_API_BASE_URL || ''

// For WebSocket connections (if needed)
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 
  (API_BASE_URL ? 
    API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://') : 
    '')

