import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import Fornecedores from './Fornecedores';
import Requisicoes from './Requisicoes';
import Pagamentos from './Pagamentos';
import Documentos from './Documentos';
import Relatorios from './Relatorios';
import Configuracoes from './Configuracoes';
import FornecedoresLogin from './Login';

const FornecedoresRoutes: React.FC = () => (
  <Router basename="/fornecedores">
    <Routes>
      <Route path="/login" element={<FornecedoresLogin />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/fornecedores" element={<Fornecedores />} />
      <Route path="/requisicoes" element={<Requisicoes />} />
      <Route path="/pagamentos" element={<Pagamentos />} />
      <Route path="/documentos" element={<Documentos />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Router>
);

export default FornecedoresRoutes;
