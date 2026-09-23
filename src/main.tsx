import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { applyAccessCodeFromUrl } from './lib/accessToken'

// Frictionless committee/judging access (go-live, 2026-09-22): if the URL
// carries an access code (a judge's link — see accessToken.ts), seed it
// into sessionStorage and strip it from the address bar BEFORE React
// mounts, so the access gate never prompts a judge and the first AI call
// already carries the code. A no-op when there is no `access` param (every
// normal visit), so demo/volunteer behaviour is completely unchanged.
applyAccessCodeFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
