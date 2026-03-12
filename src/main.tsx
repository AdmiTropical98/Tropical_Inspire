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

console.log('--- MAIN.TSX EXECUTING ---');

import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { PermissionsProvider } from './contexts/PermissionsContext'
import { WorkshopProvider } from './contexts/WorkshopContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ChatProvider } from './contexts/ChatContext'
import { FinancialProvider } from './contexts/FinancialContext'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.warn('Unable to unregister service workers in dev:', error));

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch((error) => console.warn('Unable to clear cache storage in dev:', error));
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.warn('Unable to unregister stale service workers in prod:', error));

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch((error) => console.warn('Unable to clear cache storage in prod:', error));
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <WorkshopProvider>
      <FinancialProvider>
        <AuthProvider>
          <PermissionsProvider>
            <ChatProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ChatProvider>
          </PermissionsProvider>
        </AuthProvider>
      </FinancialProvider>
    </WorkshopProvider>
  </ErrorBoundary>,
)
// Force Deploy 2026-02-02 20:50
