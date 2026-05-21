// Entry point for the Fornecedores module
import React from 'react';
import { FornecedoresProvider } from './context/FornecedoresContext';
import FornecedoresRoutes from './pages/Routes';
import '../styles/fornecedores-theme.css';

const FornecedoresModule: React.FC = () => (
  <FornecedoresProvider>
    <FornecedoresRoutes />
  </FornecedoresProvider>
);

export default FornecedoresModule;
