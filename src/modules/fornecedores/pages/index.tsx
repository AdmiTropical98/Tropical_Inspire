import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import Dashboard from './Dashboard';
import Fornecedores from './Fornecedores';
import Requisicoes from './Requisicoes';
import Pagamentos from './Pagamentos';
import Documentos from './Documentos';
import Relatorios from './Relatorios';
import Configuracoes from './Configuracoes';

const Pages: React.FC = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/fornecedores" element={<Fornecedores />} />
      <Route path="/requisicoes" element={<Requisicoes />} />
      <Route path="/pagamentos" element={<Pagamentos />} />
      <Route path="/documentos" element={<Documentos />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
    </Routes>
  </Layout>
);

export default Pages;
