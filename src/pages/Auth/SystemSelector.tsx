import { ArrowRight, BarChart3, Boxes, Bus, Puzzle, ShieldCheck, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModuleCard {
  key: string;
  title: string;
  description: string;
  items: string[];
  icon: React.ElementType;
  route: string;
  cta: string;
  color: string;
  bulletBg: string;
  buttonClass: string;
  image: string;
  overlay: string;
}

const MODULES: ModuleCard[] = [
  {
    key: 'frota',
    title: 'Frota',
    description: 'Gestão completa de gastos e compras relacionados à frota da empresa.',
    items: [
      'Gastos com combustível',
      'Compras e manutenção',
      'Seguros e impostos',
      'Pneus e acessórios',
      'Relatórios de custos',
    ],
    icon: Truck,
    route: '/frota/login',
    cta: 'Entrar em Frota',
    color: '#125dff',
    bulletBg: 'bg-[#125dff]',
    buttonClass: 'bg-gradient-to-r from-[#125dff] to-[#0f4fe0] hover:shadow-[0_12px_30px_rgba(18,93,255,0.42)]',
    image: '/fleet-bg.png',
    overlay: 'linear-gradient(180deg, rgba(4,12,34,0.16) 0%, rgba(4,12,34,0.46) 100%)',
  },
  {
    key: 'inventario',
    title: 'Inventário',
    description: 'Controle e gestão de materiais, equipamentos e ativos da empresa.',
    items: [
      'Gestão de stock',
      'Materiais e equipamentos',
      'Movimentos e transferências',
      'Inventários e contagens',
      'Relatórios e análises',
    ],
    icon: Boxes,
    route: '/inventario/login',
    cta: 'Entrar em Inventário',
    color: '#0f9f6e',
    bulletBg: 'bg-[#0f9f6e]',
    buttonClass: 'bg-gradient-to-r from-[#0f9f6e] to-[#0c845c] hover:shadow-[0_12px_30px_rgba(15,159,110,0.42)]',
    image: '/Login%20invent%C3%A1rios.png',
    overlay: 'linear-gradient(180deg, rgba(3,24,18,0.14) 0%, rgba(3,24,18,0.42) 100%)',
  },
  {
    key: 'operacoes',
    title: 'Operações',
    description: 'Planeamento, execução e acompanhamento de operações logísticas.',
    items: [
      'Rotas e percursos',
      'Linhas e serviços',
      'GPS e localização',
      'Colaboradores',
      'Escalas de Transportes',
    ],
    icon: Bus,
    route: '/operacoes/login',
    cta: 'Entrar em Operações',
    color: '#ff7a00',
    bulletBg: 'bg-[#ff7a00]',
    buttonClass: 'bg-gradient-to-r from-[#ff7a00] to-[#ff5f00] hover:shadow-[0_12px_30px_rgba(255,122,0,0.42)]',
    image: '/Login%20operacoes.png',
    overlay: 'linear-gradient(180deg, rgba(36,16,0,0.10) 0%, rgba(36,16,0,0.46) 100%)',
  },
];

const FOOTER_ITEMS = [
  {
    title: 'Segurança e Confiabilidade',
    text: 'Os seus dados protegidos com os mais altos padrões de segurança.',
    icon: ShieldCheck,
  },
  {
    title: 'Informação em Tempo Real',
    text: 'Acesso a dados atualizados para melhores decisões.',
    icon: BarChart3,
  },
  {
    title: 'Módulos Integrados',
    text: 'Soluções integradas que se adaptam às necessidades da sua empresa.',
    icon: Puzzle,
  },
];

export default function SystemSelector() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#0a0f2e] lg:flex lg:flex-col">
      <div className="hidden lg:block lg:min-h-screen lg:w-full">
        <div className="flex min-h-screen w-full flex-col px-6 py-8">
          {/* HEADER CARD */}
          <section className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <img src="/logo-new.png" alt="ALGARTEMPO" className="h-12 w-auto" />
                <div>
                  <h1 className="text-3xl font-black text-[#0f1a52]">
                    Bem-vindo à<br />
                    Plataforma <span className="text-[#125dff]">ALGARTEMPO</span>
                  </h1>
                  <p className="mt-1 text-base text-[#2b4ea5] font-medium">Selecione o módulo para continuar</p>
                </div>
              </div>
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-xl bg-[#2454f5] text-white shadow-lg hover:bg-[#1a3fb8]"
                aria-label="Abrir menu"
              >
                <span className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <span key={idx} className="h-1 w-1 rounded-full bg-white" />
                  ))}
                </span>
              </button>
            </div>
          </section>

          {/* CARDS GRID */}
          <section className="mb-8 grid grid-cols-3 gap-6 flex-1">
            {MODULES.map((module) => {
              const Icon = module.icon;

              return (
                <article
                  key={module.key}
                  className="group relative flex h-96 flex-col justify-between overflow-hidden rounded-2xl shadow-xl transition duration-300 hover:shadow-2xl"
                  style={{
                    backgroundImage: `url(${module.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* DARK OVERLAY */}
                  <div
                    className="absolute inset-0 z-0"
                    style={{
                      background: module.overlay,
                    }}
                  />

                  {/* CONTENT */}
                  <div className="relative z-10 flex flex-col justify-between h-full p-6">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="grid h-12 w-12 place-items-center rounded-lg text-white"
                          style={{ backgroundColor: module.color }}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{module.title}</h2>
                      </div>

                      <div className="h-0.5 w-8 bg-white/40 mb-4" />

                      <p className="text-sm text-white/90 font-medium leading-relaxed mb-4">{module.description}</p>

                      <ul className="space-y-2">
                        {module.items.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-xs text-white/80 font-semibold">
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: module.color }}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(module.route)}
                      className={`mt-6 flex h-11 items-center justify-between rounded-lg px-4 text-sm font-bold text-white shadow-lg transition duration-300 hover:-translate-y-1 ${module.buttonClass}`}
                    >
                      <span>{module.cta}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {/* FOOTER ROW */}
          <section className="flex gap-8 border-t border-white/10 pt-8">
            {FOOTER_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="flex flex-1 items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-white/70 leading-relaxed">{item.text}</p>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </div>

      <main className="flex min-h-screen w-full flex-col bg-[#0a0f2e] px-4 py-6 lg:hidden">
        {/* HEADER CARD */}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4 mb-4">
            <img src="/logo-new.png" alt="ALGARTEMPO" className="h-10 w-auto" />
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#2454f5] text-white shadow-lg"
              aria-label="Abrir menu"
            >
              <span className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="h-1 w-1 rounded-full bg-white" />
                ))}
              </span>
            </button>
          </div>

          <h1 className="text-3xl font-black text-[#0f1a52]">
            Bem-vindo à<br />
            Plataforma <span className="text-[#125dff]">ALGARTEMPO</span>
          </h1>
          <p className="mt-2 text-base text-[#2b4ea5]">Selecione o módulo para continuar</p>
        </section>

        {/* MOBILE CARDS */}
        <section className="mb-6 space-y-4">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <article
                key={module.key}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl shadow-lg transition duration-300 hover:shadow-xl"
                style={{
                  height: '280px',
                  backgroundImage: `url(${module.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* DARK OVERLAY */}
                <div
                  className="absolute inset-0 z-0"
                  style={{
                    background: module.overlay,
                  }}
                />

                {/* CONTENT */}
                <div className="relative z-10 flex flex-col justify-between h-full p-4">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="grid h-10 w-10 place-items-center rounded-lg text-white"
                        style={{ backgroundColor: module.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-bold text-white">{module.title}</h2>
                    </div>

                    <p className="text-xs text-white/90 leading-tight">{module.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(module.route)}
                    className={`flex h-10 items-center justify-between rounded-lg px-3 text-xs font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 ${module.buttonClass}`}
                  >
                    <span>{module.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {/* FOOTER */}
        <section className="space-y-3 rounded-2xl bg-white/10 p-4 border border-white/20">
          {FOOTER_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-white/70 leading-tight">{item.text}</p>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
