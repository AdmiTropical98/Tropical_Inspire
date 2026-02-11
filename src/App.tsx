import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard, Users, UserCog, Car, MessageSquare, Menu, X,
  Truck, Calendar, Fuel, Clock, Wallet, Building2, Briefcase, Shield,
  BarChart3, MapPin, Hammer, Eye, ClipboardCheck, Bus, Award, LayoutTemplate,
  ChevronDown, ChevronRight, UserCheck, History, Navigation, Zap, Ticket
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionsContext';
import { useWorkshop } from './contexts/WorkshopContext';
import { ChatProvider, useChat } from './contexts/ChatContext';

// Components
import Login from './pages/Auth/Login';
import ResetPassword from './pages/Auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import { supabase } from './lib/supabase'; // Import Supabase client
import Fornecedores from './pages/Fornecedores';
import Viaturas from './pages/Viaturas';
import Drivers from './pages/Motoristas';
import Requisicoes from './pages/Requisicoes';
import Escalas from './pages/Escalas';
import EscalasHistory from './pages/Escalas/EscalasHistory';
import Horas from './pages/Horas';
import FuelManager from './pages/Combustivel';
import EquipaOficina from './pages/EquipaOficina';
import Supervisores from './pages/Supervisores';
import ExternalServices from './pages/ExternalServices';
import ChatWidget from './pages/Chat/ChatWidget';
import ChatPage from './pages/Chat/ChatPage'; // New Chat Page
import CentrosCustos from './pages/CentrosCustos';
// Lazy Load CentralMotorista
const CentralMotorista = lazy(() => import('./pages/Motoristas/CentralMotoristas'));

import TransportesEva from './pages/TransportesEva';
import UserProfileMenu from './components/common/UserProfileMenu';
import Contabilidade from './pages/Contabilidade';
import Clientes from './pages/Clientes';
import Relatorios from './pages/Relatorios'; // Import Relatorios
import AvaliacaoMotorista from './pages/Avaliacao'; // Import AvaliacaoMotorista
import Geofences from './pages/Geofences'; // Import Geofences component
import UsersPage from './pages/Users'; // Import UsersPage
import Locais from './pages/Locais'; // Import Locais (POIs)
import Permissoes from './pages/Permissoes';
import MyProfile from './pages/Profile/MyProfile';
import Gestores from './pages/Gestores';
import Roteirizacao from './pages/Roteirizacao';
// Lazy Load LancarEscala
const LancarEscala = lazy(() => import('./pages/LancarEscala'));
const ViaVerde = lazy(() => import('./pages/ViaVerde'));
const Carregamentos = lazy(() => import('./pages/Carregamentos'));

import SplashScreen from './components/common/SplashScreen';



// Helper for loading state
const PageLoading = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-4">
    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
    <p className="text-sm font-medium animate-pulse">A carregar módulo...</p>
  </div>
);

// Sidebar Item Component for consistent styling
const SidebarItem = ({ icon: Icon, label, active, onClick, badge, collapsed }: { icon: React.ElementType, label: string, active: boolean, onClick: () => void, badge?: number, collapsed?: boolean }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-300 relative group overflow-hidden
      ${active
        ? 'text-white bg-gradient-to-r from-blue-600/20 to-transparent border-l-[3px] border-blue-500'
        : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
      }
      ${collapsed ? 'justify-center px-0' : ''}
    `}
  >
    <div className={`${collapsed ? 'w-full flex justify-center' : ''}`}>
      <Icon className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${active ? 'text-blue-400 scale-110' : 'group-hover:text-blue-400 group-hover:scale-110'}`} />
    </div>

    <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100 relative'}`}>
      <span className="relative z-10">{label}</span>
    </div>

    {active && <div className="absolute inset-0 bg-blue-500/5 blur-xl pointer-events-none" />}

    {badge ? (
      <span className={`
        bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 transition-all duration-300
        ${collapsed ? 'absolute top-2 right-2 px-1.5 py-0.5 text-[9px] w-auto h-auto min-w-[1.2rem]' : 'ml-auto'}
      `}>
        {badge}
      </span>
    ) : null}
  </button>
);

const SidebarGroup = ({ title, children, defaultOpen = true, collapsed }: { title: string, children: React.ReactNode, defaultOpen?: boolean, collapsed?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Sync internal state if needed, or just let users toggle? 
  // If collapsed, we force open or handle differently? 
  // Actually if collapsed, we usually just show icons. Group toggling becomes weird if hidden.
  // We will force open if collapsed OR just hide the header and show items? 
  // Better UX: If collapsed, show a separator or nothing for title, and show children.

  // Filter out null/false children to check if group is empty
  const validChildren = Array.isArray(children) ? children.filter(Boolean) : (children ? [children] : []);

  if (validChildren.length === 0) return null;

  if (collapsed) {
    return (
      <div className="mb-2 pt-2 border-t border-slate-800/30 first:border-0">
        <div className="space-y-0.5">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {/* <Icon className="w-3 h-3" /> Optional: Show icon in header */}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="mt-1 space-y-0.5">
          {children}
        </div>
      </div>
    </div>
  );
};


function AppContent() {
  console.log('--- APP CONTENT RENDERING ---');
  const { isAuthenticated, userRole } = useAuth();
  const { hasAccess } = usePermissions();
  const { notifications } = useWorkshop();
  const { unreadCount } = useChat();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'admin_users' | 'permissions' | 'requisicoes' | 'fornecedores' | 'viaturas' | 'motoristas' | 'escalas' | 'escalas-history' | 'lancar-escala' | 'horas' | 'combustivel' | 'external' | 'equipa-oficina' | 'supervisores' | 'centros-custos' | 'central-motorista' | 'transportes-eva' | 'mensagens' | 'contabilidade' | 'clientes' | 'relatorios' | 'avaliacao' | 'geofences' | 'locais' | 'meu-perfil' | 'gestores' | 'roteirizacao' | 'via-verde' | 'carregamentos'>('dashboard');

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Helper to handle navigation and auto-collapse
  const handleNavigate = (tab: typeof activeTab) => {
    setActiveTab(tab);
    // Auto-collapse on mobile or if desired behavior is to always collapse on click for desktop
    // User requested: "recolher automaticamente quando clico para entrar em alguma tela"
    setIsSidebarCollapsed(true);
  };

  // Sidebar Visibility Flags
  const showFleetGroup = hasAccess(userRole, 'central_motorista') || hasAccess(userRole, 'viaturas') || hasAccess(userRole, 'motoristas') || hasAccess(userRole, 'geofences') || userRole === 'admin' || userRole === 'gestor';
  const showOpsGroup = hasAccess(userRole, 'escalas') || hasAccess(userRole, 'requisicoes') || hasAccess(userRole, 'horas') || hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'plataformas_externas') || hasAccess(userRole, 'roteirizacao') || userRole === 'admin';
  const showFinGroup = hasAccess(userRole, 'contabilidade') || hasAccess(userRole, 'centros_custos') || hasAccess(userRole, 'fornecedores') || hasAccess(userRole, 'clientes') || hasAccess(userRole, 'relatorios');
  const showSysGroup = hasAccess(userRole, 'equipa-oficina') || hasAccess(userRole, 'supervisores') || userRole === 'admin' || userRole === 'gestor';


  // Notification & Modal State
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Listen for Password Recovery Event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initial Tab based on Role
  useEffect(() => {
    if (isAuthenticated) {
      let target: typeof activeTab = 'dashboard';

      if (userRole === 'motorista') target = 'central-motorista';
      else if (userRole === 'oficina') target = 'dashboard';
      else if (userRole === 'supervisor') target = 'dashboard';
      else if (userRole === 'gestor') target = 'dashboard';

      if (activeTab !== target) {
        setActiveTab(target);
      }
    }
  }, [isAuthenticated, userRole]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'overview':
        if (!hasAccess(userRole, 'dashboard')) return <div className="p-8 text-center text-slate-500">Acesso negado ao Dashboard. Selecione outra opção no menu.</div>;
        return <Dashboard setActiveTab={handleNavigate} />;
      case 'admin_users':
        return <UsersPage />;
      case 'permissions':
        return (
          <div className="p-6 max-w-7xl mx-auto">
            <Permissoes />
          </div>
        );
      case 'escalas': return <Escalas />;
      case 'escalas-history': return <EscalasHistory />;
      case 'lancar-escala': return (
        <Suspense fallback={<PageLoading />}>
          <LancarEscala onNavigate={(tab) => handleNavigate(tab as any)} />
        </Suspense>
      );
      case 'horas': return <Horas />;
      case 'equipa-oficina': return <EquipaOficina />;
      case 'supervisores': return <Supervisores />;
      case 'gestores': return <Gestores />;
      case 'centros-custos': return <CentrosCustos />;
      case 'central-motorista': return (
        <Suspense fallback={<PageLoading />}>
          <CentralMotorista />
        </Suspense>
      );
      case 'transportes-eva': return <TransportesEva />;
      case 'mensagens': return <ChatPage />;
      case 'combustivel': return <FuelManager />;
      case 'viaturas': return <Viaturas />;
      case 'motoristas': return <Drivers />;
      case 'requisicoes': return <Requisicoes />;
      case 'fornecedores': return <Fornecedores />;
      case 'contabilidade': return <Contabilidade />;
      case 'clientes': return <Clientes />;
      case 'relatorios': return <Relatorios />;
      case 'avaliacao': return <AvaliacaoMotorista />;
      case 'geofences': return <Geofences />;
      case 'locais': return <Locais />;
      case 'external': return <ExternalServices />;
      case 'meu-perfil': return <MyProfile />;
      case 'roteirizacao': return <Roteirizacao />;
      case 'via-verde': return (
        <Suspense fallback={<PageLoading />}>
          <ViaVerde />
        </Suspense>
      );
      case 'carregamentos': return (
        <Suspense fallback={<PageLoading />}>
          <Carregamentos />
        </Suspense>
      );
      default: return <Dashboard setActiveTab={handleNavigate} />;
    }
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  if (isResettingPassword) return <ResetPassword />;

  if (!isAuthenticated) return <Login />;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden text-slate-200 font-sans selection:bg-blue-500/30 bg-black">

      {/* GLOBAL CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1800px] h-[1800px] bg-gradient-to-br from-blue-950/60 via-slate-900/60 to-indigo-950/60 opacity-60 blur-[150px] animate-pulse-slow" />
        <div className="absolute inset-0 bg-black/85" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
      </div>

      {/* APP LAYOUT (ON TOP) */}
      <div className="relative z-10 flex h-full w-full bg-transparent">

        {/* DB Connection Error Banner */}
        {useWorkshop().dbConnectionError && (
          <div className="absolute top-0 left-0 w-full bg-red-600 text-white p-2 z-[9999] text-center font-bold flex items-center justify-center gap-2 shadow-xl animate-pulse">
            {useWorkshop().dbConnectionError} -- Verifique a Consola (F12) para detalhes.
            <button onClick={() => window.location.reload()} className="ml-4 underline text-xs">Recarregar</button>
          </div>
        )}

        {/* SIDEBAR */}
        <aside
          className={`
            bg-[#0b1121] border-r border-slate-800/60 flex flex-col hidden md:flex z-50 shadow-2xl shrink-0 transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'w-20' : 'w-72 min-w-[18rem]'}
          `}
        >
          {/* Header & Logo Area */}
          <div className="h-20 border-b border-slate-800/60 flex items-center justify-center relative bg-gradient-to-r from-slate-900/50 to-transparent">
            <button
              onClick={() => isAuthenticated && handleNavigate(userRole === 'motorista' ? 'central-motorista' : 'dashboard')}
              className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 px-0 absolute pointer-events-none' : 'w-full px-4'}`}
              title="Ir para Início"
            >
              <img src="/logo-algar-frota.png?v=4" alt="Gestão Frota" className="h-12 object-contain" />
            </button>

            {/* Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`
                p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all z-20
                ${isSidebarCollapsed ? 'mx-auto' : 'absolute right-2'}
              `}
              title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
            >
              {isSidebarCollapsed ? <Menu className="w-6 h-6" /> : <ChevronRight className="w-5 h-5 rotate-180" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 space-y-2 custom-scrollbar overflow-x-hidden">
            {/* MAIN MENU */}
            {hasAccess(userRole, 'dashboard') && (
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                active={activeTab === 'dashboard'}
                onClick={() => handleNavigate('dashboard')}
                collapsed={isSidebarCollapsed}
              />
            )}

            {showFleetGroup && (
              <SidebarGroup title="Gestão de Frota" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'central_motorista') && (
                  <SidebarItem icon={UserCog} label="Central Motorista" active={activeTab === 'central-motorista'} onClick={() => handleNavigate('central-motorista')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'viaturas') && (
                  <SidebarItem icon={Car} label="Viaturas" active={activeTab === 'viaturas'} onClick={() => handleNavigate('viaturas')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'geofences') && (
                  <SidebarItem icon={MapPin} label="Geofences" active={activeTab === 'geofences'} onClick={() => handleNavigate('geofences')} collapsed={isSidebarCollapsed} />
                )}
                {(userRole === 'admin' || hasAccess(userRole, 'escalas')) && (
                  <SidebarItem icon={MapPin} label="Locais (POIs)" active={activeTab === 'locais'} onClick={() => handleNavigate('locais')} collapsed={isSidebarCollapsed} />
                )}
                {userRole === 'admin' && (
                  <SidebarItem icon={Award} label="Avaliação Drivers" active={activeTab === 'avaliacao'} onClick={() => handleNavigate('avaliacao')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {/* NEW ESCALAS GROUP */}
            {(hasAccess(userRole, 'escalas') || hasAccess(userRole, 'escalas_create')) && (
              <SidebarGroup title="Escalas" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'escalas_create') && (
                  <SidebarItem icon={LayoutTemplate} label="Lançar Escalas" active={activeTab === 'lancar-escala'} onClick={() => handleNavigate('lancar-escala')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'escalas') && (
                  <SidebarItem icon={Calendar} label="Atribuir Escalas" active={activeTab === 'escalas'} onClick={() => handleNavigate('escalas')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'escalas') && (
                  <SidebarItem icon={History} label="Histórico de Escalas" active={activeTab === 'escalas-history'} onClick={() => handleNavigate('escalas-history')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {showOpsGroup && (
              <SidebarGroup title="Operações" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'horas') && (
                  <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => handleNavigate('horas')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'plataformas_externas') && (
                  <SidebarItem icon={Bus} label="Transportes EVA" active={activeTab === 'transportes-eva'} onClick={() => handleNavigate('transportes-eva')} collapsed={isSidebarCollapsed} />
                )}
                {(hasAccess(userRole, 'roteirizacao') || userRole === 'admin' || userRole === 'gestor') && (
                  <SidebarItem icon={Navigation} label="Roteirização" active={activeTab === 'roteirizacao'} onClick={() => handleNavigate('roteirizacao')} collapsed={isSidebarCollapsed} />
                )}
                {/* Via Verde - Available to Ops/Admin */}
                {(hasAccess(userRole, 'via_verde') || userRole === 'admin' || userRole === 'gestor') && (
                  <SidebarItem icon={Ticket} label="Via Verde" active={activeTab === 'via-verde'} onClick={() => handleNavigate('via-verde')} collapsed={isSidebarCollapsed} />
                )}
                {/* Carregamentos - Available to Ops/Admin */}
                {(hasAccess(userRole, 'via_verde') || userRole === 'admin' || userRole === 'gestor') && (
                  <SidebarItem icon={Zap} label="Carregamentos Elétricos" active={activeTab === 'carregamentos'} onClick={() => handleNavigate('carregamentos')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {(hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'requisicoes')) && (
              <SidebarGroup title="Oficina" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'combustivel') && (
                  <SidebarItem icon={Fuel} label="Combustível" active={activeTab === 'combustivel'} onClick={() => handleNavigate('combustivel')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'requisicoes') && (
                  <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => handleNavigate('requisicoes')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {showSysGroup && (
              <SidebarGroup title="Equipa" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'gestores') && (
                  <SidebarItem icon={UserCheck} label="Gestores" active={activeTab === 'gestores'} onClick={() => handleNavigate('gestores')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'equipa-oficina') && (
                  <SidebarItem icon={Hammer} label="Equipa Oficina" active={activeTab === 'equipa-oficina'} onClick={() => handleNavigate('equipa-oficina')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'supervisores') && (
                  <SidebarItem icon={Eye} label="Supervisores" active={activeTab === 'supervisores'} onClick={() => handleNavigate('supervisores')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'motoristas') && (
                  <SidebarItem icon={Users} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => handleNavigate('motoristas')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {showFinGroup && (
              <SidebarGroup title="Financeiro" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
                {hasAccess(userRole, 'contabilidade') && (
                  <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => handleNavigate('contabilidade')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'centros_custos') && (
                  <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => handleNavigate('centros-custos')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'fornecedores') && (
                  <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => handleNavigate('fornecedores')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'clientes') && (
                  <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => handleNavigate('clientes')} collapsed={isSidebarCollapsed} />
                )}
                {hasAccess(userRole, 'relatorios') && (
                  <SidebarItem icon={BarChart3} label="Relatórios" active={activeTab === 'relatorios'} onClick={() => handleNavigate('relatorios')} collapsed={isSidebarCollapsed} />
                )}
              </SidebarGroup>
            )}

            {/* 6. SISTEMA */}
            <SidebarGroup title="Sistema" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
              {userRole === 'admin' && (
                <SidebarItem icon={Users} label="Gestão de Usuários" active={activeTab === 'admin_users'} onClick={() => handleNavigate('admin_users')} collapsed={isSidebarCollapsed} />
              )}
              {userRole === 'admin' && (
                <SidebarItem icon={Shield} label="Gestão de Permissões" active={activeTab === 'permissions'} onClick={() => handleNavigate('permissions')} collapsed={isSidebarCollapsed} />
              )}
            </SidebarGroup>

            {/* 7. COMUNICAÇÃO */}
            <SidebarGroup title="Comunicação" defaultOpen={!isSidebarCollapsed} collapsed={isSidebarCollapsed}>
              {hasAccess(userRole, 'mensagens') && (
                <SidebarItem icon={MessageSquare} label="Mensagens" active={activeTab === 'mensagens'} onClick={() => handleNavigate('mensagens')} badge={unreadCount > 0 ? unreadCount : undefined} collapsed={isSidebarCollapsed} />
              )}
            </SidebarGroup>

          </nav>

          {/* USER PROFILE */}
          <div className={`${isSidebarCollapsed ? 'px-2' : ''} transition-all duration-300`}>
            <UserProfileMenu onNavigate={() => handleNavigate('meu-perfil')} showName={!isSidebarCollapsed} />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col w-full h-full overflow-hidden bg-transparent relative z-10 p-0 m-0 transition-all duration-300">
          {/* Mobile Header - Only visible on mobile */}
          <header className="md:hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center shrink-0">
            <div className="flex items-center">
              <button onClick={() => isAuthenticated && handleNavigate(userRole === 'motorista' ? 'central-motorista' : 'dashboard')}>
                <img src="/logo-algar-frota.png?v=4" alt="Gestão Frota" className="h-24 w-auto object-contain" />
              </button>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 hover:text-white transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </header>


          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col p-6 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white">Menu <span className="text-sm font-normal text-slate-500">v2.2</span></h2>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {/* Mobile Nav - simplified for now, usually same structure */}
              <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar px-3 py-4">
                {/* Reuse Sidebar Groups logic or flat list? Mobile usually prefers flat or accordion too. Let's try to mimic the structure but maybe simpler. */}
                {/* For constraints, I will keep the mobile menu somewhat similar to desktop but maybe flat is easier for touch, but user requested order. I will use the same structure for consistency. */}

                {/* MAIN MENU */}
                {hasAccess(userRole, 'dashboard') && (
                  <SidebarItem
                    icon={LayoutDashboard}
                    label="Dashboard"
                    active={activeTab === 'dashboard'}
                    onClick={() => { handleNavigate('dashboard'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {/* 1. GESTÃO DE FROTA */}
                {showFleetGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Gestão de Frota</div>}
                {hasAccess(userRole, 'central_motorista') && (
                  <SidebarItem icon={UserCog} label="Central Motorista" active={activeTab === 'central-motorista'} onClick={() => { handleNavigate('central-motorista'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'viaturas') && (
                  <SidebarItem icon={Car} label="Viaturas" active={activeTab === 'viaturas'} onClick={() => { handleNavigate('viaturas'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'geofences') && (
                  <SidebarItem icon={MapPin} label="Geofences (Cartrack)" active={activeTab === 'geofences'} onClick={() => { handleNavigate('geofences'); setIsMobileMenuOpen(false); }} />
                )}
                {(userRole === 'admin' || hasAccess(userRole, 'escalas')) && (
                  <SidebarItem icon={MapPin} label="Locais (POIs)" active={activeTab === 'locais'} onClick={() => { handleNavigate('locais'); setIsMobileMenuOpen(false); }} />
                )}
                {userRole === 'admin' && (
                  <SidebarItem icon={Award} label="Avaliação Drivers" active={activeTab === 'avaliacao'} onClick={() => { handleNavigate('avaliacao'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 2. OPERAÇÕES */}
                {showOpsGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Operações</div>}
                {hasAccess(userRole, 'escalas') && (
                  <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => { handleNavigate('escalas'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'escalas_create') && (
                  <SidebarItem icon={LayoutTemplate} label="Lançar Escalas" active={activeTab === 'lancar-escala'} onClick={() => { handleNavigate('lancar-escala'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'horas') && (
                  <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => { handleNavigate('horas'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'plataformas_externas') && (
                  <SidebarItem icon={Bus} label="Transportes EVA" active={activeTab === 'transportes-eva'} onClick={() => { handleNavigate('transportes-eva'); setIsMobileMenuOpen(false); }} />
                )}
                {(hasAccess(userRole, 'via_verde') || userRole === 'admin' || userRole === 'gestor') && (
                  <SidebarItem icon={Ticket} label="Via Verde" active={activeTab === 'via-verde'} onClick={() => { handleNavigate('via-verde'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 3. OFICINA */}
                {(hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'requisicoes')) && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Oficina</div>}
                {hasAccess(userRole, 'combustivel') && (
                  <SidebarItem icon={Fuel} label="Combustível" active={activeTab === 'combustivel'} onClick={() => { handleNavigate('combustivel'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'requisicoes') && (
                  <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => { handleNavigate('requisicoes'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 4. EQUIPA */}
                {showSysGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Equipa</div>}
                {hasAccess(userRole, 'gestores') && (
                  <SidebarItem icon={Shield} label="Gestores" active={activeTab === 'gestores'} onClick={() => { handleNavigate('gestores'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'equipa-oficina') && (
                  <SidebarItem icon={Hammer} label="Equipa Oficina" active={activeTab === 'equipa-oficina'} onClick={() => { handleNavigate('equipa-oficina'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'supervisores') && (
                  <SidebarItem icon={Eye} label="Supervisores" active={activeTab === 'supervisores'} onClick={() => { handleNavigate('supervisores'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'motoristas') && (
                  <SidebarItem icon={Users} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => { handleNavigate('motoristas'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 5. FINANCEIRO */}
                {showFinGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Financeiro</div>}
                {hasAccess(userRole, 'contabilidade') && (
                  <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => { handleNavigate('contabilidade'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'centros_custos') && (
                  <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => { handleNavigate('centros-custos'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'fornecedores') && (
                  <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => { handleNavigate('fornecedores'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'clientes') && (
                  <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => { handleNavigate('clientes'); setIsMobileMenuOpen(false); }} />
                )}
                {hasAccess(userRole, 'relatorios') && (
                  <SidebarItem icon={BarChart3} label="Relatórios" active={activeTab === 'relatorios'} onClick={() => { handleNavigate('relatorios'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 6. SISTEMA */}
                <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Sistema</div>
                {userRole === 'admin' && (
                  <SidebarItem icon={Users} label="Gestão de Usuários" active={activeTab === 'admin_users'} onClick={() => { handleNavigate('admin_users'); setIsMobileMenuOpen(false); }} />
                )}
                {userRole === 'admin' && (
                  <SidebarItem icon={Shield} label="Permissões" active={activeTab === 'permissions'} onClick={() => { handleNavigate('permissions'); setIsMobileMenuOpen(false); }} />
                )}

                {/* 7. COMUNICAÇÃO */}
                <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Comunicação</div>
                {hasAccess(userRole, 'mensagens') && (
                  <SidebarItem icon={MessageSquare} label="Mensagens" active={activeTab === 'mensagens'} onClick={() => { handleNavigate('mensagens'); setIsMobileMenuOpen(false); }} badge={unreadCount > 0 ? unreadCount : undefined} />
                )}


                <div className="pt-8 mt-auto pb-4">
                  <UserProfileMenu onNavigate={() => { handleNavigate('meu-perfil'); setIsMobileMenuOpen(false); }} />
                </div>
              </nav>
            </div>
          )
          }

          <div className="flex-1 overflow-y-auto w-full relative flex flex-col custom-scrollbar">
            {renderContent()}
          </div>

          {/* Chat Widget (Overlay) - Show only if NOT on messages page */}
          {activeTab !== 'mensagens' && <ChatWidget />}
        </main >

        {/* NOTIFICATIONS DRAWER (Simplified) */}
        {
          showNotifications && (
            <div className="absolute right-0 top-0 h-full w-80 bg-[#1e293b] border-l border-slate-700 shadow-2xl z-50 p-4 animate-in slide-in-from-right">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white">Notificações</h3>
                <button onClick={() => setShowNotifications(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="space-y-2">
                {notifications.slice(0, 10).map(n => (
                  <div key={n.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-sm">
                    <p className="font-bold text-white capitalize">{n.type.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-400">{n.timestamp}</p>
                    {/* Actions could go here */}
                  </div>
                ))}
              </div>
            </div>
          )
        }
      </div>
    </div >
  );
}

import IntroVideo from './components/common/IntroVideo'; // Keeping import if user decides to revert, but commenting out usage below caused lint error. Actually I should remove it.

function App() {
  // const { isAuthenticated } = useAuth(); // Unused now

  return (

    <ChatProvider>
      <AppContent />
    </ChatProvider>

  );
}

export default App;

