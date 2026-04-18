import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, Car, MessageSquare, Menu,
  Truck, Calendar, Clock, Wallet, Building2, Briefcase, Shield,
  BarChart3, MapPin, Hammer, Award, LayoutTemplate,
  ChevronDown, ChevronRight, UserCheck, Activity,
  Gauge, Settings2, UserCog as UserCogIcon, LogOut,
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
import LayoutMobile from './components/layout/LayoutMobile';
import LayoutDesktop from './components/layout/LayoutDesktop';

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

interface NavItem {
  key: string;
  label: string;
  icon: any;
  path: string;
  active: boolean;
  badge?: number;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const TopNavItem: React.FC<{ item: NavItem; onNavigate: (path: string) => void; mobile?: boolean }> = ({ item, onNavigate, mobile = false }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={`group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[14px] transition-all duration-300 ${item.active
        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/40'
        : mobile
          ? 'text-white/80 hover:bg-white/10 hover:text-white'
          : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
    >
      <Icon className={`h-[18px] w-[18px] transition-transform duration-300 ${item.active ? 'scale-110 text-white' : 'text-slate-400 group-hover:scale-110 group-hover:text-white'}`} />
      <span>{item.label}</span>
      {item.badge && item.badge > 0 && (
        <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/20">{item.badge}</span>
      )}
      {item.active && !mobile && <span className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-blue-300" />}
    </button>
  );
};

const TopNavDropdown: React.FC<{
  group: NavGroup;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onClose: () => void;
}> = ({ group, onNavigate, isOpen, onToggle, onOpen, onClose }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const hasActiveChild = group.items.some(item => item.active);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-visible"
      onMouseEnter={onOpen}
    >
      <button
        onClick={onToggle}
        className={`group relative flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] transition-all duration-300 ${hasActiveChild
          ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/40'
          : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
      >
        <span>{group.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {hasActiveChild && <span className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-blue-300" />}
      </button>

      <div
        className={`absolute left-1/2 top-full z-[9999] mt-3 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1e293b]/95 p-2 shadow-xl shadow-black/40 backdrop-blur-sm transition-all duration-200 ${isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'}`}
      >
        {group.items.map(item => (
          <TopNavItem key={item.key} item={item} onNavigate={onNavigate} mobile />
        ))}
      </div>
    </div>
  );
};

const UserProfileMenu: React.FC<{ onNavigate: (path: string) => void; showName?: boolean; compact?: boolean }> = ({ onNavigate, showName = true, compact = false }) => {
  const { currentUser, userPhoto, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [navbarAvatarSrc, setNavbarAvatarSrc] = useState('');
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const avatarSrc = userPhoto || (currentUser as any)?.avatar || (currentUser as any)?.avatar_url || (currentUser as any)?.foto || '';

  const spritePositions: Record<string, string> = {
    OFICINA: '0% 0%',
    GESTOR: '50% 0%',
    ADMINISTRADOR: '100% 0%',
    SUPERVISOR: '0% 100%',
    MOTORISTA: '50% 100%',
    COLABORADOR: '100% 100%'
  };

  const isSpriteAvatar = (value: string) => value.startsWith('sprite:');
  const getSpriteRole = (value: string) => value.replace('sprite:', '').toUpperCase();
  const spriteCandidates = [
    '/AVATARES.PNG',
    '/avatares.png',
    '/assets/img/avatars/AVATARES.PNG',
    '/assets/img/avatars/avatares.png',
    '/avatars/AVATARES.PNG',
    '/avatars/avatares.png'
  ];

  useEffect(() => {
    setNavbarAvatarSrc(avatarSrc);
  }, [avatarSrc]);

  const hasAvatar = Boolean(navbarAvatarSrc);
  const isSpriteNavbarAvatar = hasAvatar && isSpriteAvatar(navbarAvatarSrc);

  useEffect(() => {
    let mounted = true;

    const resolveSprite = async () => {
      for (const candidate of spriteCandidates) {
        const exists = await new Promise<boolean>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = `${candidate}?v=1`;
        });

        if (exists) {
          if (mounted) setSpriteUrl(candidate);
          return;
        }
      }

      if (mounted) setSpriteUrl(null);
    };

    void resolveSprite();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setShowMenu(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMenu]);

  const isAvatarOnly = compact && !showName;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={isAvatarOnly
          ? 'flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 p-0 shadow-sm transition-all hover:bg-white hover:border-slate-300'
          : 'flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 transition-all hover:bg-white hover:border-slate-300'}
      >
        <div className={`avatar-3d overflow-hidden rounded-full bg-blue-600 text-center text-white shadow-md ring-2 ring-slate-200 ${isAvatarOnly ? 'h-8 w-8' : 'h-9 w-9'}`}>
          {isSpriteNavbarAvatar && spriteUrl ? (
            <div
              id="navbarAvatar"
              className="h-full w-full"
              style={{
                backgroundImage: `url('${spriteUrl}')`,
                backgroundSize: '300% 200%',
                backgroundPosition: spritePositions[getSpriteRole(navbarAvatarSrc)] || spritePositions.COLABORADOR,
                backgroundRepeat: 'no-repeat'
              }}
            />
          ) : hasAvatar ? (
            <img
              id="navbarAvatar"
              src={navbarAvatarSrc}
              alt={currentUser?.nome || 'Avatar'}
              className="h-full w-full object-cover"
              onError={() => setNavbarAvatarSrc('/assets/img/avatars/avatar_colaborador.svg')}
            />
          ) : (
            <span>{currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : 'M'}</span>
          )}
        </div>
        {showName && (
          <div className="text-left">
            <p className="max-w-36 truncate text-sm font-bold text-slate-900">{currentUser?.nome || 'Utilizador'}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{(currentUser as any)?.role || 'ADMIN MANAGER'}</p>
          </div>
        )}
      </button>

      {showMenu && (
        <div className={`absolute right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 ${isAvatarOnly ? 'w-36' : 'w-56'}`}>
          <button
            onClick={() => { onNavigate('meu-perfil'); setShowMenu(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            <UserCogIcon className="w-4 h-4" /> Perfil
          </button>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500 transition-all hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const MOBILE_MAX_WIDTH = 768;
  const SIDEBAR_LOGO = '/LOGO.png';
  const { isAuthenticated, userRole } = useAuth();
  const { hasAccess } = usePermissions();
  const { unreadCount } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCapacitorNative = Capacitor.isNativePlatform();
  const isCapacitorAndroid = isCapacitorNative && Capacitor.getPlatform() === 'android';
  const isMobileViewport = viewportWidth < MOBILE_MAX_WIDTH;
  const isMobileLayout = isCapacitorNative || isMobileViewport;

  useEffect(() => {
    const root = document.getElementById('root');

    if (!isCapacitorAndroid) {
      document.documentElement.classList.remove('android-native-root');
      document.body.classList.remove('android-native-root');
      root?.classList.remove('android-native-root');
      document.documentElement.style.removeProperty('width');
      document.documentElement.style.removeProperty('max-width');
      document.documentElement.style.removeProperty('overflow-x');
      document.body.style.removeProperty('width');
      document.body.style.removeProperty('max-width');
      document.body.style.removeProperty('overflow-x');
      root?.style.removeProperty('width');
      root?.style.removeProperty('max-width');
      root?.style.removeProperty('margin');
      root?.style.removeProperty('padding');
      root?.style.removeProperty('overflow-x');
      return;
    }

    document.documentElement.classList.add('android-native-root');
    document.body.classList.add('android-native-root');
    root?.classList.add('android-native-root');
    document.documentElement.style.width = '100vw';
    document.documentElement.style.maxWidth = '100vw';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.width = '100vw';
    document.body.style.maxWidth = '100vw';
    document.body.style.overflowX = 'hidden';

    if (root) {
      root.style.width = '100vw';
      root.style.maxWidth = '100vw';
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.overflowX = 'hidden';
    }

    return () => {
      document.documentElement.classList.remove('android-native-root');
      document.body.classList.remove('android-native-root');
      root?.classList.remove('android-native-root');
      document.documentElement.style.removeProperty('width');
      document.documentElement.style.removeProperty('max-width');
      document.documentElement.style.removeProperty('overflow-x');
      document.body.style.removeProperty('width');
      document.body.style.removeProperty('max-width');
      document.body.style.removeProperty('overflow-x');
      root?.style.removeProperty('width');
      root?.style.removeProperty('max-width');
      root?.style.removeProperty('margin');
      root?.style.removeProperty('padding');
      root?.style.removeProperty('overflow-x');
    };
  }, [isCapacitorAndroid]);

  // Derive activeTab from current path
  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const isFleetRoute = activeTab === 'viaturas' || activeTab === 'vehicles';
  const fuelTab = new URLSearchParams(location.search).get('tab') || 'overview';
  const handleNavigate = (target: string) => {
    const path = target.startsWith('/') ? target : `/${target}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateFromAnchor = (event: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    event.preventDefault();
    handleNavigate(target);
  };

  const isMapPage = location.pathname === '/roteirizacao' || location.pathname === '/geofences';
  const isFullScreenPage = isMapPage;

  const isColaboradorArea =
    location.pathname === '/colaborador' ||
    location.pathname.startsWith('/colaborador/');

  if (isColaboradorArea) {
    return (
      <div className={`app-root min-h-screen bg-transparent text-slate-900 font-sans selection:bg-amber-500/20 ${isCapacitorAndroid ? 'android-native-shell w-screen max-w-[100vw] m-0 p-0' : 'w-full'}`}>
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

  const dashboardItem: NavItem = {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    active: activeTab === 'dashboard',
  };

  const operationsGroup: NavGroup = {
    key: 'operacoes',
    label: 'Operações',
    items: [
      {
        key: 'controlo-operacional',
        label: 'Centro Operacional',
        icon: Activity,
        path: '/controlo-operacional',
        active: activeTab === 'controlo-operacional',
      },
      {
        key: 'alerts',
        label: 'Alertas',
        icon: AlertTriangle,
        path: '/alerts',
        active: activeTab === 'alerts',
      },
      ...(hasAccess(userRole, 'escalas')
        ? [
          {
            key: 'escalas',
            label: 'Escalas',
            icon: Calendar,
            path: '/escalas',
            active: activeTab === 'escalas',
          },
          {
            key: 'lancar-escalas',
            label: 'Planear Escala',
            icon: LayoutTemplate,
            path: '/lancar-escalas',
            active: activeTab === 'lancar-escalas',
          },
        ] as NavItem[]
        : []),
      ...(hasAccess(userRole, 'requisicoes')
        ? [{
          key: 'requisicoes',
          label: 'Requisições',
          icon: ClipboardCheck,
          path: '/requisicoes',
          active: activeTab === 'requisicoes',
        } as NavItem]
        : []),
    ],
  };

  const fleetGroup: NavGroup = {
    key: 'frota',
    label: 'Frota',
    items: [
      ...(hasAccess(userRole, 'viaturas')
        ? [{
          key: 'viaturas',
          label: 'Viaturas',
          icon: Car,
          path: '/viaturas',
          active: isFleetRoute,
        } as NavItem]
        : []),
      ...(hasAccess(userRole, 'motoristas')
        ? [{
          key: 'motoristas',
          label: 'Motoristas',
          icon: UserCogIcon,
          path: '/motoristas',
          active: activeTab === 'motoristas',
        } as NavItem]
        : []),
      ...(hasAccess(userRole, 'avaliacao_drivers')
        ? [{
          key: 'avaliacao-drivers',
          label: 'Performance',
          icon: Award,
          path: '/avaliacao-drivers',
          active: activeTab === 'avaliacao-drivers',
        } as NavItem]
        : []),
    ],
  };

  const fuelGroup: NavGroup = {
    key: 'combustivel',
    label: 'Combustível',
    items: [
      {
        key: 'fuel-overview',
        label: 'Geral',
        icon: Fuel,
        path: '/combustivel?tab=overview',
        active: activeTab === 'combustivel' && fuelTab === 'overview',
      },
      {
        key: 'fuel-abastecer',
        label: 'Abastecer',
        icon: Fuel,
        path: '/combustivel?tab=abastecer',
        active: activeTab === 'combustivel' && fuelTab === 'abastecer',
      },
      {
        key: 'fuel-tanque',
        label: 'Tanque',
        icon: BatteryCharging,
        path: '/combustivel?tab=tanque',
        active: activeTab === 'combustivel' && fuelTab === 'tanque',
      },
      {
        key: 'fuel-historico',
        label: 'Histórico',
        icon: History,
        path: '/combustivel?tab=historico',
        active: activeTab === 'combustivel' && fuelTab === 'historico',
      },
      {
        key: 'fuel-relatorios',
        label: 'Relatórios',
        icon: BarChart3,
        path: '/combustivel?tab=relatorios',
        active: activeTab === 'combustivel' && fuelTab === 'relatorios',
      },
    ],
  };

  const moreGroup: NavGroup = {
    key: 'mais',
    label: 'Mais',
    items: [
      ...(hasAccess(userRole, 'roteirizacao') ? [{ key: 'roteirizacao', label: 'Roteirização', icon: Navigation, path: '/roteirizacao', active: activeTab === 'roteirizacao' } as NavItem] : []),
      { key: 'linha-transportes', label: 'Linha Transportes', icon: Navigation, path: '/linha-transportes', active: activeTab === 'linha-transportes' },
      ...(hasAccess(userRole, 'geofences') ? [{ key: 'geofences', label: 'Cercas Geográficas', icon: MapPin, path: '/geofences', active: activeTab === 'geofences' } as NavItem] : []),
      ...(hasAccess(userRole, 'utilizadores') ? [{ key: 'utilizadores', label: 'Perfis', icon: UserCheck, path: '/utilizadores', active: activeTab === 'utilizadores' } as NavItem] : []),
      ...(hasAccess(userRole, 'utilizadores') ? [{ key: 'colaboradores', label: 'Colaboradores', icon: IdCard, path: '/colaboradores', active: activeTab === 'colaboradores' } as NavItem] : []),
      {
        key: 'mensagens',
        label: 'Central de Mensagens',
        icon: MessageSquare,
        path: '/mensagens',
        active: activeTab === 'mensagens',
        badge: unreadCount,
      },
    ],
  };

  const desktopGroups = [operationsGroup, fleetGroup, fuelGroup, moreGroup].filter(group => group.items.length > 0);

  const bottomNavItems = [
    {
      key: 'bottom-dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: activeTab === 'dashboard',
      onClick: () => handleNavigate('/dashboard'),
    },
    {
      key: 'bottom-roteirizacao',
      label: 'Roteirização',
      icon: Navigation,
      active: activeTab === 'roteirizacao',
      onClick: () => handleNavigate('/roteirizacao'),
    },
    {
      key: 'bottom-frota',
      label: 'Frota',
      icon: Car,
      active: ['viaturas', 'vehicles', 'motoristas', 'avaliacao-drivers'].includes(activeTab),
      onClick: () => handleNavigate('/viaturas'),
    },
    {
      key: 'bottom-combustivel',
      label: 'Combustível',
      icon: Fuel,
      active: activeTab === 'combustivel',
      onClick: () => handleNavigate('/combustivel'),
    },
    {
      key: 'bottom-mais',
      label: 'Mais',
      icon: Settings2,
      active: moreGroup.items.some(item => item.active),
      onClick: () => undefined,
    },
  ];

  const moreMenuItems = moreGroup.items.map(item => ({
    key: `more-${item.key}`,
    label: item.label,
    icon: item.icon,
    active: item.active,
    onClick: () => handleNavigate(item.path),
  }));

  const appRoutes = (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A carregar módulo...</p>
      </div>
    }>
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
    </Suspense>
  );

  const desktopNavbar = (
    <nav className="navbar navbar-expand-lg custom-navbar sticky top-0 z-[5000]">
      <div className="container-fluid px-4 sm:px-6 lg:px-8">
        <a className="navbar-brand" href="/" onClick={(event) => navigateFromAnchor(event, '/dashboard')}>
          <img src={`${SIDEBAR_LOGO}?v=3`} alt="Algartempo Frota" className="navbar-logo-image" />
        </a>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNavbar">
          <ul className="navbar-nav mx-auto align-items-lg-center">
            <li className="nav-item">
              <a
                className={`nav-link ${dashboardItem.active ? 'active' : ''}`}
                href={dashboardItem.path}
                onClick={(event) => navigateFromAnchor(event, dashboardItem.path)}
              >
                Dashboard
              </a>
            </li>

            {desktopGroups.map(group => {
              const isActiveGroup = group.items.some(item => item.active);
              return (
                <li key={group.key} className="nav-item dropdown">
                  <a
                    className={`nav-link dropdown-toggle ${isActiveGroup ? 'active' : ''}`}
                    href="#"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    {group.label}
                  </a>
                  <ul className="dropdown-menu">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <li key={item.key}>
                          <a
                            className={`dropdown-item d-flex align-items-center gap-2 ${item.active ? 'active' : ''}`}
                            href={item.path}
                            onClick={(event) => navigateFromAnchor(event, item.path)}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            {item.badge && item.badge > 0 && (
                              <span className="ms-auto rounded-pill bg-primary px-2 py-0 text-[10px] fw-bold text-white">{item.badge}</span>
                            )}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>

          <div className="navbar-user ms-lg-3 mt-3 mt-lg-0">
            <UserProfileMenu onNavigate={handleNavigate} showName compact />
          </div>
        </div>
      </div>
    </nav>
  );

  if (isCapacitorAndroid) {
    return (
      <LayoutMobile
        logoSrc={`${SIDEBAR_LOGO}?v=3`}
        onLogoClick={() => handleNavigate('/dashboard')}
        userMenu={<UserProfileMenu onNavigate={handleNavigate} compact showName={false} />}
        isMapPage={isMapPage}
        bottomNavItems={bottomNavItems}
        moreMenuItems={moreMenuItems}
      >
        {appRoutes}
      </LayoutMobile>
    );
  }

  if (isMobileLayout) {
    return (
      <LayoutMobile
        logoSrc={`${SIDEBAR_LOGO}?v=3`}
        onLogoClick={() => handleNavigate('/dashboard')}
        userMenu={<UserProfileMenu onNavigate={handleNavigate} compact />}
        isMapPage={isMapPage}
        bottomNavItems={bottomNavItems}
        moreMenuItems={moreMenuItems}
      >
        {appRoutes}
      </LayoutMobile>
    );
  }

  return (
    <LayoutDesktop isFullScreenPage={isFullScreenPage} navbar={desktopNavbar}>
      {appRoutes}
    </LayoutDesktop>
  );
}

export default App;
