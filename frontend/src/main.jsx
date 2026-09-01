import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted variable font: one woff2 bundled by Vite, so the container needs
// no request to Google Fonts and works offline.
import '@fontsource-variable/inter'

import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
