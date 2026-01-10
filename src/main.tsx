// CRITICAL: Global Error Trap for Debugging
window.onerror = function (msg, source, lineno, colno, error) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:999999;padding:20px;color:red;font-family:monospace;white-space:pre-wrap;overflow:auto;';
  div.innerHTML = `<h1>CRITICAL ERROR</h1>
  <h3>${msg}</h3>
  <p>Source: ${source}:${lineno}:${colno}</p>
  <pre>${error?.stack || 'No stack trace'}</pre>`;
  document.body.appendChild(div);
  return false;
};

// Trap Promise Rejections (like Supabase init failures)
window.onunhandledrejection = function (event) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:999999;padding:20px;color:red;font-family:monospace;white-space:pre-wrap;overflow:auto;';
  div.innerHTML = `<h1>UNHANDLED PROMISE REJECTION</h1>
  <h3>${event.reason}</h3>
  <pre>${event.reason?.stack || 'No stack trace'}</pre>`;
  document.body.appendChild(div);
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { AuthProvider } from './contexts/AuthContext'
import { PermissionsProvider } from './contexts/PermissionsContext'

import { WorkshopProvider } from './contexts/WorkshopContext'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WorkshopProvider>
        <AuthProvider>
          <PermissionsProvider>
            <App />
          </PermissionsProvider>
        </AuthProvider>
      </WorkshopProvider>
    </ErrorBoundary>
  </StrictMode>,
)
