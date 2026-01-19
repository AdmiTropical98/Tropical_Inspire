import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard, Users, UserCog, Car, MessageSquare, Menu, X,
  Truck, Calendar, Fuel, Clock, Wallet, Building2, Briefcase, Shield,
  BarChart3, MapPin, Hammer, Eye, ClipboardCheck, Bus, Award, LayoutTemplate,
  ChevronDown, ChevronRight, Settings, Wrench, UserCheck
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionsContext';
import { useWorkshop } from './contexts/WorkshopContext';
import { ChatProvider, useChat } from './contexts/ChatContext';

// Components
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/dashboard';
import { supabase } from './lib/supabase'; // Import Supabase client
import Fornecedores from './components/fornecedores';
import Viaturas from './components/viaturas';
import Drivers from './components/motoristas';
import Requisicoes from './components/requisicoes';
import Escalas from './components/escalas';
import Horas from './components/horas';
import FuelManager from './components/combustivel';
import EquipaOficina from './components/equipa-oficina';
import Supervisores from './components/supervisores';
import ExternalServices from './components/external';
import ChatWidget from './components/chat/ChatWidget';
import ChatPage from './components/chat/ChatPage'; // New Chat Page
import CentrosCustos from './components/centros-custos';
// Lazy Load CentralMotorista
const CentralMotorista = lazy(() => import('./components/central-motorista'));

import TransportesEva from './components/transportes-eva';
import UserProfileMenu from './components/common/UserProfileMenu';
import Contabilidade from './components/contabilidade';
import Clientes from './components/clientes';
import Relatorios from './components/relatorios'; // Import Relatorios
import AvaliacaoMotorista from './components/avaliacao'; // Import AvaliacaoMotorista
import Geofences from './components/geofences'; // Import Geofences component
import UsersPage from './components/users'; // Import UsersPage
import Locais from './components/locais'; // Import Locais (POIs)
import Permissoes from './components/permissoes';
import MyProfile from './components/profile/MyProfile';
import Gestores from './components/gestores';
// Lazy Load LancarEscala
const LancarEscala = lazy(() => import('./pages/LancarEscala'));

import SplashScreen from './components/SplashScreen';

import { LayoutProvider } from './contexts/LayoutContext';

// Helper for loading state
const PageLoading = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-4">
    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
    <p className="text-sm font-medium animate-pulse">A carregar módulo...</p>
  </div>
);

// Sidebar Item Component for consistent styling
const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: React.ElementType, label: string, active: boolean, onClick: () => void, badge?: number }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-300 relative group overflow-hidden
      ${active
        ? 'text-white bg-gradient-to-r from-blue-600/20 to-transparent border-l-[3px] border-blue-500'
        : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
      }
    `}
  >
    <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'text-blue-400 scale-110' : 'group-hover:text-blue-400 group-hover:scale-110'}`} />
    <span className="relative z-10">{label}</span>
    {active && <div className="absolute inset-0 bg-blue-500/5 blur-xl pointer-events-none" />}
    {badge ? (
      <span className="ml-auto bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
        {badge}
      </span>
    ) : null}
  </button>
);

const SidebarGroup = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filter out null/false children to check if group is empty
  const validChildren = Array.isArray(children) ? children.filter(Boolean) : (children ? [children] : []);

  if (validChildren.length === 0) return null;

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

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
  const { unreadCount } = useChat(); // Now we can use this!

  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'admin_users' | 'permissions' | 'requisicoes' | 'fornecedores' | 'viaturas' | 'motoristas' | 'escalas' | 'lancar-escala' | 'horas' | 'combustivel' | 'external' | 'equipa-oficina' | 'supervisores' | 'centros-custos' | 'central-motorista' | 'transportes-eva' | 'mensagens' | 'contabilidade' | 'clientes' | 'relatorios' | 'avaliacao' | 'geofences' | 'locais' | 'meu-perfil' | 'gestores'>('dashboard');

  // Sidebar Visibility Flags
  const showFleetGroup = hasAccess(userRole, 'central_motorista') || hasAccess(userRole, 'viaturas') || hasAccess(userRole, 'motoristas') || hasAccess(userRole, 'geofences') || userRole === 'admin' || userRole === 'gestor';
  const showOpsGroup = hasAccess(userRole, 'escalas') || hasAccess(userRole, 'requisicoes') || hasAccess(userRole, 'horas') || hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'plataformas_externas');
  const showFinGroup = hasAccess(userRole, 'contabilidade') || hasAccess(userRole, 'centros_custos') || hasAccess(userRole, 'fornecedores') || hasAccess(userRole, 'clientes') || hasAccess(userRole, 'relatorios');
  const showSysGroup = hasAccess(userRole, 'equipa-oficina') || hasAccess(userRole, 'supervisores') || userRole === 'admin' || userRole === 'gestor';
  const showCommGroup = hasAccess(userRole, 'mensagens');

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
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'admin_users':
        return <UsersPage />;
      case 'permissions':
        return (
          <div className="p-6 max-w-7xl mx-auto">
            <Permissoes />
          </div>
        );
      case 'escalas': return <Escalas />;
      case 'lancar-escala': return (
        <Suspense fallback={<PageLoading />}>
          <LancarEscala onNavigate={(tab) => setActiveTab(tab as any)} />
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
      default: return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  if (isResettingPassword) return <ResetPassword />;

  if (!isAuthenticated) return <Login />;

  return (
    <div className="flex bg-black h-[100dvh] text-slate-200 font-sans overflow-hidden">

      {/* Force deploy correction */}

      {/* DB Connection Error Banner */}
      {useWorkshop().dbConnectionError && (
        <div className="absolute top-0 left-0 w-full bg-red-600 text-white p-2 z-[9999] text-center font-bold flex items-center justify-center gap-2 shadow-xl animate-pulse">
          {useWorkshop().dbConnectionError} -- Verifique a Consola (F12) para detalhes.
          <button onClick={() => window.location.reload()} className="ml-4 underline text-xs">Recarregar</button>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-72 bg-[#0b1121] border-r border-slate-800/60 flex flex-col hidden md:flex z-50 shadow-2xl">
        <button
          onClick={() => isAuthenticated && setActiveTab(userRole === 'motorista' ? 'central-motorista' : 'dashboard')}
          className="h-40 border-b border-slate-800/60 flex items-center justify-center bg-gradient-to-r from-slate-900/50 to-transparent overflow-hidden hover:bg-slate-800/30 transition-colors cursor-pointer"
          title="Ir para Início"
        >
          <img src="/logo-algar-frota.png?v=4" alt="Gestão Frota" className="w-full h-full object-cover" />
        </button>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {/* MAIN MENU */}
          {hasAccess(userRole, 'dashboard') && (
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
          )}

          {showFleetGroup && (
            <SidebarGroup title="Gestão de Frota" icon={Car}>
              {hasAccess(userRole, 'central_motorista') && (
                <SidebarItem icon={UserCog} label="Central Motorista" active={activeTab === 'central-motorista'} onClick={() => setActiveTab('central-motorista')} />
              )}
              {hasAccess(userRole, 'viaturas') && (
                <SidebarItem icon={Car} label="Viaturas" active={activeTab === 'viaturas'} onClick={() => setActiveTab('viaturas')} />
              )}
              {hasAccess(userRole, 'geofences') && (
                <SidebarItem icon={MapPin} label="Geofences (Cartrack)" active={activeTab === 'geofences'} onClick={() => setActiveTab('geofences')} />
              )}
              {(userRole === 'admin' || hasAccess(userRole, 'escalas')) && (
                <SidebarItem icon={MapPin} label="Locais (POIs)" active={activeTab === 'locais'} onClick={() => setActiveTab('locais')} />
              )}
              {userRole === 'admin' && (
                <SidebarItem icon={Award} label="Avaliação Drivers" active={activeTab === 'avaliacao'} onClick={() => setActiveTab('avaliacao')} />
              )}
            </SidebarGroup>
          )}

          {showOpsGroup && (
            <SidebarGroup title="Operações" icon={ClipboardCheck}>
              {hasAccess(userRole, 'escalas') && (
                <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => setActiveTab('escalas')} />
              )}
              {hasAccess(userRole, 'escalas') && (userRole === 'admin' || userRole === 'supervisor' || userRole === 'gestor') && (
                <SidebarItem icon={LayoutTemplate} label="Lançar Escalas" active={activeTab === 'lancar-escala'} onClick={() => setActiveTab('lancar-escala')} />
              )}
              {hasAccess(userRole, 'horas') && (
                <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => setActiveTab('horas')} />
              )}
              {hasAccess(userRole, 'plataformas_externas') && (
                <SidebarItem icon={Bus} label="Transportes EVA" active={activeTab === 'transportes-eva'} onClick={() => setActiveTab('transportes-eva')} />
              )}
            </SidebarGroup>
          )}

          {/* 3. OFICINA - Adjusted logic if needed, but assuming check is fine. Assuming 'Oficina' group logic is missing in constants? No, let's use manual check if variable missing */}
          {/* Wait, showSysGroup exists but not showOficinaGroup. Let's create ad-hoc check or assume it's part of another group. 
              Checking line 114: showSysGroup includes equipa-oficina. 
              Let's look at lines 261-268. It contains 'combustivel' and 'requisicoes'.
              Ah, I see showOpsGroup includes 'combustivel' (line 112). 'requisicoes' is also in 'showOpsGroup'.
              So 'Oficina' items are actually in 'showOpsGroup' logic-wise in the variable definitions?
              Wait, line 112: `const showOpsGroup = ... || hasAccess(userRole, 'combustivel')`.
              So I should use `showOpsGroup` or create a new check. 
              Actually, looking at the code, 'Oficina' group contains Fuel and Requisicoes.
              Let's check if 'showOpsGroup' covers these. Yes in line 112: 'requisicoes' and 'combustivel'.
              So I can use `showOpsGroup`? But 'Operações' group also uses `showOpsGroup`.
              If I use it for both, they both appear/disappear together?
              Different items though.
              Let's just do inline check for simplicity and correctness: 
              (hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'requisicoes'))
          */}
          {(hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'requisicoes')) && (
            <SidebarGroup title="Oficina" icon={Wrench}>
              {hasAccess(userRole, 'combustivel') && (
                <SidebarItem icon={Fuel} label="Combustível" active={activeTab === 'combustivel'} onClick={() => setActiveTab('combustivel')} />
              )}
              {hasAccess(userRole, 'requisicoes') && (
                <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => setActiveTab('requisicoes')} />
              )}
            </SidebarGroup>
          )}

          {showSysGroup && (
            <SidebarGroup title="Equipa" icon={Users}>
              {(userRole === 'admin' || userRole === 'gestor') && (
                <SidebarItem icon={UserCheck} label="Gestores" active={activeTab === 'gestores'} onClick={() => setActiveTab('gestores')} />
              )}
              {hasAccess(userRole, 'equipa-oficina') && (
                <SidebarItem icon={Hammer} label="Equipa Oficina" active={activeTab === 'equipa-oficina'} onClick={() => setActiveTab('equipa-oficina')} />
              )}
              {hasAccess(userRole, 'supervisores') && (
                <SidebarItem icon={Eye} label="Supervisores" active={activeTab === 'supervisores'} onClick={() => setActiveTab('supervisores')} />
              )}
              {hasAccess(userRole, 'motoristas') && (
                <SidebarItem icon={Users} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => setActiveTab('motoristas')} />
              )}
            </SidebarGroup>
          )}

          {showFinGroup && (
            <SidebarGroup title="Financeiro" icon={Wallet}>
              {hasAccess(userRole, 'contabilidade') && (
                <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => setActiveTab('contabilidade')} />
              )}
              {hasAccess(userRole, 'centros_custos') && (
                <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => setActiveTab('centros-custos')} />
              )}
              {hasAccess(userRole, 'fornecedores') && (
                <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => setActiveTab('fornecedores')} />
              )}
              {hasAccess(userRole, 'clientes') && (
                <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => setActiveTab('clientes')} />
              )}
              {hasAccess(userRole, 'relatorios') && (
                <SidebarItem icon={BarChart3} label="Relatórios" active={activeTab === 'relatorios'} onClick={() => setActiveTab('relatorios')} />
              )}
            </SidebarGroup>
          )}

          {/* 6. SISTEMA */}
          <SidebarGroup title="Sistema" icon={Settings}>
            {userRole === 'admin' && (
              <SidebarItem icon={Users} label="Gestão de Usuários" active={activeTab === 'admin_users'} onClick={() => setActiveTab('admin_users')} />
            )}
            {userRole === 'admin' && (
              <SidebarItem icon={Shield} label="Permissões" active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} />
            )}
          </SidebarGroup>

          {/* 7. COMUNICAÇÃO */}
          <SidebarGroup title="Comunicação" icon={MessageSquare}>
            {hasAccess(userRole, 'mensagens') && (
              <SidebarItem icon={MessageSquare} label="Mensagens" active={activeTab === 'mensagens'} onClick={() => setActiveTab('mensagens')} badge={unreadCount > 0 ? unreadCount : undefined} />
            )}
          </SidebarGroup>

        </nav>

        {/* USER PROFILE */}
        <UserProfileMenu onNavigate={() => setActiveTab('meu-perfil')} />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-slate-950 relative">
        {/* Mobile Header - Only visible on mobile */}
        {/* Mobile Header - Only visible on mobile */}
        <header className="md:hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center shrink-0">
          <div className="flex items-center">
            <button onClick={() => isAuthenticated && setActiveTab(userRole === 'motorista' ? 'central-motorista' : 'dashboard')}>
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
              <h2 className="text-2xl font-bold text-white">Menu <span className="text-sm font-normal text-slate-500">v1.9</span></h2>
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
                  onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                />
              )}

              {/* 1. GESTÃO DE FROTA */}
              {showFleetGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Gestão de Frota</div>}
              {hasAccess(userRole, 'central_motorista') && (
                <SidebarItem icon={UserCog} label="Central Motorista" active={activeTab === 'central-motorista'} onClick={() => { setActiveTab('central-motorista'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'viaturas') && (
                <SidebarItem icon={Car} label="Viaturas" active={activeTab === 'viaturas'} onClick={() => { setActiveTab('viaturas'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'geofences') && (
                <SidebarItem icon={MapPin} label="Geofences (Cartrack)" active={activeTab === 'geofences'} onClick={() => { setActiveTab('geofences'); setIsMobileMenuOpen(false); }} />
              )}
              {(userRole === 'admin' || hasAccess(userRole, 'escalas')) && (
                <SidebarItem icon={MapPin} label="Locais (POIs)" active={activeTab === 'locais'} onClick={() => { setActiveTab('locais'); setIsMobileMenuOpen(false); }} />
              )}
              {userRole === 'admin' && (
                <SidebarItem icon={Award} label="Avaliação Drivers" active={activeTab === 'avaliacao'} onClick={() => { setActiveTab('avaliacao'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 2. OPERAÇÕES */}
              {showOpsGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Operações</div>}
              {hasAccess(userRole, 'escalas') && (
                <SidebarItem icon={Calendar} label="Escalas" active={activeTab === 'escalas'} onClick={() => { setActiveTab('escalas'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'escalas') && (userRole === 'admin' || userRole === 'supervisor' || userRole === 'gestor') && (
                <SidebarItem icon={LayoutTemplate} label="Lançar Escalas" active={activeTab === 'lancar-escala'} onClick={() => { setActiveTab('lancar-escala'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'horas') && (
                <SidebarItem icon={Clock} label="Registo de Horas" active={activeTab === 'horas'} onClick={() => { setActiveTab('horas'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'plataformas_externas') && (
                <SidebarItem icon={Bus} label="Transportes EVA" active={activeTab === 'transportes-eva'} onClick={() => { setActiveTab('transportes-eva'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 3. OFICINA */}
              {(hasAccess(userRole, 'combustivel') || hasAccess(userRole, 'requisicoes')) && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Oficina</div>}
              {hasAccess(userRole, 'combustivel') && (
                <SidebarItem icon={Fuel} label="Combustível" active={activeTab === 'combustivel'} onClick={() => { setActiveTab('combustivel'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'requisicoes') && (
                <SidebarItem icon={ClipboardCheck} label="Requisições" active={activeTab === 'requisicoes'} onClick={() => { setActiveTab('requisicoes'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 4. EQUIPA */}
              {showSysGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Equipa</div>}
              {(userRole === 'admin' || userRole === 'gestor') && (
                <SidebarItem icon={Shield} label="Gestores" active={activeTab === 'gestores'} onClick={() => { setActiveTab('gestores'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'equipa-oficina') && (
                <SidebarItem icon={Hammer} label="Equipa Oficina" active={activeTab === 'equipa-oficina'} onClick={() => { setActiveTab('equipa-oficina'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'supervisores') && (
                <SidebarItem icon={Eye} label="Supervisores" active={activeTab === 'supervisores'} onClick={() => { setActiveTab('supervisores'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'motoristas') && (
                <SidebarItem icon={Users} label="Motoristas" active={activeTab === 'motoristas'} onClick={() => { setActiveTab('motoristas'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 5. FINANCEIRO */}
              {showFinGroup && <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Financeiro</div>}
              {hasAccess(userRole, 'contabilidade') && (
                <SidebarItem icon={Wallet} label="Contabilidade" active={activeTab === 'contabilidade'} onClick={() => { setActiveTab('contabilidade'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'centros_custos') && (
                <SidebarItem icon={Building2} label="Centros de Custos" active={activeTab === 'centros-custos'} onClick={() => { setActiveTab('centros-custos'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'fornecedores') && (
                <SidebarItem icon={Truck} label="Fornecedores" active={activeTab === 'fornecedores'} onClick={() => { setActiveTab('fornecedores'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'clientes') && (
                <SidebarItem icon={Briefcase} label="Clientes" active={activeTab === 'clientes'} onClick={() => { setActiveTab('clientes'); setIsMobileMenuOpen(false); }} />
              )}
              {hasAccess(userRole, 'relatorios') && (
                <SidebarItem icon={BarChart3} label="Relatórios" active={activeTab === 'relatorios'} onClick={() => { setActiveTab('relatorios'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 6. SISTEMA */}
              <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Sistema</div>
              {userRole === 'admin' && (
                <SidebarItem icon={Users} label="Gestão de Usuários" active={activeTab === 'admin_users'} onClick={() => { setActiveTab('admin_users'); setIsMobileMenuOpen(false); }} />
              )}
              {userRole === 'admin' && (
                <SidebarItem icon={Shield} label="Permissões" active={activeTab === 'permissions'} onClick={() => { setActiveTab('permissions'); setIsMobileMenuOpen(false); }} />
              )}

              {/* 7. COMUNICAÇÃO */}
              <div className="px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 mt-6">Comunicação</div>
              {hasAccess(userRole, 'mensagens') && (
                <SidebarItem icon={MessageSquare} label="Mensagens" active={activeTab === 'mensagens'} onClick={() => { setActiveTab('mensagens'); setIsMobileMenuOpen(false); }} badge={unreadCount > 0 ? unreadCount : undefined} />
              )}


              <div className="pt-8 mt-auto pb-4">
                <UserProfileMenu onNavigate={() => { setActiveTab('meu-perfil'); setIsMobileMenuOpen(false); }} />
              </div>
            </nav>
          </div>
        )
        }

        <div className="flex-1 overflow-y-auto relative w-full flex flex-col min-h-0 custom-scrollbar">
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
    </div >
  );
}

function App() {
  return (
    <LayoutProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </LayoutProvider>
  );
}

export default App;

