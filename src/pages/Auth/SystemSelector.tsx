import { ArrowRight, Boxes, LayoutGrid, Lock, Navigation2, ShieldCheck, Tag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SystemCard {
  key: string;
  title: string;
  keywords: string[];
  icon: React.ElementType;
  cta: string;
  route: string;
  tones: {
    panel: string;
    badge: string;
    accent: string;
    glow: string;
    texture: string;
  };
}

const SYSTEMS: SystemCard[] = [
  {
    key: 'frota',
    title: 'Frota',
    keywords: ['Viaturas', 'Servicos', 'Combustivel', 'GPS'],
    icon: Truck,
    cta: 'Entrar em Frota',
    route: '/frota/login',
    tones: {
      panel: 'from-blue-50 to-cyan-50/80 border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      accent: 'text-blue-700',
      glow: 'hover:shadow-[0_16px_34px_rgba(37,99,235,0.20)]',
      texture: 'bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.10),transparent_48%),radial-gradient(circle_at_88%_88%,rgba(14,165,233,0.08),transparent_46%)]',
    },
  },
  {
    key: 'inventario',
    title: 'Inventario',
    keywords: ['Stock', 'Materiais', 'Equipamentos', 'Escritorios'],
    icon: Boxes,
    cta: 'Entrar em Inventario',
    route: '/inventario/login',
    tones: {
      panel: 'from-emerald-50 to-teal-50/80 border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700',
      accent: 'text-emerald-700',
      glow: 'hover:shadow-[0_16px_34px_rgba(5,150,105,0.20)]',
      texture: 'bg-[radial-gradient(circle_at_16%_12%,rgba(16,185,129,0.10),transparent_46%),radial-gradient(circle_at_84%_86%,rgba(45,212,191,0.08),transparent_48%)]',
    },
  },
  {
    key: 'operacoes',
    title: 'Operacoes',
    keywords: ['Rotas', 'Linhas', 'GPS', 'Colaboradores'],
    icon: Navigation2,
    cta: 'Entrar em Operacoes',
    route: '/operacoes/login',
    tones: {
      panel: 'from-amber-50 to-orange-50/80 border-amber-200',
      badge: 'bg-amber-100 text-amber-700',
      accent: 'text-amber-700',
      glow: 'hover:shadow-[0_16px_34px_rgba(217,119,6,0.20)]',
      texture: 'bg-[radial-gradient(circle_at_14%_18%,rgba(251,146,60,0.10),transparent_46%),radial-gradient(circle_at_84%_86%,rgba(251,191,36,0.10),transparent_48%)]',
    },
  },
];

const KPI_ITEMS = [
  { label: 'Sistemas', value: '3', hint: 'Ambientes independentes', icon: LayoutGrid, dot: 'bg-blue-400' },
  { label: 'Seguranca', value: 'RBAC', hint: 'Permissoes por modulo', icon: Lock, dot: 'bg-emerald-400' },
  { label: 'Versao', value: 'v2.0', hint: 'Arquitetura modular', icon: Tag, dot: 'bg-amber-400' },
];

export default function SystemSelector() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto"
      style={{ backgroundImage: "url('/fundo_páginas.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(1300px_500px_at_8%_-8%,rgba(59,130,246,0.24),transparent),radial-gradient(1300px_520px_at_92%_-6%,rgba(16,185,129,0.20),transparent),linear-gradient(180deg,rgba(255,255,255,0.40),rgba(255,255,255,0.54))]" />
      <div className="absolute inset-x-[-10%] bottom-[-2%] h-[28vh] opacity-70" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(219,234,254,0.12) 35%, rgba(191,219,254,0.22) 100%)', clipPath: 'ellipse(72% 58% at 50% 100%)' }} />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1460px] flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <section className="w-full">

          {/* ── HERO HEADER ─────────────────────────────────────────── */}
          <div className="mb-7 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-lg backdrop-blur-[2px]">
            {/* top accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500" />

            <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-3 px-7 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-6">
              {/* LEFT — logo + name */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex h-24 w-40 shrink-0 items-center justify-center sm:h-28 sm:w-44">
                  <img
                    src="/LOGO.png"
                    alt="Algartempo"
                    className="h-full w-full object-contain scale-[1.18]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Algartempo Platform</p>
                  <h1 className="mt-0.5 text-3xl font-black tracking-[-0.03em] text-slate-900 sm:text-4xl">
                    Enterprise Modular<br className="hidden sm:block" /> Workspace
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">Selecione o módulo para continuar</p>
                </div>
              </div>

              {/* RIGHT — badges */}
              <div className="flex shrink-0 flex-col items-center gap-1.5 sm:items-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[12px] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Plataforma Modular
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">v2.0</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm">● Online</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-600 shadow-sm">Produção</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {KPI_ITEMS.map((item) => {
              const KpiIcon = item.icon;
              return (
              <article key={item.label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <KpiIcon className="h-4 w-4 text-slate-400" />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-2xl font-black leading-none text-slate-900">{item.value}</p>
                  <span className={`mb-0.5 h-2.5 w-2.5 rounded-full ${item.dot} ring-2 ring-white shadow-sm`} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p>
              </article>
            );
            })}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {SYSTEMS.map((system) => {
              const Icon = system.icon;
              return (
                <article
                  key={system.key}
                  className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br ${system.tones.panel} ${system.tones.texture} p-8 shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.012] hover:border-opacity-80 hover:shadow-xl ${system.tones.glow}`}
                  style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease' }}
                >
                  <div className={`inline-flex h-18 w-18 items-center justify-center rounded-2xl ${system.tones.badge} ring-2 ring-white/80 shadow-md transition-all duration-200 group-hover:scale-[1.08] group-hover:shadow-lg`}>
                    <Icon className="h-9 w-9" />
                  </div>
                  <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">{system.title}</h2>
                  <ul className="mt-3 grid gap-1.5 text-[15px] font-semibold text-slate-600">
                    {system.keywords.map((item) => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${system.tones.badge}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => navigate(system.route)}
                    className={`mt-7 inline-flex items-center gap-2 text-base font-black transition-all duration-200 ${system.tones.accent} group-hover:gap-2.5`}
                  >
                    {system.cta}
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
