// Keep startup diagnostics, but avoid blocking the whole app on generic
// cross-origin script errors such as "Script error." from external CDNs.
window.onerror = function (msg, source, lineno, colno, error) {
  const message = String(msg || '');
  const scriptSource = String(source || '');
  const isGenericExternalError = message === 'Script error.' || (!scriptSource && lineno === 0 && colno === 0);

  if (isGenericExternalError) {
    console.error('External script error:', { message, source: scriptSource, lineno, colno, error });
    return false;
  }

  console.error('Global startup error:', { message, source: scriptSource, lineno, colno, error });

  if (import.meta.env.DEV) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:999999;padding:20px;color:red;font-family:monospace;white-space:pre-wrap;overflow:auto;';
    div.innerHTML = `<h1>CRITICAL ERROR</h1>
    <h3>${message}</h3>
    <p>Source: ${scriptSource}:${lineno}:${colno}</p>
    <pre>${error?.stack || 'No stack trace'}</pre>`;
    document.body.appendChild(div);
  }

  return false;
};

window.onunhandledrejection = function (event) {
  console.error('Unhandled promise rejection:', event.reason);

  if (import.meta.env.DEV) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:999999;padding:20px;color:red;font-family:monospace;white-space:pre-wrap;overflow:auto;';
    div.innerHTML = `<h1>UNHANDLED PROMISE REJECTION</h1>
    <h3>${String(event.reason || '')}</h3>
    <pre>${event.reason?.stack || 'No stack trace'}</pre>`;
    document.body.appendChild(div);
  }
};

console.log('--- MAIN.TSX EXECUTING ---');

import { createRoot } from 'react-dom/client'
import './index.css'

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

async function bootstrapApp() {
  try {
    const [
      ReactModule,
      RouterModule,
      AppModule,
      AuthModule,
      PermissionsModule,
      WorkshopModule,
      ErrorBoundaryModule,
      ChatModule,
      FinancialModule,
    ] = await Promise.all([
      import('react'),
      import('react-router-dom'),
      import('./App.tsx'),
      import('./contexts/AuthContext'),
      import('./contexts/PermissionsContext'),
      import('./contexts/WorkshopContext'),
      import('./components/ErrorBoundary'),
      import('./contexts/ChatContext'),
      import('./contexts/FinancialContext'),
    ]);

    const React = ReactModule.default;
    const { BrowserRouter } = RouterModule;
    const App = AppModule.default;
    const { AuthProvider } = AuthModule;
    const { PermissionsProvider } = PermissionsModule;
    const { WorkshopProvider } = WorkshopModule;
    const { ErrorBoundary } = ErrorBoundaryModule;
    const { ChatProvider } = ChatModule;
    const { FinancialProvider } = FinancialModule;

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
    );
  } catch (error: any) {
    console.error('Bootstrap failure:', error);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="min-height:100vh;background:#0f172a;color:#e2e8f0;padding:24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
          <h1 style="font-size:22px;font-weight:800;color:#f87171;margin-bottom:12px;">Erro ao iniciar aplicacao</h1>
          <p style="margin-bottom:12px;">Foi detetado um erro durante o carregamento dos modulos.</p>
          <pre style="white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:12px;overflow:auto;">${String(error?.stack || error || 'Erro desconhecido')}</pre>
          <button onclick="window.location.reload()" style="margin-top:12px;background:#2563eb;color:white;border:0;border-radius:8px;padding:10px 14px;cursor:pointer;">Recarregar</button>
        </div>
      `;
    }
  }
}

bootstrapApp();
// Force Deploy 2026-02-02 20:50
