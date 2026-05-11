import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeftRight,
  Barcode,
  Boxes,
  Building2,
  ChartColumn,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getInventoryDashboardData,
  quickSearchInventory,
  type InventoryDashboardData,
} from '../../services/inventoryService';
import Escritorios from './pages/Escritorios';
import Materiais from './pages/Materiais';
import Equipamentos from './pages/Equipamentos';
import Movimentos from './pages/Movimentos';
import Stock from './pages/Stock';
import QRCodes from './pages/QRCodes';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface InventoryModuleProps {}

interface InventoryNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const INVENTORY_NAV: InventoryNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/inventario/dashboard' },
  { key: 'stock', label: 'Gestão de Stock', icon: Boxes, path: '/inventario/stock' },
  { key: 'materiais', label: 'Materiais', icon: Warehouse, path: '/inventario/materiais' },
  { key: 'equipamentos', label: 'Equipamentos', icon: Archive, path: '/inventario/equipamentos' },
  { key: 'escritorios', label: 'Escritórios', icon: Building2, path: '/inventario/escritorios' },
  { key: 'utilizadores', label: 'Utilizadores', icon: Users, path: '/inventario/utilizadores' },
  { key: 'movimentos', label: 'Movimentos', icon: ArrowLeftRight, path: '/inventario/movimentos' },
  { key: 'entradas-saidas', label: 'Entradas/Saídas', icon: TrendingUp, path: '/inventario/entradas-saidas' },
  { key: 'transferencias', label: 'Transferências', icon: TrendingDown, path: '/inventario/transferencias' },
  { key: 'qrcodes', label: 'QR Codes', icon: Barcode, path: '/inventario/qrcodes' },
  { key: 'relatorios', label: 'Relatórios', icon: ChartColumn, path: '/inventario/relatorios' },
  { key: 'historico', label: 'Histórico', icon: History, path: '/inventario/historico' },
];

function inventoryPathTitle(pathname: string): string {
  const item = INVENTORY_NAV.find((entry) => pathname.startsWith(entry.path));
  return item?.label || 'Inventário';
}

function InventorySection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-900">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{subtitle}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          'Dados dedicados ao Inventário',
          'Sem dependência de tabelas da Frota',
          'Pronto para CRUD completo e workflows',
        ].map((text) => (
          <article key={text} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {text}
          </article>
        ))}
      </div>
    </section>
  );
}

function MovementBadge({ type }: { type: string }) {
  const tones: Record<string, string> = {
    entry: 'bg-emerald-100 text-emerald-700',
    exit: 'bg-rose-100 text-rose-700',
    transfer: 'bg-amber-100 text-amber-700',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${tones[type] || 'bg-slate-100 text-slate-600'}`}>
      {type}
    </span>
  );
}

export default function InventoryModule(_props: InventoryModuleProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ materials: any[]; equipments: any[]; offices: any[] }>({
    materials: [],
    equipments: [],
    offices: [],
  });

  const [dashboard, setDashboard] = useState<InventoryDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingDashboard(true);
      const result = await getInventoryDashboardData();
      if (!cancelled) {
        setDashboard(result);
        setLoadingDashboard(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!search.trim()) {
        setSearchResults({ materials: [], equipments: [], offices: [] });
        return;
      }

      setSearchLoading(true);
      const result = await quickSearchInventory(search);
      if (!cancelled) {
        setSearchResults(result);
        setSearchLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [search]);

  const filteredNav = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return INVENTORY_NAV;
    return INVENTORY_NAV.filter((item) => item.label.toLowerCase().includes(term));
  }, [search]);

  const title = inventoryPathTitle(location.pathname);

  const dashboardCards = [
    {
      key: 'materiais',
      label: 'Materiais',
      value: dashboard?.totals.materials ?? 0,
      hint: 'Itens ativos',
      icon: Boxes,
      tone: 'from-emerald-500 to-teal-500',
    },
    {
      key: 'equipamentos',
      label: 'Equipamentos',
      value: dashboard?.totals.equipments ?? 0,
      hint: 'Ativos registados',
      icon: Archive,
      tone: 'from-cyan-500 to-sky-500',
    },
    {
      key: 'escritorios',
      label: 'Escritórios',
      value: dashboard?.totals.offices ?? 0,
      hint: 'Localizações',
      icon: Building2,
      tone: 'from-amber-500 to-orange-500',
    },
    {
      key: 'baixo-stock',
      label: 'Stock crítico',
      value: dashboard?.totals.lowStock ?? 0,
      hint: 'Abaixo do mínimo',
      icon: ShieldCheck,
      tone: 'from-rose-500 to-red-500',
    },
    {
      key: 'entradas',
      label: 'Entradas (mês)',
      value: dashboard?.totals.monthlyEntries ?? 0,
      hint: 'Movimentos de entrada',
      icon: TrendingUp,
      tone: 'from-emerald-600 to-green-500',
    },
    {
      key: 'saidas',
      label: 'Saídas (mês)',
      value: dashboard?.totals.monthlyExits ?? 0,
      hint: 'Movimentos de saída',
      icon: TrendingDown,
      tone: 'from-violet-500 to-indigo-500',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900" style={{ backgroundImage: 'radial-gradient(800px 280px at 0% 0%, rgba(16,185,129,0.14), transparent), radial-gradient(1000px 320px at 100% 0%, rgba(20,184,166,0.12), transparent)' }}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-[300px] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 p-4 backdrop-blur lg:flex">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Módulo</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Inventário</h1>
            <p className="mt-2 text-xs text-slate-600">Sistema independente da Frota</p>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar menus, materiais, ativos..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>

          <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Sessão</p>
            <p className="mt-1 truncate">{currentUser?.nome || 'Utilizador'}</p>
            <div className="mt-3 flex gap-2">
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
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Gestão de Inventário</p>
                <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2>
              </div>

            </div>

            <div className="mt-3 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {INVENTORY_NAV.map((item) => {
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
            {search.trim() && (
              <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Pesquisa rápida</h3>
                  {searchLoading && <span className="text-xs text-slate-500">A pesquisar...</span>}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Materiais</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{searchResults.materials.length} resultados</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Equipamentos</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{searchResults.equipments.length} resultados</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Escritórios</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{searchResults.offices.length} resultados</p>
                  </article>
                </div>
              </section>
            )}

            <Routes>
              <Route path="/inventario" element={<Navigate to="/inventario/dashboard" replace />} />
              <Route
                path="/inventario/dashboard"
                element={
                  <section className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {dashboardCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <article key={card.key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">{card.label}</p>
                                <p className="mt-2 text-3xl font-black text-slate-900">{loadingDashboard ? '-' : card.value}</p>
                                <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
                              </div>
                              <div className={`rounded-xl bg-gradient-to-br p-2 text-white ${card.tone}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-700">Últimos movimentos</h3>
                        <button
                          type="button"
                          onClick={() => navigate('/inventario/movimentos')}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900"
                        >
                          Ver todos
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                              <th className="pb-3">Tipo</th>
                              <th className="pb-3">Quantidade</th>
                              <th className="pb-3">Notas</th>
                              <th className="pb-3">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(dashboard?.recentMovements || []).map((movement) => (
                              <tr key={movement.id} className="border-t border-slate-100 text-slate-700">
                                <td className="py-3"><MovementBadge type={movement.movement_type} /></td>
                                <td className="py-3 font-semibold">{movement.quantity ?? '-'}</td>
                                <td className="py-3">{movement.notes || '-'}</td>
                                <td className="py-3 text-xs text-slate-500">{new Date(movement.created_at).toLocaleString('pt-PT')}</td>
                              </tr>
                            ))}
                            {!loadingDashboard && (dashboard?.recentMovements || []).length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                                  Sem movimentos registados no módulo de Inventário.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </section>
                }
              />
              <Route path="/inventario/stock" element={<Stock />} />
              <Route path="/inventario/materiais" element={<Materiais />} />
              <Route path="/inventario/equipamentos" element={<Equipamentos />} />
              <Route path="/inventario/escritorios" element={<Escritorios />} />
              <Route path="/inventario/utilizadores" element={<InventorySection title="Utilizadores" subtitle="Atribuição de utilizadores por escritório com permissões específicas do Inventário." />} />
              <Route path="/inventario/movimentos" element={<Movimentos />} />
              <Route path="/inventario/entradas-saidas" element={<Movimentos />} />
              <Route path="/inventario/transferencias" element={<InventorySection title="Transferências" subtitle="Transferências entre escritórios e armazéns com histórico completo e trilha de auditoria." />} />
              <Route path="/inventario/qrcodes" element={<QRCodes />} />
              <Route path="/inventario/relatorios" element={<InventorySection title="Relatórios" subtitle="Relatórios de valorização, rotações, consumos e tendências por período e por escritório." />} />
              <Route path="/inventario/historico" element={<InventorySection title="Histórico Completo" subtitle="Linha temporal consolidada para inspeção, conformidade e auditorias internas/externas." />} />
              <Route path="/inventario/login" element={<Navigate to="/inventario/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/inventario/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
