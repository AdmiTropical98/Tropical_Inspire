import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, CreditCard, FileBarChart2, FileStack, Settings } from 'lucide-react';

const menu = [
  { to: '/', label: 'Visão Geral', icon: <Home size={20} /> },
  { to: '/fornecedores', label: 'Fornecedores', icon: <Users size={20} /> },
  { to: '/requisicoes', label: 'Requisições', icon: <FileText size={20} /> },
  { to: '/pagamentos', label: 'Pagamentos', icon: <CreditCard size={20} /> },
  { to: '/documentos', label: 'Documentos', icon: <FileStack size={20} /> },
  { to: '/relatorios', label: 'Relatórios', icon: <FileBarChart2 size={20} /> },
  { to: '/configuracoes', label: 'Configurações', icon: <Settings size={20} /> },
];

const Sidebar: React.FC = () => (
  <aside className="h-screen w-64 bg-gradient-to-b from-blue-950/90 to-blue-900/80 border-r border-blue-800/40 shadow-xl flex flex-col py-6 px-4">
    <div className="mb-8 flex items-center gap-2">
      <span className="text-2xl font-bold text-blue-400 text-glow">Fornecedores</span>
    </div>
    <nav className="flex-1 flex flex-col gap-2">
      {menu.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-blue-200 hover:bg-blue-800/60 ${isActive ? 'bg-blue-800/80 text-blue-400' : ''}`
          }
          end
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);

export default Sidebar;
