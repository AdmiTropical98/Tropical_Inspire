import React from 'react';
import PremiumTable from '../components/PremiumTable';
import { mockFornecedores } from '../services/mockFornecedores';

const Fornecedores: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-200 mb-4">Gestão de Fornecedores</h1>
      <PremiumTable data={mockFornecedores} />
    </div>
  );
};

export default Fornecedores;
