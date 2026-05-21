import React from 'react';
import { Fornecedor } from '../types/fornecedor';
import { cn } from '../utils/cn';

interface PremiumTableProps {
  data: Fornecedor[];
}

const PremiumTable: React.FC<PremiumTableProps> = ({ data }) => {
  return (
    <div className="overflow-x-auto rounded-2xl shadow-lg card-glass mt-4">
      <table className="min-w-full text-left text-blue-100">
        <thead>
          <tr className="bg-blue-900/60">
            <th className="px-6 py-3">Nome</th>
            <th className="px-6 py-3">Categoria</th>
            <th className="px-6 py-3">Estado</th>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map((f) => (
            <tr key={f.id} className="hover:bg-blue-800/40 transition-colors">
              <td className="px-6 py-3 font-semibold">{f.nome}</td>
              <td className="px-6 py-3">{f.categoria}</td>
              <td className="px-6 py-3">
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold',
                  f.estado === 'ativo' ? 'bg-blue-700 text-blue-100' : 'bg-blue-950 text-blue-400 border border-blue-700'
                )}>
                  {f.estado}
                </span>
              </td>
              <td className="px-6 py-3">{f.email}</td>
              <td className="px-6 py-3">
                <button className="text-blue-400 hover:underline">Ver Perfil</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PremiumTable;
