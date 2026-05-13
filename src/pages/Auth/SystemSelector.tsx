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
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#030b25]">
      <div className="hidden lg:block">
        <div className="relative mx-auto w-full max-w-[1366px] aspect-[1366/768]">
          <img
            src="/modulos.png"
            alt="Layout base dos módulos"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 z-10">
            <div className="absolute left-[5.6%] top-[6.8%] flex items-center gap-4">
              <img src="/logo-new.png" alt="ALGARTEMPO" className="h-[58px] w-auto" />
            </div>

            <div className="absolute left-[27.6%] top-[7.3%] text-[#0f1a52]">
              <h1 className="text-[58px] font-black leading-[0.98] tracking-[-0.035em]">
                Bem-vindo à
                <br />
                Plataforma <span className="text-[#125dff]">ALGARTEMPO</span>
              </h1>
              <p className="mt-2 text-[21px] font-medium text-[#2b4ea5]">Selecione o módulo para continuar</p>
            </div>

            <button
              type="button"
              className="absolute right-[4.1%] top-[7.5%] grid h-[42px] w-[42px] place-items-center rounded-xl border border-[#dce5ff] bg-white/88 text-[#2454f5] shadow-[0_8px_16px_rgba(15,23,42,0.10)] transition hover:bg-white"
              aria-label="Abrir menu"
            >
              <span className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="h-[4px] w-[4px] rounded-full bg-[#2454f5]" />
                ))}
              </span>
            </button>

            <div className="absolute left-[3.6%] right-[3.6%] top-[24.8%] grid grid-cols-3 gap-[1.2%]">
              {MODULES.map((module) => {
                const Icon = module.icon;

                return (
                  <article key={module.key} className="group h-[430px] rounded-[26px] px-[6.3%] pt-[5.3%] pb-[5.6%] transition duration-300 hover:scale-[1.012]">
                    <div className="flex h-full flex-col">
                      <div className="flex items-center gap-4">
                        <div
                          className="grid h-[62px] w-[62px] place-items-center rounded-[16px] text-white shadow-[0_10px_24px_rgba(2,6,23,0.20)]"
                          style={{ backgroundColor: module.color }}
                        >
                          <Icon className="h-8 w-8" />
                        </div>
                        <h2 className="text-[24px] font-black tracking-[-0.02em] text-[#101b50]">{module.title}</h2>
                      </div>

                      <div className="mt-4 h-px w-9 bg-[#9bb3f6]" />

                      <p className="mt-3 max-w-[92%] text-[16px] leading-[1.45] text-[#1a2555]">{module.description}</p>

                      <ul className="mt-5 space-y-2.5">
                        {module.items.map((item) => (
                          <li key={item} className="flex items-center gap-3 text-[15px] font-semibold text-[#1a2555]">
                            <span className={`grid h-[16px] w-[16px] place-items-center rounded-full text-white ${module.bulletBg}`}>
                              <span className="h-[4px] w-[4px] rounded-full bg-white" />
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => navigate(module.route)}
                        className={`mt-auto flex h-[48px] w-full items-center justify-between rounded-[14px] px-7 text-[17px] font-bold text-white shadow-[0_8px_22px_rgba(2,6,23,0.18)] transition duration-300 hover:-translate-y-0.5 ${module.buttonClass}`}
                      >
                        <span>{module.cta}</span>
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="absolute bottom-[2.9%] left-[2.6%] right-[2.6%] grid h-[12.6%] grid-cols-3">
              {FOOTER_ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className={`flex items-center gap-5 px-8 ${index !== 2 ? 'border-r border-[#8aa3ed]/60' : ''}`}
                  >
                    <div className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full border border-[#6f90f3] bg-[#0b2d83]/88 text-white shadow-[0_8px_20px_rgba(18,93,255,0.22)]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-white">{item.title}</h3>
                      <p className="mt-1 max-w-[270px] text-[14px] leading-[1.35] text-[#d7e1ff]">{item.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
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
