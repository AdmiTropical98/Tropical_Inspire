import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  LogOut,
  LayoutTemplate,
  MapPin,
  Navigation2,
  Search,
  Truck,
  Users,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Roteirizacao from './pages/Roteirizacao';
import LinhaTransportes from './pages/LinhaTransportes';
import Geofences from './pages/Geofences';
import Colaboradores from './pages/Colaboradores';
import Escalas from '../Escalas';
import LancarEscala from '../LancarEscala';
import './operacoes-theme.css';

interface OperacoesNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const OPERACOES_NAV: OperacoesNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/operacoes/dashboard' },
  { key: 'roteirizacao', label: 'Roteirização', icon: Navigation2, path: '/operacoes/roteirizacao' },
  { key: 'linha-transportes', label: 'Linha Transportes', icon: Truck, path: '/operacoes/linha-transportes' },
  { key: 'geofences', label: 'Cercas Geográficas', icon: MapPin, path: '/operacoes/geofences' },
  { key: 'colaboradores', label: 'Colaboradores', icon: Users, path: '/operacoes/colaboradores' },
  { key: 'escalas', label: 'Escalas', icon: Calendar, path: '/operacoes/escalas' },
  { key: 'planear-escala', label: 'Planear Escala', icon: LayoutTemplate, path: '/operacoes/planear-escala' },
];

function operacoesPathTitle(pathname: string): string {
  const item = OPERACOES_NAV.find((entry) => pathname.startsWith(entry.path));
  return item?.label || 'Operações';
}

export default function OperacoesModule() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const [search, setSearch] = useState('');

  const filteredNav = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return OPERACOES_NAV;
    return OPERACOES_NAV.filter((item) => item.label.toLowerCase().includes(term));
  }, [search]);

  const title = operacoesPathTitle(location.pathname);

  return (
    <div className="operacoes-theme min-h-[100dvh] text-slate-100">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1760px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-[220px] shrink-0 flex-col border-r border-orange-400/30 bg-[#031224c9] p-2 lg:flex">
          <div className="rounded-2xl border border-orange-400/35 bg-[#081a2fc7] px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300">Módulo</p>
            <h1 className="mt-1 text-lg font-black tracking-tight text-white">Operações</h1>
            <p className="mt-1.5 text-xs text-slate-300">Sistema independente da Frota</p>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar menus, operações..."
              className="h-9.5 w-full rounded-xl border border-orange-400/30 bg-[#081a2f] pl-10 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-orange-300"
            />
          </div>

          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition ${active ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)]' : 'text-slate-300 hover:bg-[#0f2238] hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-3 rounded-2xl border border-orange-400/20 bg-[#07182b] p-2.5 text-xs text-slate-300">
            <p className="font-semibold text-white">Sessão</p>
            <p className="mt-1 truncate text-[11px]">{currentUser?.nome || 'Utilizador'}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 hover:bg-rose-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-orange-400/20 bg-[#031224de] px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-300">Gestão de Operações</p>
                <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
              </div>
            </div>

            <div className="mt-3 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {OPERACOES_NAV.map((item) => {
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${active ? 'bg-orange-500 text-white' : 'bg-[#0f2238] text-slate-300'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
            <Routes>
              <Route path="/operacoes" element={<Navigate to="/operacoes/dashboard" replace />} />
              <Route
                path="/operacoes/dashboard"
                element={
                  <section className="rounded-3xl border border-orange-400/20 bg-[#081a2fcc] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-8">
                    <h2 className="text-2xl font-black tracking-[-0.02em] text-white">Bem-vindo às Operações</h2>
                    <p className="mt-2 max-w-3xl text-sm text-slate-300">
                      Acesse os módulos de Roteirização, Linha Transportes, Cercas Geográficas e Colaboradores para gerenciar todas as operações logísticas.
                    </p>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {[
                        'Dados dedicados às Operações',
                        'Sem dependência de tabelas da Frota',
                        'Dashboard com todas as funcionalidades',
                      ].map((text) => (
                        <article key={text} className="rounded-2xl border border-orange-400/20 bg-[#0f2238] px-4 py-3 text-sm font-medium text-slate-200">
                          {text}
                        </article>
                      ))}
                    </div>
                  </section>
                }
              />
              <Route path="/operacoes/roteirizacao" element={<Roteirizacao />} />
              <Route path="/operacoes/linha-transportes" element={<LinhaTransportes />} />
              <Route path="/operacoes/geofences" element={<Geofences />} />
              <Route path="/operacoes/colaboradores" element={<Colaboradores />} />
              <Route path="/operacoes/escalas" element={<Escalas />} />
              <Route path="/operacoes/planear-escala" element={<LancarEscala />} />
              <Route path="/operacoes/login" element={<Navigate to="/operacoes/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/operacoes/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
