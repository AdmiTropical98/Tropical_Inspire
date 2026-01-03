import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, UserCog, Bus, MessageSquare, Menu, X,
  Truck, Calendar, Fuel, Clock, Wallet, Building2, Briefcase, Shield
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionsContext';
import { useWorkshop } from './contexts/WorkshopContext';
import { ChatProvider } from './contexts/ChatContext';

// Components
import Login from './components/Login';
import ResetPassword from './components/ResetPassword'; // Import ResetPassword
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
import CentralMotorista from './components/central-motorista';
import TransportesEva from './components/transportes-eva';
import UserProfileMenu from './components/common/UserProfileMenu';
import Contabilidade from './components/contabilidade';
import Clientes from './components/clientes';
import PermissionsManager from './components/dashboard/PermissionsManager'; // Import PermissionsManager

function App() {
  const { isAuthenticated, userRole } = useAuth();
  const { hasAccess } = usePermissions();
  const { notifications } = useWorkshop();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'admin_users' | 'permissions' | 'requisicoes' | 'fornecedores' | 'viaturas' | 'motoristas' | 'escalas' | 'horas' | 'combustivel' | 'external' | 'equipa-oficina' | 'supervisores' | 'centros-custos' | 'central-motorista' | 'transportes-eva' | 'mensagens' | 'contabilidade' | 'clientes'>('dashboard');

  // Notification & Modal State
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false); // State for password reset mode

  // Listen for Password Recovery Event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
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
      if (userRole === 'motorista') setActiveTab('central-motorista');
      else if (userRole === 'oficina') setActiveTab('equipa-oficina');
      else if (userRole === 'supervisor') setActiveTab('supervisores');
      else setActiveTab('dashboard');
    }
  }, [isAuthenticated, userRole]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'overview':
      case 'admin_users': // Add cases handled by Dashboard
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'permissions':
        return (
          <div className="p-6 max-w-7xl mx-auto">
            <PermissionsManager />
          </div>
        );
      case 'escalas': return <Escalas />;
      case 'horas': return <Horas />;
      case 'equipa-oficina': return <EquipaOficina />;
      case 'supervisores': return <Supervisores />;
      case 'centros-custos': return <CentrosCustos />;
      case 'central-motorista': return <CentralMotorista />;
      case 'transportes-eva': return <TransportesEva />;
      case 'mensagens': return <ChatPage />;
      case 'combustivel': return <FuelManager />;
      case 'viaturas': return <Viaturas />;
      case 'motoristas': return <Drivers />;
      case 'requisicoes': return <Requisicoes />;
      case 'fornecedores': return <Fornecedores />;
      case 'contabilidade': return <Contabilidade />;
      case 'clientes': return <Clientes />;
      case 'external': return <ExternalServices />;
      default: return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
  };

  if (isResettingPassword) return <ResetPassword />;

  if (!isAuthenticated) return <Login />;

  const unreadCount = notifications.filter(n => n.status === 'pending' && n.type !== 'system_alert').length;

  return (
    <ChatProvider>
      <div className="flex bg-black min-h-screen text-slate-200 font-sans overflow-hidden">
        {/* Force deploy correction */}

        {/* SIDEBAR */}
        <aside className="w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col hidden md:flex z-50">
          <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">Gestão<span className="text-blue-500">Frota</span></span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
            {/* MAIN MENU */}
            {/* Using basic role check or assumes 'dashboard' is mostly public/default */}
            <button onClick={() => setActiveTab('dashboard')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </button>

            {hasAccess(userRole, 'central_motorista') && (
              <button onClick={() => setActiveTab('central-motorista')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'central-motorista' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}>
                <UserCog className="w-5 h-5" />
                <span className="font-medium">Central Motorista</span>
              </button>
            )}

            {/* OPERAÇÕES */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Operações</p>

              {hasAccess(userRole, 'escalas') && (
                <button onClick={() => setActiveTab('escalas')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'escalas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">Escalas</span>
                </button>
              )}

              {hasAccess(userRole, 'combustivel') && (
                <button onClick={() => setActiveTab('combustivel')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'combustivel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Fuel className="w-5 h-5" />
                  <span className="font-medium">Combustível</span>
                </button>
              )}

              {hasAccess(userRole, 'viaturas') && (
                <button onClick={() => setActiveTab('viaturas')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'viaturas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Bus className="w-5 h-5" />
                  <span className="font-medium">Viaturas</span>
                </button>
              )}

              {hasAccess(userRole, 'motoristas') && (
                <button onClick={() => setActiveTab('motoristas')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'motoristas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Motoristas</span>
                </button>
              )}

              {hasAccess(userRole, 'requisicoes') && (
                <button onClick={() => setActiveTab('requisicoes')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'requisicoes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Requisições</span>
                </button>
              )}

              {hasAccess(userRole, 'horas') && (
                <button onClick={() => setActiveTab('horas')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'horas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Registo Horas</span>
                </button>
              )}

              {hasAccess(userRole, 'plataformas_externas') && (
                <button onClick={() => setActiveTab('transportes-eva')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'transportes-eva' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Bus className="w-5 h-5" />
                  <span className="font-medium">Transportes EVA</span>
                </button>
              )}
            </div>

            {/* GESTÃO / ADMIN */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Administração</p>

              {hasAccess(userRole, 'equipa-oficina') && (
                <button onClick={() => setActiveTab('equipa-oficina')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'equipa-oficina' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Equipa Oficina</span>
                </button>
              )}

              {hasAccess(userRole, 'contabilidade') && (
                <button onClick={() => setActiveTab('contabilidade')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'contabilidade' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">Contabilidade</span>
                </button>
              )}

              {hasAccess(userRole, 'supervisores') && (
                <button onClick={() => setActiveTab('supervisores')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'supervisores' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <UserCog className="w-5 h-5" />
                  <span className="font-medium">Supervisores</span>
                </button>
              )}

              {hasAccess(userRole, 'centros_custos') && (
                <button onClick={() => setActiveTab('centros-custos')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'centros-custos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">Centros Custos</span>
                </button>
              )}

              {hasAccess(userRole, 'fornecedores') && (
                <button onClick={() => setActiveTab('fornecedores')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'fornecedores' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Truck className="w-5 h-5" />
                  <span className="font-medium">Fornecedores</span>
                </button>
              )}

              {hasAccess(userRole, 'clientes') && (
                <button onClick={() => setActiveTab('clientes')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'clientes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Briefcase className="w-5 h-5" />
                  <span className="font-medium">Clientes</span>
                </button>
              )}

              {userRole === 'admin' && (
                <button onClick={() => setActiveTab('permissions')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all ${activeTab === 'permissions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">Permissões</span>
                </button>
              )}
            </div>

            {/* COMUNICAÇÃO */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comunicação</p>
              <button onClick={() => setActiveTab('mensagens')} className={`w - full flex items - center gap - 3 px - 4 py - 3 rounded - xl transition - all group ${activeTab === 'mensagens' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'} `}>
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">Mensagens</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </nav>

          {/* USER PROFILE */}
          <UserProfileMenu />
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-slate-950 relative">
          {/* Mobile Header - Only visible on mobile */}
          {(activeTab === 'dashboard' || activeTab === 'overview' || activeTab === 'admin_users' || activeTab === 'permissions' || activeTab === 'transportes-eva' || activeTab === 'central-motorista') && ( // Show header for proper tabs
            <header className="md:hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center shrink-0">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
                GestãoFrota
              </h1>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <Menu className="w-6 h-6" />
              </button>
            </header>
          )}

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col p-6 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white">Menu</h2>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white">
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium">Dashboard</span>
                </button>
                <button onClick={() => { setActiveTab('transportes-eva'); setIsMobileMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white">
                  <Bus className="w-5 h-5" />
                  <span className="font-medium">Transportes EVA</span>
                </button>
                <button onClick={() => { setActiveTab('central-motorista'); setIsMobileMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white">
                  <UserCog className="w-5 h-5" />
                  <span className="font-medium">Central Motorista</span>
                </button>
                {/* Add more links if needed, or keep it simple for now */}
              </nav>
            </div>
          )}

          <div className="flex-1 overflow-auto custom-scrollbar relative w-full">
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
    </ChatProvider >
  );
}

export default App;
