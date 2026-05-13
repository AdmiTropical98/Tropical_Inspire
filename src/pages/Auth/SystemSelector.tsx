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
    <div
      className="relative min-h-screen w-full overflow-hidden lg:flex lg:flex-col"
      style={{
        backgroundImage: 'url(/modulos.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#030b25',
      }}
    >
      <div className="hidden lg:block lg:min-h-screen lg:w-full">
        <div className="relative z-10 flex min-h-screen w-full flex-col px-4 py-4 xl:px-6 xl:py-5">
          <section className="flex h-auto w-full max-w-full items-center justify-between gap-8 py-4 md:py-6">
            <div className="flex items-center gap-6 flex-1">
              <img src="/logo-new.png" alt="ALGARTEMPO" className="h-12 w-auto md:h-14" />
              <div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tighter text-[#0f1a52]">
                  Bem-vindo à
                  <br />
                  Plataforma <span className="text-[#125dff]">ALGARTEMPO</span>
                </h1>
                <p className="mt-1 text-lg md:text-xl text-[#2b4ea5] font-medium">Selecione o módulo para continuar</p>
              </div>
            </div>

            <button
              type="button"
              className="grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-white/80 text-[#2454f5] shadow-lg"
              aria-label="Abrir menu"
            >
              <span className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="h-1.5 w-1.5 rounded-full bg-[#2454f5]" />
                ))}
              </span>
            </button>
          </section>

          <section className="grid w-full flex-1 grid-cols-3 gap-4 py-4">
            {MODULES.map((module) => {
              const Icon = module.icon;

              return (
                <article
                  key={module.key}
                  className="group relative flex h-80 md:h-96 flex-col justify-between rounded-3xl border-2 border-white/20 bg-white/5 p-6 md:p-8 backdrop-blur-sm shadow-xl transition duration-300 hover:border-white/40 hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="grid h-12 w-12 place-items-center rounded-lg text-white shadow-lg"
                        style={{ backgroundColor: module.color }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold text-[#0f1a52]">{module.title}</h2>
                    </div>

                    <div className="h-0.5 w-8 bg-[#9bb3f6] mb-3" />

                    <p className="text-sm md:text-base text-[#1a2555] font-medium leading-relaxed mb-4">{module.description}</p>

                    <ul className="space-y-1.5">
                      {module.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs md:text-sm font-semibold text-[#1a2555]">
                          <span className={`grid h-3 w-3 place-items-center rounded-full text-white flex-shrink-0 ${module.bulletBg}`}>
                            <span className="h-1 w-1 rounded-full bg-white" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(module.route)}
                    className={`mt-4 flex h-12 w-full items-center justify-between rounded-lg px-5 text-sm md:text-base font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 ${module.buttonClass}`}
                  >
                    <span>{module.cta}</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </article>
              );
            })}
          </section>

          <section className="grid w-full grid-cols-3 gap-2 py-4">
            {FOOTER_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className={`flex items-center gap-4 px-4 md:px-6 py-3 ${index !== 2 ? 'border-r border-white/10' : ''}`}
                >
                  <div className="grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 text-white">
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">{item.title}</h3>
                    <p className="text-[11px] md:text-xs leading-tight text-white/75">{item.text}</p>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4 py-6 lg:hidden">
        <img
          src="/modulos.png"
          alt="Layout base dos módulos"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />

        <section className="relative rounded-[24px] border border-white/10 bg-white/88 p-5 shadow-xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <img src="/logo-new.png" alt="ALGARTEMPO" className="h-10 w-auto" />
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#dce5ff] bg-white text-[#2454f5]"
              aria-label="Abrir menu"
            >
              <span className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="h-1 w-1 rounded-full bg-[#2454f5]" />
                ))}
              </span>
            </button>
          </div>

          <h1 className="mt-5 text-[34px] font-black leading-[1.02] tracking-[-0.03em] text-[#0f1a52]">
            Bem-vindo à
            <br />
            Plataforma <span className="text-[#125dff]">ALGARTEMPO</span>
          </h1>
          <p className="mt-2 text-[18px] text-[#2b4ea5]">Selecione o módulo para continuar</p>
        </section>

        <section className="relative mt-4 space-y-4">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <article key={module.key} className="rounded-[24px] border border-white/15 bg-white/88 p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ backgroundColor: module.color }}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h2 className="text-[24px] font-black text-[#101b50]">{module.title}</h2>
                </div>

                <p className="mt-4 text-[15px] leading-[1.45] text-[#1a2555]">{module.description}</p>
                <ul className="mt-4 space-y-2">
                  {module.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[14px] font-semibold text-[#1a2555]">
                      <span className={`grid h-[15px] w-[15px] place-items-center rounded-full text-white ${module.bulletBg}`}>
                        <span className="h-[4px] w-[4px] rounded-full bg-white" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => navigate(module.route)}
                  className={`mt-5 flex h-12 w-full items-center justify-between rounded-2xl px-5 text-[16px] font-bold text-white shadow-[0_8px_22px_rgba(2,6,23,0.18)] ${module.buttonClass}`}
                >
                  <span>{module.cta}</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </article>
            );
          })}
        </section>

        <section className="relative mt-4 space-y-3 rounded-[24px] border border-white/10 bg-[#0a1f56]/86 p-5 shadow-xl backdrop-blur-sm">
          {FOOTER_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#6f90f3] bg-[#0b2d83] text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-white">{item.title}</h3>
                  <p className="mt-1 text-[14px] leading-[1.35] text-[#d7e1ff]">{item.text}</p>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
