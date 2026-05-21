import React from 'react';
import { UserCircle } from 'lucide-react';

const Topbar: React.FC = () => (
  <header className="w-full h-16 bg-blue-950/80 flex items-center justify-between px-8 shadow-md border-b border-blue-800/40">
    <div className="text-lg font-semibold text-blue-200">ALGARTEMPO ENTERPRISE</div>
    <div className="flex items-center gap-4">
      <span className="text-blue-300">Olá, Usuário</span>
      <UserCircle size={28} className="text-blue-400" />
    </div>
  </header>
);

export default Topbar;
