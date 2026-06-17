import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bus,
  Boxes,
  Grid3X3,
  HandshakeIcon,
  Network,
  Shield,
  Truck,
  Waypoints,
} from 'lucide-react';

export default function DashboardLanding() {
  const navigate = useNavigate();
  const assetPath = (file: string) => `${import.meta.env.BASE_URL}${file.replace(/^\/+/, '')}`;

  useEffect(() => {
    const root = document.getElementById('root');
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyMargin = document.body.style.margin;
    const prevBodyPadding = document.body.style.padding;
    const prevRootOverflow = root?.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    if (root) root.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.margin = prevBodyMargin;
      document.body.style.padding = prevBodyPadding;
      if (root) root.style.overflow = prevRootOverflow || '';
    };
  }, []);

  const modules = [
    {
      key: 'frota',
      title: 'Frota',
      description: 'Gestão completa de gastos e compras relacionadas à frota da empresa.',
      image: assetPath('frota.png'),
      icon: Truck,
      features: [
        'Gastos com combustível',
        'Compras e manutenção',
        'Seguros e impostos',
        'Pneus e acessórios',
        'Relatórios de custos',
      ],
      buttonText: 'Entrar em Frota',
      buttonClass: 'from-[#0d58ff] to-[#1a6bff] shadow-[0_0_28px_rgba(15,88,255,0.55)]',
      iconClass: 'bg-[#0d58ff] shadow-[0_0_22px_rgba(13,88,255,0.65)]',
      accent: '#1f65ff',
      borderColor: 'rgba(37,99,235,0.75)',
      cardShadow: '0 0 40px rgba(37,99,235,0.38), 0 15px 40px rgba(0,0,0,0.35)',
      imagePosition: 'center 62%',
      route: '/frota/login',
    },
    {
      key: 'inventario',
      title: 'Inventário',
      description: 'Controle e gestão de materiais, equipamentos e ativos da empresa.',
      image: assetPath('inventario.png'),
      icon: Boxes,
      features: [
        'Gestão de stock',
        'Materiais e equipamentos',
        'Movimentos e transferências',
        'Inventários e contagens',
        'Relatórios e análises',
      ],
      buttonText: 'Entrar em Inventário',
      buttonClass: 'from-[#079b6f] to-[#16b86f] shadow-[0_0_28px_rgba(22,184,111,0.48)]',
      iconClass: 'bg-[#079b6f] shadow-[0_0_22px_rgba(22,184,111,0.62)]',
      accent: '#15b76f',
      borderColor: 'rgba(16,185,129,0.75)',
      cardShadow: '0 0 40px rgba(16,185,129,0.38), 0 15px 40px rgba(0,0,0,0.35)',
      imagePosition: 'center 56%',
      route: '/inventario/login',
    },
    {
      key: 'operacoes',
      title: 'Operações',
      description: 'Planeamento, execução e acompanhamento de operações logísticas.',
      image: assetPath('operacao.png'),
      icon: Bus,
      features: [
        'Rotas e percursos',
        'Linhas e serviços',
        'GPS e localização',
        'Colaboradores',
        'Escalas de Transportes',
      ],
      buttonText: 'Entrar em Operações',
      buttonClass: 'from-[#ff8a1a] to-[#ff6200] shadow-[0_0_28px_rgba(255,113,12,0.52)]',
      iconClass: 'bg-[#ff7d16] shadow-[0_0_22px_rgba(255,112,10,0.62)]',
      accent: '#ff7c18',
      borderColor: 'rgba(249,115,22,0.75)',
      cardShadow: '0 0 40px rgba(249,115,22,0.38), 0 15px 40px rgba(0,0,0,0.35)',
      imagePosition: 'center 58%',
      route: '/operacoes/login',
    },
    {
      key: 'fornecedores',
      title: 'Fornecedores',
      description: 'Gestão enterprise de fornecedores e parceiros da empresa.',
      image: assetPath('Fornecedores.png'),
      icon: HandshakeIcon,
      features: [
        'Cadastro e avaliação',
        'Contratos e documentos',
        'Histórico de pagamentos',
        'Requisições e aprovações',
        'Desempenho e indicadores',
      ],
      buttonText: 'Entrar em Fornecedores',
      buttonClass: 'from-[#7c3aed] to-[#a855f7] shadow-[0_0_28px_rgba(124,58,237,0.6)]',
      iconClass: 'bg-[#7c3aed] shadow-[0_0_22px_rgba(124,58,237,0.7)]',
      accent: '#a855f7',
      borderColor: 'rgba(139,92,246,0.75)',
      cardShadow: '0 0 40px rgba(124,58,237,0.4), 0 15px 40px rgba(0,0,0,0.35)',
      imagePosition: 'center 40%',
      route: '/fornecedores-erp/login',
    },
  ];

  return (
    <div
      className="relative h-screen overflow-auto text-[#0e1a4f]"
      style={{
        fontFamily: "'Sora', sans-serif",
        background:
          'linear-gradient(180deg, #04153d 0%, #031130 100%)',
      }}
    >
      {/* DEBUG: Mostrar todos os módulos e o total */}
      <div style={{position:'absolute',top:0,right:0,zIndex:999,color:'#fff',background:'#a855f7',padding:'4px 12px',borderRadius:'0 0 0 8px',fontWeight:700}}>
        {`Módulos: ${modules.length}`}
        <ul style={{margin:0,padding:0,fontSize:'12px',listStyle:'none'}}>
          {modules.map(m => <li key={m.key}>{m.title}</li>)}
        </ul>
      </div>
      {/* === Corporate premium background layers === */}
      {/* Corner glows - very subtle */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full" style={{background:'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', filter:'blur(60px)'}} />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full" style={{background:'radial-gradient(circle, rgba(14,74,200,0.15) 0%, transparent 70%)', filter:'blur(80px)'}} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[900px] rounded-full" style={{background:'radial-gradient(ellipse, rgba(28,65,180,0.09) 0%, transparent 65%)', filter:'blur(80px)'}} />

      {/* Subtle horizontal grid lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:1}} fill="none" xmlns="http://www.w3.org/2000/svg">
        {[...Array(12)].map((_,i)=>(
          <line key={i} x1="0" y1={`${(i+1)*8}%`} x2="100%" y2={`${(i+1)*8}%`} stroke="#ffffff" strokeWidth="0.5" opacity="0.025" />
        ))}
        {[...Array(16)].map((_,i)=>(
          <line key={i} x1={`${(i+1)*6}%`} y1="0" x2={`${(i+1)*6}%`} y2="100%" stroke="#ffffff" strokeWidth="0.5" opacity="0.022" />
        ))}
        {/* Diagonal accent lines */}
        <line x1="0" y1="25%" x2="18%" y2="0" stroke="#3b6eff" strokeWidth="1" opacity="0.07" />
        <line x1="0" y1="60%" x2="22%" y2="100%" stroke="#3b6eff" strokeWidth="1" opacity="0.06" />
        <line x1="100%" y1="15%" x2="80%" y2="0" stroke="#2a5fff" strokeWidth="1" opacity="0.07" />
        <line x1="100%" y1="70%" x2="78%" y2="100%" stroke="#2a5fff" strokeWidth="1" opacity="0.06" />
        {/* Very subtle top horizontal glow line */}
        <line x1="10%" y1="0" x2="90%" y2="0" stroke="#4a7aff" strokeWidth="1.5" opacity="0.12" />
      </svg>

      <div
        className="relative flex h-full flex-col justify-center overflow-hidden"
        style={{
          maxWidth: '1560px',
          width: 'calc(100% - 32px)',
          margin: '0 auto',
          gap: '14px',
        }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 overflow-x-auto md:overflow-x-visible pb-2 scrollbar-thin scrollbar-thumb-[#a855f7] scrollbar-track-[#181c2f]"
          style={{ minHeight: '340px' }}
        >
          {modules.map((module) => (
            <div key={module.key} className="flex flex-col rounded-[22px] border border-[rgba(255,255,255,0.18)] bg-gradient-to-br from-[rgba(36,54,120,0.92)] to-[rgba(18,28,60,0.92)] p-6 shadow-[0_0_32px_rgba(37,99,235,0.10)]" style={{boxShadow:module.cardShadow,borderColor:module.borderColor}}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 ${module.iconClass}`}>
                  <module.icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </div>
                <h3 className="text-[26px] leading-none font-extrabold tracking-[-1px] text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:800, letterSpacing:'-1.2px' }}>{module.title}</h3>
              </div>
              <div className="mb-2.5 h-[2px] w-9 rounded-full" style={{ backgroundColor: module.accent }} />
              <p className="mb-3 max-w-[95%] text-[13px] leading-[1.2] font-medium text-[rgba(255,255,255,0.97)]" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:500 }}>{module.description}</p>
              <div className="space-y-1">
                {module.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: module.accent }} />
                    <span className="text-[12px] leading-tight font-medium text-[rgba(255,255,255,0.92)]" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:500 }}>{feature}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate(module.route)} className={`group mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r ${module.buttonClass} px-4 text-[15px] font-bold leading-none text-white transition-all duration-[350ms] ease-[ease] hover:brightness-110`} style={{ boxShadow: `0 12px 28px rgba(0,0,0,0.35), 0 0 20px ${module.accent}88`, fontFamily: "'Sora', sans-serif", fontWeight:700 }}>
                {module.buttonText}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          ))}
        </div>
              {/* ALGARTEMPO-specific info blocks */}
          <div className="grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#76a1ff]/70" style={{ backdropFilter: 'blur(12px)', background: 'rgba(5,15,45,0.82)', boxShadow: '0 0 34px rgba(62,118,255,0.22), 0 12px 28px rgba(0,0,0,0.22)', minHeight: '72px', height: '72px' }}>
            <div className="flex h-full items-center gap-2.5 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Operação Segura e Organizada</h4>
                <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Gestão centralizada das operações internas da ALGARTEMPO com foco em eficiência, controlo e fiabilidade diária.</p>
              </div>
            </div>
            <div className="flex h-full items-center gap-2.5 border-l border-[#6f98eb]/40 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
                <Network className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Monitorização Operacional</h4>
                <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Acompanhamento em tempo real das rotas, escalas, viaturas e operações da ALGARTEMPO.</p>
              </div>
            </div>
            <div className="flex h-full items-center gap-2.5 border-l border-[#6f98eb]/40 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
                <Boxes className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Sistema Integrado ALGARTEMPO</h4>
                <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Plataforma desenvolvida exclusivamente para otimizar os processos internos da ALGARTEMPO.</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 flex h-full items-center gap-6">
            <div className="shrink-0">
              <img src={assetPath('LOGO.png')} alt="Algartempo" className="h-auto w-[150px]" style={{ filter: 'drop-shadow(0 0 20px rgba(37,99,235,0.45))' }} />
            </div>
            <div className="flex-1">
              <h1 className="text-[clamp(28px,2.1vw,40px)] leading-[0.95] font-extrabold text-[#101c56]" style={{fontFamily: "'Sora', sans-serif", fontWeight:800, letterSpacing:'-1.6px'}}>Bem-vindo à</h1>
              <h2 className="text-[clamp(28px,2.1vw,40px)] leading-[0.95] font-extrabold text-[#101c56]" style={{fontFamily: "'Sora', sans-serif", fontWeight:800, letterSpacing:'-1.6px'}}>
                Plataforma <span className="text-[#1f4dff]">ALGARTEMPO</span>
              </h2>
              <p className="mt-1.5 text-[clamp(14px,1vw,18px)] font-medium leading-[1.1] text-[#274194]" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Selecione o módulo para continuar</p>
            </div>
          </div>
        </div>

        <div
          className="w-full overflow-x-auto"
          style={{
            marginTop: '18px',
            marginBottom: '18px',
          }}
        >
          <div
            className="grid grid-flow-col auto-cols-[minmax(320px,1fr)] gap-[14px] border-4 border-dashed border-red-400"
            style={{
              minWidth: `${modules.length * 340}px`,
              height: 'clamp(330px, calc(100vh - 304px), 440px)',
            }}
          >
            {/* DEBUG: Mostrar todos os módulos e o total */}
            <div style={{position:'absolute',top:0,right:0,zIndex:999,color:'#fff',background:'#a855f7',padding:'4px 12px',borderRadius:'0 0 0 8px',fontWeight:700}}>
              {`Módulos: ${modules.length}`}
            </div>
            {modules.map((module) => (
              <div
                key={module.key}
                className="group relative overflow-hidden rounded-[24px] transition-all duration-[350ms] ease-[ease] hover:-translate-y-[5px]"
                style={{
                  height: '100%',
                  minWidth: '320px',
                  maxWidth: '380px',
                  backdropFilter: 'blur(6px)',
                  border: `2px solid ${module.borderColor}`,
                  boxShadow: module.cardShadow,
                  background: 'rgba(10,20,50,0.35)',
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${module.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                    backgroundRepeat: 'no-repeat',
                    filter: 'brightness(0.82) contrast(1.12) saturate(1.08)',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_35%)] opacity-70" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to right, rgba(4,15,40,0.58) 0%, rgba(4,15,40,0.38) 35%, rgba(4,15,40,0.08) 65%, rgba(4,15,40,0) 100%)',
                  }}
                />
                <div className="relative z-10 flex h-full flex-col p-6">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 ${module.iconClass}`}>
                      <module.icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                    </div>
                    <h3
                      className="text-[26px] leading-none font-extrabold tracking-[-1px] text-white"
                      style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:800, letterSpacing:'-1.2px' }}
                    >
                      {module.title}
                    </h3>
                  </div>
                  <div className="mb-2.5 h-[2px] w-9 rounded-full" style={{ backgroundColor: module.accent }} />
                  <p
                    className="mb-3 max-w-[95%] text-[13px] leading-[1.2] font-medium text-[rgba(255,255,255,0.97)]"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:500 }}
                  >
                    {module.description}
                  </p>
                  <div className="space-y-1">
                    {module.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: module.accent }} />
                        <span
                          className="text-[12px] leading-tight font-medium text-[rgba(255,255,255,0.92)]"
                          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)', fontFamily: "'Sora', sans-serif", fontWeight:500 }}
                        >
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate(module.route)}
                    className={`group mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r ${module.buttonClass} px-4 text-[15px] font-bold leading-none text-white transition-all duration-[350ms] ease-[ease] hover:brightness-110`}
                    style={{ boxShadow: `0 12px 28px rgba(0,0,0,0.35), 0 0 20px ${module.accent}88`, fontFamily: "'Sora', sans-serif", fontWeight:700 }}
                  >
                    {module.buttonText}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
              ))}
            </div>
        {/* ALGARTEMPO-specific info blocks */}
        <div className="grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#76a1ff]/70" style={{ backdropFilter: 'blur(12px)', background: 'rgba(5,15,45,0.82)', boxShadow: '0 0 34px rgba(62,118,255,0.22), 0 12px 28px rgba(0,0,0,0.22)', minHeight: '72px', height: '72px' }}>
          <div className="flex h-full items-center gap-2.5 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Operação Segura e Organizada</h4>
              <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Gestão centralizada das operações internas da ALGARTEMPO com foco em eficiência, controlo e fiabilidade diária.</p>
            </div>
          </div>
          <div className="flex h-full items-center gap-2.5 border-l border-[#6f98eb]/40 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
              <Network className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Monitorização Operacional</h4>
              <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Acompanhamento em tempo real das rotas, escalas, viaturas e operações da ALGARTEMPO.</p>
            </div>
          </div>
          <div className="flex h-full items-center gap-2.5 border-l border-[#6f98eb]/40 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6aa3ff] bg-[#113b92] text-white shadow-[0_0_12px_rgba(81,146,255,0.32)]">
              <Boxes className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-[14px] font-bold leading-none text-white" style={{fontFamily: "'Sora', sans-serif", fontWeight:700}}>Sistema Integrado ALGARTEMPO</h4>
              <p className="mt-0.5 text-[11px] leading-tight text-white/85" style={{fontFamily: "'Sora', sans-serif", fontWeight:500}}>Plataforma desenvolvida exclusivamente para otimizar os processos internos da ALGARTEMPO.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
