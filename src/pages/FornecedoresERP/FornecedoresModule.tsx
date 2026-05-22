import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileText,
  HandshakeIcon,
  LayoutDashboard,
  LogOut,
  Star,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './fornecedores-erp-theme.css';
import FornecedoresDashboard from './pages/FornecedoresDashboard';
import FornecedoresGestao from './pages/FornecedoresGestao';
import FornecedorPerfil from './pages/FornecedorPerfil';
import FornecedoresRequisicoes from './pages/FornecedoresRequisicoes';
import FornecedoresPagamentos from './pages/FornecedoresPagamentos';
import FornecedoresDocumentos from './pages/FornecedoresDocumentos';
import FornecedoresRelatorios from './pages/FornecedoresRelatorios';

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/fornecedores-erp/dashboard' },
  { key: 'gestao', label: 'Fornecedores', icon: Building2, path: '/fornecedores-erp/gestao' },
  { key: 'requisicoes', label: 'Requisições', icon: ClipboardList, path: '/fornecedores-erp/requisicoes' },
  { key: 'pagamentos', label: 'Pagamentos', icon: CreditCard, path: '/fornecedores-erp/pagamentos' },
  { key: 'documentos', label: 'Documentos', icon: FileText, path: '/fornecedores-erp/documentos' },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3, path: '/fornecedores-erp/relatorios' },
];

function getPageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((n) => pathname.startsWith(n.path));
  if (item) return item.label;
  if (pathname.includes('/perfil/')) return 'Perfil do Fornecedor';
  return 'Fornecedores ERP';
}

export default function FornecedoresModule() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path))?.key ?? '';
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="ferp-shell">
      {/* Background glow */}
      <div className="ferp-glow-bg" />

      {/* ===== SIDEBAR ===== */}
      <aside className="ferp-sidebar" style={{ width: collapsed ? 60 : undefined, minWidth: collapsed ? 60 : undefined }}>
        {/* Brand */}
        <button
          className="ferp-sidebar-brand"
          onClick={() => navigate('/fornecedores-erp/dashboard')}
          type="button"
        >
          <div className="ferp-sidebar-brand-icon">
            <HandshakeIcon className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="ferp-sidebar-brand-text">
              <span className="ferp-sidebar-brand-name">FORNECEDORES</span>
              <span className="ferp-sidebar-brand-sub">ERP Enterprise</span>
            </div>
          )}
        </button>

        {/* Nav */}
        <nav className="ferp-sidebar-nav">
          <p className="ferp-sidebar-section-title">{collapsed ? '' : 'MÓDULOS'}</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`ferp-sidebar-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="ferp-sidebar-item-icon" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="ferp-sidebar-footer">
          {!collapsed && (
            <div className="mb-3 rounded-[10px] p-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2">
                <div className="ferp-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                  {(currentUser as any)?.nome?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-white">{(currentUser as any)?.nome ?? 'Utilizador'}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a855f7' }}>Admin</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="ferp-btn-ghost flex-1 justify-center"
              style={{ padding: '7px 10px' }}
              title={collapsed ? 'Expandir' : 'Colapsar'}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
              {!collapsed && <span className="text-[12px]">Minimizar</span>}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { logout(); navigate('/'); }}
            className="ferp-btn-ghost mt-2 w-full justify-center"
            style={{ padding: '7px 10px', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="text-[12px]">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <section className="ferp-main">
        {/* Topbar */}
        <header className="ferp-topbar">
          <div className="flex items-center gap-3">
            <h1 className="ferp-topbar-title">{pageTitle}</h1>
          </div>
          <div className="ferp-topbar-right">
            {/* Back to hub */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="ferp-btn-ghost"
              style={{ fontSize: 12 }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Hub
            </button>
            {/* User pill */}
            <div
              className="flex items-center gap-2 rounded-[10px] px-3 py-1.5"
              style={{
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(139,92,246,0.25)',
              }}
            >
              <div className="ferp-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                {(currentUser as any)?.nome?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <span className="text-[12px] font-semibold text-white">
                {(currentUser as any)?.nome ?? 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="ferp-content">
          <Routes>
            <Route index element={<Navigate to="/fornecedores-erp/dashboard" replace />} />
            <Route path="dashboard" element={<FornecedoresDashboard />} />
            <Route path="gestao" element={<FornecedoresGestao />} />
            <Route path="gestao/perfil/:supplierId" element={<FornecedorPerfil />} />
            <Route path="requisicoes" element={<FornecedoresRequisicoes />} />
            <Route path="pagamentos" element={<FornecedoresPagamentos />} />
            <Route path="documentos" element={<FornecedoresDocumentos />} />
            <Route path="relatorios" element={<FornecedoresRelatorios />} />
            <Route path="*" element={<Navigate to="/fornecedores-erp/dashboard" replace />} />
          </Routes>
        </main>
      </section>
    </div>
  );
}
