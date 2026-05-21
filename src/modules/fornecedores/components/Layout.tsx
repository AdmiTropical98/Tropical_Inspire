import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fornecedores-root flex h-screen w-screen bg-blue-950">
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar />
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-950/80 to-blue-900/80 p-0">
        {children}
      </main>
    </div>
  </div>
);

export default Layout;
