import { createRoot } from 'react-dom/client';
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import FornecedoresLogin from './pages/FornecedoresERP/FornecedoresLogin';
import FornecedoresModule from './pages/FornecedoresERP/FornecedoresModule';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

function FornecedoresApp() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<FornecedoresLogin />} />
          <Route path="/*" element={<FornecedoresModule />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(<FornecedoresApp />);
