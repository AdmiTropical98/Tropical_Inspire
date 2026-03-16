import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MessageSquare, Menu,
  Truck, Calendar, Clock, Wallet, Building2, Briefcase, Shield,
  BarChart3, MapPin, Hammer, Award, LayoutTemplate,
  ChevronDown, ChevronRight, UserCheck, Activity,
  Gauge, Settings2, UserCog as UserCogIcon, User as UserIcon, LogOut,
  Navigation, AlertTriangle, ClipboardCheck, Fuel, BatteryCharging, Ticket,
  Box, History, BellRing, Wrench, UserPlus
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionsContext';
import { useChat } from './contexts/ChatContext';

// Components
import Login from './pages/Auth/Login';
import ResetPassword from './pages/Auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import AlertsPage from './pages/Alerts';
import Viaturas from './pages/Viaturas';
import VehicleProfile from './pages/Viaturas/VehicleProfile';
import Drivers from './pages/Motoristas';
import Requisicoes from './pages/Requisicoes';
import Escalas from './pages/Escalas';
import EscalasHistory from './pages/Escalas/EscalasHistory';
import Horas from './pages/Horas';
import FuelManager from './pages/Combustivel';
import UserManagementTab from './pages/Users';
import GestoresTab from './pages/Gestores';
import EquipaOficinaTab from './pages/EquipaOficina';
import PermissoesTab from './pages/Permissoes';
import RoteirizacaoTab from './pages/Roteirizacao';
import GeofencesTab from './pages/Geofences';
import LocaisTab from './pages/Locais';
import AvaliacaoDriversTab from './pages/Avaliacao';
import ContabilidadeTab from './pages/Contabilidade';
import SupplierInvoiceDocumentPage from './pages/Contabilidade/SupplierInvoiceDocumentPage';
import ProcessamentoSalarios from './pages/Contabilidade/ProcessamentoSalarios';
import SalariosPage from './pages/Salarios';
import NovaFaturaPage from './pages/Finance/NovaFaturaPage';
import LancarEscalaTab from './pages/LancarEscala';
import ControloOperacionalTab from './pages/ControloOperacional';
import Fornecedores from './pages/Fornecedores';
import SupplierProfile from './pages/Fornecedores/SupplierProfile';
import ViaVerde from './pages/ViaVerde';
import Carregamentos from './pages/Carregamentos';
import EficienciaFrota from './pages/EficienciaFrota';
import ClientProfile from './pages/Clientes/ClientProfile';
import StockParts from './pages/Workshop/StockParts';
import StockMovements from './pages/Workshop/StockMovements';
import StockAlerts from './pages/Workshop/StockAlerts';
import WorkshopAssets from './pages/Workshop/WorkshopAssets';
import AssignedTools from './pages/Workshop/AssignedTools';

// Lazy loading backoffice
const Backoffice = lazy(() => import('./pages/Backoffice/index'));
const CentralMotorista = lazy(() => import('./pages/CentralMotorista'));
const Supervisores = lazy(() => import('./pages/Supervisores'));
const CentrosCustos = lazy(() => import('./pages/CentrosCustos'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Mensagens = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile/MyProfile'));

const LegacySupplierActionRedirect: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const redirectUrl = `https://algartempo-frota.com/api/action.php${location.search || ''}`;
    window.location.replace(redirectUrl);
  }, [location.search]);

  return (
    <div className="p-6 text-slate-300">A redirecionar para a confirmação da requisição...</div>
  );
};

const LegacySupplierDownloadRedirect: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const redirectUrl = `https://algartempo-frota.com/api/download-requisicao.php${location.search || ''}`;
    window.location.replace(redirectUrl);
  }, [location.search]);

  return (
    <div className="p-6 text-slate-300">A redirecionar para o download da requisição...</div>
  );
};

// TAB_LABELS removed (unused)

interface SidebarItemProps {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick, badge, collapsed }) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${active
        ? 'bg-blue-600/10 text-blue-400 font-bold'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
        } ${collapsed ? 'justify-center' : ''}`}
    >
      {active && <div className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full animate-pulse" />}
      <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
      {!collapsed && <span className="text-sm whitespace-nowrap">{label}</span>}
      {!collapsed && badge && badge > 0 && (
        <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-slate-900">
          {badge}
        </span>
      )}
    </button>
    {collapsed && (
      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
        {badge && badge > 0 && ` (${badge})`}
      </div>
    )}
  </div>
);

const SidebarGroup: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; collapsed?: boolean }> = ({ title, children, defaultOpen = true, collapsed = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="py-4 space-y-4 flex flex-col items-center border-t border-slate-800/50 group relative">
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {title}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 mb-2 group"
      >
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
        {isOpen ? <ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />}
      </button>
      {isOpen && <div className="space-y-1">{children}</div>}
    </div>
  );
};

const UserProfileMenu: React.FC<{ onNavigate: (tab: string) => void; showName?: boolean }> = ({ onNavigate, showName = true }) => {
  const { currentUser, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative mt-auto border-t border-slate-800/60 p-4">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/20 group-hover:ring-blue-500/40 transition-all overflow-hidden bg-slate-800">
          {currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
        </div>
        {showName && (
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-sm font-bold text-slate-200 truncate">{currentUser?.nome || 'Utilizador'}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{(currentUser as any)?.role || 'Guest'}</p>
          </div>
        )}
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => { onNavigate('meu-perfil'); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm"
          >
            <UserCogIcon className="w-4 h-4" /> Perfil
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all text-sm mt-1"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const { isAuthenticated, userRole } = useAuth();
  const { hasAccess } = usePermissions();
  const { unreadCount } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Derive activeTab from current path
  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const isFleetRoute = activeTab === 'viaturas' || activeTab === 'vehicles';
  const handleNavigate = (tab: string) => {
    navigate(`/${tab}`);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated) {
    if (location.pathname === '/reset-password') return <ResetPassword />;
    return <Login />;
  }

  return (
    <div className="app-root flex h-screen overflow-hidden bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/60 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-white tracking-widest text-sm uppercase">SmartFleet</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2.5 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-all border border-slate-700/50"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 bg-[#0f172a] border-r border-slate-800/60 transition-all duration-300 flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'
        } hidden lg:flex`}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/20">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div className="leading-tight">
                <span className="font-black text-white tracking-tighter text-lg uppercase block">SmartFleet</span>
                <span className="text-[9px] font-black text-blue-500 tracking-[0.2em] uppercase opacity-70">Core Engine</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {(userRole === 'admin' || userRole === 'ADMIN_MASTER' || userRole === 'ADMIN') && (
            <SidebarItem
              icon={Settings2}
              label="Backoffice Master"
              active={activeTab === 'backoffice'}
              onClick={() => handleNavigate('backoffice')}
              collapsed={isSidebarCollapsed}
            />
          )}

          <div className="mt-4 mb-6">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => handleNavigate('dashboard')}
              collapsed={isSidebarCollapsed}
            />
          </div>

          {/* OPERAÇÕES GROUP */}
          <SidebarGroup title="Operações" collapsed={isSidebarCollapsed}>
            <SidebarItem
              icon={Activity}
              label="Centro Operacional"
              active={activeTab === 'controlo-operacional'}
              onClick={() => handleNavigate('controlo-operacional')}
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem
              icon={AlertTriangle}
              label="Alertas"
              active={activeTab === 'alerts'}
              onClick={() => handleNavigate('alerts')}
              collapsed={isSidebarCollapsed}
            />
            {hasAccess(userRole, 'escalas') && (
              <>
                <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => handleNavigate('escalas')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={LayoutTemplate} label="Planear Escala" active={activeTab === 'lancar-escalas'} onClick={() => handleNavigate('lancar-escalas')} collapsed={isSidebarCollapsed} />
              </>
            )}
            {hasAccess(userRole, 'requisicoes') && (
              <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => handleNavigate('requisicoes')} collapsed={isSidebarCollapsed} />
            )}
          </SidebarGroup>

          {/* FROTA GROUP */}
          <SidebarGroup title="Frota" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'viaturas') && (
              <SidebarItem icon={Car} label="Viaturas" active={isFleetRoute} onClick={() => handleNavigate('viaturas')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'motoristas') && (
              <SidebarItem icon={UserCogIcon} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => handleNavigate('motoristas')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'avaliacao_drivers') && (
              <SidebarItem icon={Award} label="Performance" active={activeTab === 'avaliacao-drivers'} onClick={() => handleNavigate('avaliacao-drivers')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'roteirizacao') && (
              <SidebarItem icon={Navigation} label="Roteirização" active={activeTab === 'roteirizacao'} onClick={() => handleNavigate('roteirizacao')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'geofences') && (
              <SidebarItem icon={MapPin} label="Cercas Geográficas" active={activeTab === 'geofences'} onClick={() => handleNavigate('geofences')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'locais') && (
              <SidebarItem icon={MapPin} label="Pontos de Interesse" active={activeTab === 'locais'} onClick={() => handleNavigate('locais')} collapsed={isSidebarCollapsed} />
            )}
          </SidebarGroup>

          {/* OFICINA GROUP */}
          <SidebarGroup title="Oficina" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'oficina') && (
              <>
                <SidebarItem icon={Box} label="Stock de Peças" active={activeTab === 'workshop-stock'} onClick={() => handleNavigate('workshop-stock')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={History} label="Movimentos de Stock" active={activeTab === 'workshop-movements'} onClick={() => handleNavigate('workshop-movements')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={Wrench} label="Inventário" active={activeTab === 'workshop-assets'} onClick={() => handleNavigate('workshop-assets')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={UserPlus} label="Ferramentas Atribuídas" active={activeTab === 'assigned-tools'} onClick={() => handleNavigate('assigned-tools')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={BellRing} label="Alertas de Stock" active={activeTab === 'workshop-alerts'} onClick={() => handleNavigate('workshop-alerts')} collapsed={isSidebarCollapsed} />
              </>
            )}
          </SidebarGroup>

          {/* MONITORIZAÇÃO GROUP */}
          <SidebarGroup title="Monitorização" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'horas') && (
              <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => handleNavigate('horas')} collapsed={isSidebarCollapsed} />
            )}
            {hasAccess(userRole, 'combustivel') && (
              <>
                <SidebarItem icon={Fuel} label="Abastecimentos" active={activeTab === 'combustivel'} onClick={() => handleNavigate('combustivel')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={BatteryCharging} label="Carregamentos" active={activeTab === 'carregamentos'} onClick={() => handleNavigate('carregamentos')} collapsed={isSidebarCollapsed} />
                <SidebarItem icon={Gauge} label="Eficiência" active={activeTab === 'eficiencia-frota'} onClick={() => handleNavigate('eficiencia-frota')} collapsed={isSidebarCollapsed} />
              </>
            )}
            {hasAccess(userRole, 'relatorios') && (
              <SidebarItem icon={BarChart3} label="Analytics" active={activeTab === 'relatorios'} onClick={() => handleNavigate('relatorios')} collapsed={isSidebarCollapsed} />
            )}
          </SidebarGroup>

          {/* FINANCEIRO GROUP */}
          <SidebarGroup title="Financeiro" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'contabilidade') && <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => handleNavigate('contabilidade')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'contabilidade') && <SidebarItem icon={Wallet} label="Proc. de Salários" active={activeTab === 'processamento-salarios'} onClick={() => handleNavigate('processamento-salarios')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'contabilidade') && <SidebarItem icon={Wallet} label="Salários" active={activeTab === 'salarios'} onClick={() => handleNavigate('salarios')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'centros_custos') && <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => handleNavigate('centros-custos')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'fornecedores') && <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => handleNavigate('fornecedores')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'clientes') && <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => handleNavigate('clientes')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'via_verde') && <SidebarItem icon={Ticket} label="Via Verde" active={activeTab === 'via-verde'} onClick={() => handleNavigate('via-verde')} collapsed={isSidebarCollapsed} />}
          </SidebarGroup>

          {/* ADMINISTRAÇÃO GROUP */}
          <SidebarGroup title="Administração" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'utilizadores') && <SidebarItem icon={UserCheck} label="Perfis" active={activeTab === 'utilizadores'} onClick={() => handleNavigate('utilizadores')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'gestores') && <SidebarItem icon={Shield} label="Gestores" active={activeTab === 'gestores'} onClick={() => handleNavigate('gestores')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'equipa-oficina') && <SidebarItem icon={Hammer} label="Técnicos Oficina" active={activeTab === 'equipa-oficina'} onClick={() => handleNavigate('equipa-oficina')} collapsed={isSidebarCollapsed} />}
            <SidebarItem
              icon={MessageSquare}
              label="Central de Mensagens"
              active={activeTab === 'mensagens'}
              onClick={() => handleNavigate('mensagens')}
              badge={unreadCount}
              collapsed={isSidebarCollapsed}
            />
          </SidebarGroup>
        </div>

        <UserProfileMenu onNavigate={handleNavigate} showName={!isSidebarCollapsed} />
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 h-full overflow-hidden flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <div className="shrink-0 h-16 border-b border-slate-800/60 bg-slate-950/40 px-8" />
        <div className="flex-1 min-h-0 w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-950/20">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A carregar módulo...</p>
            </div>
          }>
            <div className="flex-1 w-full max-w-none px-8 py-6 min-w-0">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard setActiveTab={handleNavigate} />} />
                <Route path="/action.php" element={<LegacySupplierActionRedirect />} />
                <Route path="/public_html_api/action.php" element={<LegacySupplierActionRedirect />} />
                <Route path="/download-requisicao.php" element={<LegacySupplierDownloadRedirect />} />
                <Route path="/public_html_api/download-requisicao.php" element={<LegacySupplierDownloadRedirect />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/backoffice" element={<Suspense fallback={<div className="p-8 text-slate-400">Loading Backoffice...</div>}><Backoffice /></Suspense>} />
                <Route path="/viaturas" element={<Viaturas />} />
                <Route path="/viaturas/:viaturaId" element={<VehicleProfile />} />
                <Route path="/vehicles/:viaturaId" element={<VehicleProfile />} />
                <Route path="/motoristas" element={<Drivers />} />
                <Route path="/requisicoes" element={<Requisicoes />} />
                <Route path="/escalas" element={<Escalas />} />
                <Route path="/escalas-history" element={<EscalasHistory />} />
                <Route path="/horas" element={<Horas />} />
                <Route path="/combustivel" element={<FuelManager />} />
                <Route path="/utilizadores" element={<UserManagementTab />} />
                <Route path="/gestores" element={<GestoresTab />} />
                <Route path="/equipa-oficina" element={<EquipaOficinaTab />} />
                <Route path="/meu-perfil" element={<Suspense fallback={<div>Loading Profile...</div>}><Profile /></Suspense>} />
                <Route path="/permissoes" element={<PermissoesTab />} />
                <Route path="/roteirizacao" element={<RoteirizacaoTab />} />
                <Route path="/geofences" element={<GeofencesTab />} />
                <Route path="/locais" element={<LocaisTab />} />
                <Route path="/avaliacao-drivers" element={<AvaliacaoDriversTab />} />
                <Route path="/contabilidade" element={<ContabilidadeTab />} />
                <Route path="/processamento-salarios" element={<ProcessamentoSalarios />} />
                <Route path="/salarios" element={<SalariosPage />} />
                <Route path="/finance/faturas/nova" element={<NovaFaturaPage />} />
                <Route path="/finance/faturas/:invoiceId/editar" element={<SupplierInvoiceDocumentPage mode="edit" />} />
                <Route path="/lancar-escalas" element={<LancarEscalaTab />} />
                <Route path="/controlo-operacional" element={<ControloOperacionalTab />} />
                <Route path="/fornecedores" element={<Fornecedores />} />
                <Route path="/fornecedores/:supplierId" element={<SupplierProfile />} />
                <Route path="/via-verde" element={<ViaVerde />} />
                <Route path="/carregamentos" element={<Carregamentos />} />
                <Route path="/eficiencia-frota" element={<EficienciaFrota />} />
                <Route path="/mensagens" element={<Suspense fallback={<div>Loading Chat...</div>}><Mensagens /></Suspense>} />
                <Route path="/central-motorista" element={<Suspense fallback={<div>Loading Central...</div>}><CentralMotorista /></Suspense>} />
                <Route path="/supervisores" element={<Suspense fallback={<div>Loading Supervisores...</div>}><Supervisores /></Suspense>} />
                <Route path="/centros-custos" element={<Suspense fallback={<div>Loading Centros Custos...</div>}><CentrosCustos /></Suspense>} />
                <Route path="/clientes" element={<Suspense fallback={<div>Loading Clientes...</div>}><Clientes /></Suspense>} />
                <Route path="/clientes/:clientId" element={<ClientProfile />} />
                <Route path="/relatorios" element={<Suspense fallback={<div>Loading Relatórios...</div>}><Relatorios /></Suspense>} />
                <Route path="/workshop-stock" element={<StockParts />} />
                <Route path="/workshop-movements" element={<StockMovements />} />
                <Route path="/workshop-assets" element={<WorkshopAssets />} />
                <Route path="/assigned-tools" element={<AssignedTools />} />
                <Route path="/workshop-alerts" element={<StockAlerts />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </Suspense>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative w-80 max-w-[85vw] h-full bg-[#0f172a] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 flex items-center justify-between border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-white uppercase tracking-tighter">SmartFleet</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-slate-800/50 text-slate-500 transition-all border border-slate-700/50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNavigate('dashboard')} />
              <SidebarItem icon={Activity} label="Operacional" active={activeTab === 'controlo-operacional'} onClick={() => handleNavigate('controlo-operacional')} />
              {/* Simplified mobile list */}
              <div className="h-px bg-slate-800/50 my-4" />
              <SidebarItem icon={Truck} label="Frota" active={activeTab === 'viaturas'} onClick={() => handleNavigate('viaturas')} />
              <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => handleNavigate('escalas')} />
            </div>
            <UserProfileMenu onNavigate={handleNavigate} />
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
