import React from 'react';

const Pagamentos: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-200 mb-4">Pagamentos</h1>
      {/* Gráficos, lista, exportação, mock data */}
      <div className="bg-blue-900/80 rounded-2xl shadow-lg p-6 backdrop-blur-md border border-blue-700/40">
        <span className="text-blue-400 text-lg font-semibold">Pagamentos</span>
        {/* Mock de pagamentos */}
      </div>
    </div>
  );
};

export default Pagamentos;
