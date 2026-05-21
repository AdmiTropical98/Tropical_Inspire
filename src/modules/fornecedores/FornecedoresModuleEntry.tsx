import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { FornecedoresProvider } from './context/FornecedoresContext';
import Pages from './pages';
import '../fornecedores/styles/fornecedores-theme.css';

const FornecedoresModuleEntry: React.FC = () => (
  <FornecedoresProvider>
    <Router basename="/fornecedores">
      <Pages />
    </Router>
  </FornecedoresProvider>
);

export default FornecedoresModuleEntry;
