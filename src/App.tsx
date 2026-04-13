import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MessageSquare, Menu,
  Truck, Calendar, Clock, Wallet, Building2, Briefcase, Shield,
  BarChart3, MapPin, Hammer, Award, LayoutTemplate,
  ChevronDown, ChevronRight, UserCheck, Activity,
  Gauge, Settings2, UserCog as UserCogIcon, User as UserIcon, LogOut,
  Navigation, AlertTriangle, ClipboardCheck, Fuel, BatteryCharging, Ticket,
  Box, History, BellRing, Wrench, UserPlus, IdCard
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
const LinhaTransportes = lazy(() => import('./pages/LinhaTransportes'));
const ColaboradorApp = lazy(() => import('./pages/Colaborador'));
const ColaboradoresPage = lazy(() => import('./pages/Colaboradores'));

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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative ${active
        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/40'
        : 'text-white/60 hover:bg-white/5 hover:text-white'
        } ${collapsed ? 'justify-center' : ''}`}
    >
      <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110 text-white' : 'text-slate-400 group-hover:scale-110 group-hover:text-white'}`} />
      {!collapsed && <span className="text-sm whitespace-nowrap tracking-wide">{label}</span>}
      {!collapsed && badge && badge > 0 && (
        <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-slate-800">
          {badge}
        </span>
      )}
    </button>
    {collapsed && (
      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
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
      <div className="py-4 space-y-4 flex flex-col items-center border-t border-white/5 group relative">
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
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
        className="w-full flex items-center justify-between px-4 mb-2 group opacity-40 hover:opacity-100 transition-opacity"
      >
        <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">{title}</span>
        {isOpen ? <ChevronDown className="w-3 h-3 text-white/50" /> : <ChevronRight className="w-3 h-3 text-white/50" />}
      </button>
      {isOpen && <div className="space-y-1">{children}</div>}
    </div>
  );
};

const UserProfileMenu: React.FC<{ onNavigate: (tab: string) => void; showName?: boolean }> = ({ onNavigate, showName = true }) => {
  const { currentUser, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative mt-auto border-t border-white/5 p-4 bg-transparent">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/40 ring-2 ring-white/10 group-hover:ring-white/20 transition-all overflow-hidden">
          {currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : 'M'}
        </div>
        {showName && (
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{currentUser?.nome || 'Utilizador'}</p>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{(currentUser as any)?.role || 'ADMIN MANAGER'}</p>
          </div>
        )}
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => { onNavigate('meu-perfil'); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-all text-sm"
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
  const BRAND_LOGO = '/LOGO.png';
  const SIDEBAR_LOGO = '/logo-new-upload.png'; // Segunda tentativa
  const SIDEBAR_LOGO_MOBILE = '/logo-algar-frota.png';
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

  const isColaboradorArea =
    location.pathname === '/colaborador' ||
    location.pathname.startsWith('/colaborador/');

  if (isColaboradorArea) {
    return (
      <div className="app-root min-h-screen bg-[#F3F6FA] text-slate-900 font-sans selection:bg-amber-500/20">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A iniciar Sessão Colaborador...</p>
          </div>
        }>
          <Routes>
            <Route path="/colaborador/*" element={<ColaboradorApp />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (location.pathname === '/reset-password') return <ResetPassword />;
    return <Login />;
  }

  return (
    <div className="app-root flex h-[100dvh] min-h-[100dvh] overflow-x-hidden bg-[#F5F7FA] text-slate-900 font-sans selection:bg-amber-500/20">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 sidebar-dark-bg border-b border-white/5 flex items-center justify-between px-6 z-40">
        <div className="sidebar-texture" />
        <div className="flex items-center gap-3 relative z-10">
          <img
            src={BRAND_LOGO}
            alt="Algartempo Frota"
            className="h-8 w-auto object-contain brightness-110"
          />
          <span className="font-bold text-white tracking-wide text-xs uppercase">Algartempo Frota</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all border border-white/10 relative z-10"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 sidebar-dark-bg transition-all duration-300 flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} hidden lg:flex shadow-2xl shadow-black/60`}>
        <div className="sidebar-sheen" />
        <div className="sidebar-texture" />
        
        <div className="px-5 py-8 flex items-start justify-between border-b border-white/5 relative z-10">
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0 pr-3">
              <img
                src={SIDEBAR_LOGO}
                alt="Algartempo Frota"
                className="w-full max-w-[190px] h-auto object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-8 sidebar-scrollbar relative z-10">
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
            <SidebarItem icon={Navigation} label="Linha Transportes" active={activeTab === 'linha-transportes'} onClick={() => handleNavigate('linha-transportes')} collapsed={isSidebarCollapsed} />
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
            {hasAccess(userRole, 'centros_custos') && <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => handleNavigate('centros-custos')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'fornecedores') && <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => handleNavigate('fornecedores')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'clientes') && <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => handleNavigate('clientes')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'via_verde') && <SidebarItem icon={Ticket} label="Via Verde" active={activeTab === 'via-verde'} onClick={() => handleNavigate('via-verde')} collapsed={isSidebarCollapsed} />}
          </SidebarGroup>

          {/* ADMINISTRAÇÃO GROUP */}
          <SidebarGroup title="Administração" collapsed={isSidebarCollapsed}>
            {hasAccess(userRole, 'utilizadores') && <SidebarItem icon={UserCheck} label="Perfis" active={activeTab === 'utilizadores'} onClick={() => handleNavigate('utilizadores')} collapsed={isSidebarCollapsed} />}
            {hasAccess(userRole, 'utilizadores') && <SidebarItem icon={IdCard} label="Colaboradores" active={activeTab === 'colaboradores'} onClick={() => handleNavigate('colaboradores')} collapsed={isSidebarCollapsed} />}
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
          <div className="flex-1 min-h-0 w-full max-w-full min-w-0 overflow-y-auto overflow-x-auto custom-scrollbar bg-[#F5F7FA]">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A carregar módulo...</p>
            </div>
          }>
            <div className="flex-1 w-full max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
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
                <Route path="/colaboradores" element={<Suspense fallback={<div>Loading Colaboradores...</div>}><ColaboradoresPage /></Suspense>} />
                <Route path="/gestores" element={<GestoresTab />} />
                <Route path="/equipa-oficina" element={<EquipaOficinaTab />} />
                <Route path="/meu-perfil" element={<Suspense fallback={<div>Loading Profile...</div>}><Profile /></Suspense>} />
                <Route path="/permissoes" element={<PermissoesTab />} />
                <Route path="/roteirizacao" element={<RoteirizacaoTab />} />
                <Route path="/geofences" element={<GeofencesTab />} />
                <Route path="/locais" element={<LocaisTab />} />
                <Route path="/avaliacao-drivers" element={<AvaliacaoDriversTab />} />
                <Route path="/contabilidade" element={<ContabilidadeTab />} />
                <Route path="/finance/faturas/nova" element={<NovaFaturaPage />} />
                <Route path="/finance/faturas/:invoiceId/editar" element={<SupplierInvoiceDocumentPage mode="edit" />} />
                <Route path="/lancar-escalas" element={<LancarEscalaTab />} />
                <Route path="/controlo-operacional" element={<ControloOperacionalTab />} />
                <Route path="/linha-transportes" element={<Suspense fallback={<div className="p-8 text-slate-400">A carregar Linha de Transportes...</div>}><LinhaTransportes /></Suspense>} />
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
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="relative w-80 max-w-[85vw] h-full sidebar-dark-bg shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="sidebar-sheen" />
              <div className="sidebar-texture" />
              <div className="relative z-10 p-8 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <img
                    src={SIDEBAR_LOGO}
                    alt="Algartempo Frota"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all border border-white/10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10 sidebar-scrollbar">
              {(userRole === 'admin' || userRole === 'ADMIN_MASTER' || userRole === 'ADMIN') && (
                <SidebarItem
                  icon={Settings2}
                  label="Backoffice Master"
                  active={activeTab === 'backoffice'}
                  onClick={() => handleNavigate('backoffice')}
                />
              )}

              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNavigate('dashboard')} />

              <div className="h-px bg-slate-200 my-3" />
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Operações</p>
              <SidebarItem icon={Activity} label="Centro Operacional" active={activeTab === 'controlo-operacional'} onClick={() => handleNavigate('controlo-operacional')} />
              <SidebarItem icon={AlertTriangle} label="Alertas" active={activeTab === 'alerts'} onClick={() => handleNavigate('alerts')} />
              {hasAccess(userRole, 'escalas') && <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => handleNavigate('escalas')} />}
              {hasAccess(userRole, 'escalas') && <SidebarItem icon={LayoutTemplate} label="Planear Escala" active={activeTab === 'lancar-escalas'} onClick={() => handleNavigate('lancar-escalas')} />}
              {hasAccess(userRole, 'requisicoes') && <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => handleNavigate('requisicoes')} />}

              <div className="h-px bg-slate-200 my-3" />
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Frota</p>
              {hasAccess(userRole, 'viaturas') && <SidebarItem icon={Car} label="Viaturas" active={isFleetRoute} onClick={() => handleNavigate('viaturas')} />}
              {hasAccess(userRole, 'motoristas') && <SidebarItem icon={UserCogIcon} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => handleNavigate('motoristas')} />}
              {hasAccess(userRole, 'avaliacao_drivers') && <SidebarItem icon={Award} label="Performance" active={activeTab === 'avaliacao-drivers'} onClick={() => handleNavigate('avaliacao-drivers')} />}
              {hasAccess(userRole, 'roteirizacao') && <SidebarItem icon={Navigation} label="Roteirização" active={activeTab === 'roteirizacao'} onClick={() => handleNavigate('roteirizacao')} />}
              <SidebarItem icon={Navigation} label="Linha Transportes" active={activeTab === 'linha-transportes'} onClick={() => handleNavigate('linha-transportes')} />
              {hasAccess(userRole, 'geofences') && <SidebarItem icon={MapPin} label="Cercas Geográficas" active={activeTab === 'geofences'} onClick={() => handleNavigate('geofences')} />}
              {hasAccess(userRole, 'locais') && <SidebarItem icon={MapPin} label="Pontos de Interesse" active={activeTab === 'locais'} onClick={() => handleNavigate('locais')} />}

              <div className="h-px bg-slate-200 my-3" />
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Monitorização</p>
              {hasAccess(userRole, 'horas') && <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => handleNavigate('horas')} />}
              {hasAccess(userRole, 'combustivel') && <SidebarItem icon={Fuel} label="Abastecimentos" active={activeTab === 'combustivel'} onClick={() => handleNavigate('combustivel')} />}
              {hasAccess(userRole, 'combustivel') && <SidebarItem icon={BatteryCharging} label="Carregamentos" active={activeTab === 'carregamentos'} onClick={() => handleNavigate('carregamentos')} />}
              {hasAccess(userRole, 'combustivel') && <SidebarItem icon={Gauge} label="Eficiência" active={activeTab === 'eficiencia-frota'} onClick={() => handleNavigate('eficiencia-frota')} />}
              {hasAccess(userRole, 'relatorios') && <SidebarItem icon={BarChart3} label="Analytics" active={activeTab === 'relatorios'} onClick={() => handleNavigate('relatorios')} />}

              <div className="h-px bg-slate-200 my-3" />
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Financeiro</p>
              {hasAccess(userRole, 'contabilidade') && <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => handleNavigate('contabilidade')} />}
              {hasAccess(userRole, 'centros_custos') && <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => handleNavigate('centros-custos')} />}
              {hasAccess(userRole, 'fornecedores') && <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => handleNavigate('fornecedores')} />}
              {hasAccess(userRole, 'clientes') && <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => handleNavigate('clientes')} />}
              {hasAccess(userRole, 'via_verde') && <SidebarItem icon={Ticket} label="Via Verde" active={activeTab === 'via-verde'} onClick={() => handleNavigate('via-verde')} />}

              <div className="h-px bg-slate-200 my-3" />
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Administração</p>
              {hasAccess(userRole, 'utilizadores') && <SidebarItem icon={UserCheck} label="Perfis" active={activeTab === 'utilizadores'} onClick={() => handleNavigate('utilizadores')} />}
              {hasAccess(userRole, 'utilizadores') && <SidebarItem icon={IdCard} label="Colaboradores" active={activeTab === 'colaboradores'} onClick={() => handleNavigate('colaboradores')} />}
              {hasAccess(userRole, 'gestores') && <SidebarItem icon={Shield} label="Gestores" active={activeTab === 'gestores'} onClick={() => handleNavigate('gestores')} />}
              {hasAccess(userRole, 'equipa-oficina') && <SidebarItem icon={Hammer} label="Técnicos Oficina" active={activeTab === 'equipa-oficina'} onClick={() => handleNavigate('equipa-oficina')} />}
              <SidebarItem icon={MessageSquare} label="Central de Mensagens" active={activeTab === 'mensagens'} onClick={() => handleNavigate('mensagens')} badge={unreadCount} />
            </div>
            <UserProfileMenu onNavigate={handleNavigate} />
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
