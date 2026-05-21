import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-200 mb-4">Dashboard Fornecedores</h1>
      {/* Cards, gráficos e KPIs aqui */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Exemplo de card */}
        <div className="bg-gradient-to-br from-blue-900/80 to-blue-800/60 rounded-2xl shadow-lg p-6 backdrop-blur-md border border-blue-700/40">
          <span className="text-blue-400 text-lg font-semibold">Total Fornecedores</span>
          <div className="text-4xl font-bold text-white mt-2">32</div>
        </div>
        {/* Outros cards... */}
      </div>
      {/* Gráficos e tabelas mockados */}
    </div>
  );
};

export default Dashboard;
