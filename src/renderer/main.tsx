import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'

window.addEventListener('error', (event) => {
  console.error('[Global window error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global unhandled rejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

