import { useState, useEffect, useRef } from 'react';
import {
    Cpu,
    Globe,
    ShieldCheck,
    Activity,
    Rocket,
    Users,
    Wrench,
    LayoutDashboard,
    ChevronRight,
    Zap,
    BarChart3,
    Clock,
    MousePointer2
} from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'ALGARTEMPO',
        subtitle: 'A NOVA ERA DA MOBILIDADE',
        description: 'Uma infraestrutura digital completa para a gestão inteligente da frota.',
        icon: Rocket,
        color: 'from-blue-600 via-indigo-600 to-violet-600',
        features: ['Real-time Tracking', 'Cloud Integration', 'Adaptive UI']
    },
    {
        id: 'drivers',
        title: 'EFICIÊNCIA',
        subtitle: 'LOGÍSTICA DE ALTA PERFORMANCE',
        description: 'Ferramentas de precisão para motoristas e planeamento de escalas.',
        icon: Users,
        color: 'from-emerald-500 via-teal-600 to-cyan-600',
        features: ['Smart Scheduling', 'Safety Protocols', 'Direct Comms']
    },
    {
        id: 'workshop',
        title: 'CONTROLO',
        subtitle: 'RIGOR TÉCNICO ABSOLUTO',
        description: 'Diagnóstico avançado e gestão de manutenção preventiva.',
        icon: Wrench,
        color: 'from-orange-500 via-amber-600 to-yellow-600',
        features: ['Maintenance AI', 'Resource Tracking', 'Digital Records']
    },
    {
        id: 'management',
        title: 'VISÃO',
        subtitle: 'ESTRATÉGIA EM TEMPO REAL',
        description: 'Painéis analíticos para decisões que movem a empresa.',
        icon: LayoutDashboard,
        color: 'from-rose-600 via-purple-600 to-indigo-600',
        features: ['BI Analytics', 'Cost Management', 'Global Metrics']
    }
];

const BGM_URL = "https://www.chosic.com/wp-content/uploads/2021/04/Ambient-Atmospheric-Cinematic-Background-Music-For-Videos-No-Copyright.mp3";

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [hasIniciado, setHasIniciado] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [animationStage, setAnimationStage] = useState(0);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const x = (clientX / window.innerWidth - 0.5) * 50;
        const y = (clientY / window.innerHeight - 0.5) * 50;
        setMousePos({ x, y });
    };

    const handleStart = () => {
        setHasIniciado(true);
        if (audioRef.current) {
            audioRef.current.volume = 0;
            audioRef.current.play().catch(e => console.error("Audio blocked", e));
            let vol = 0;
            const fadeIn = setInterval(() => {
                vol += 0.01;
                if (audioRef.current) audioRef.current.volume = Math.min(vol, 0.3);
                if (vol >= 0.3) clearInterval(fadeIn);
            }, 50);
        }
    };

    const handleNext = () => {
        if (currentSlide === SLIDES.length - 1) {
            handleFinish();
        } else {
            setAnimationStage(0);
            setTimeout(() => {
                setCurrentSlide(prev => prev + 1);
            }, 600);
        }
    };

    const handleFinish = () => {
        setIsExiting(true);
        if (audioRef.current) {
            let vol = audioRef.current.volume;
            const fadeOut = setInterval(() => {
                vol -= 0.02;
                if (audioRef.current) audioRef.current.volume = Math.max(vol, 0);
                if (vol <= 0) {
                    if (audioRef.current) audioRef.current.pause();
                    clearInterval(fadeOut);
                }
            }, 50);
        }
        setTimeout(onComplete, 1000);
    };

    useEffect(() => {
        if (!hasIniciado) return;
        const t1 = setTimeout(() => setAnimationStage(1), 100);
        const t2 = setTimeout(() => setAnimationStage(2), 400);
        const t3 = setTimeout(() => setAnimationStage(3), 700);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [currentSlide, hasIniciado]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-[#020205] flex items-center justify-center p-8 text-white font-sans overflow-hidden">
                <audio ref={audioRef} src={BGM_URL} loop />

                {/* Visual Ambient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(60,60,100,0.1)_0%,transparent_70%)] opacity-50" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:120px_120px]" />

                <div className="max-w-2xl text-center space-y-16 relative z-10">
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.4em] font-black text-white/40 mb-4">
                            Sistem_Framework v1.9
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] italic">
                            ALGARTEMPO <br />
                            <span className="text-white/20 not-italic">VISIONARY EXPERIENCE</span>
                        </h1>
                        <p className="text-xl text-white/40 font-light max-w-lg mx-auto leading-relaxed">
                            Explore a nova interface interativa. <br />Ative o som para uma imersão completa.
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-8 px-16 py-8 bg-white text-black rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_30px_60px_rgba(255,255,255,0.1)]"
                    >
                        <span className="relative z-10 text-xl font-black uppercase tracking-widest">Descobrir Algartempo</span>
                        <ChevronRight className="relative z-10 w-6 h-6 transform group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <div className="flex justify-center gap-12 text-white/10">
                        <Cpu className="w-5 h-5 animate-pulse" />
                        <Globe className="w-5 h-5 animate-pulse delay-75" />
                        <Activity className="w-5 h-5 animate-pulse delay-150" />
                    </div>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            onMouseMove={handleMouseMove}
            className={`fixed inset-0 z-[999999] bg-[#020205] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-105 blur-3xl' : 'opacity-100'
                }`}
        >
            <audio ref={audioRef} src={BGM_URL} loop />

            {/* HIGH-END AMBIENT BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1800px] h-[1800px] bg-gradient-to-br ${slide.color} opacity-20 blur-[300px] transition-all duration-[2000ms] ease-expo ${animationStage >= 1 ? 'scale-100 opacity-30' : 'scale-50 opacity-0'}`}
                    style={{ transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))` }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:80px_80px]" />
                <div className="absolute inset-0 bg-black/60" />
            </div>

            {/* INTERACTIVE CARDS STACK */}
            <div className="relative z-10 w-full max-w-7xl px-12 flex flex-col items-center justify-center min-h-[85vh]">

                {/* Floating Navigation / Logo */}
                <div className={`absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-4 transition-all duration-1000 ${animationStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
                    <div className="w-10 h-[10px] bg-white/20 rounded-full" />
                    <span className="text-[10px] font-black tracking-[1em] text-white italic uppercase">Algartempo Ecosystem</span>
                    <div className="w-10 h-[10px] bg-white/20 rounded-full" />
                </div>

                {/* Main Content Card */}
                <div
                    className={`relative w-full max-w-5xl transition-all duration-1000 ease-expo transform ${animationStage >= 2 ? 'opacity-100 translate-y-0 rotate-0' : 'opacity-0 translate-y-20 rotate-1 blur-3xl'
                        }`}
                    style={{ transform: `perspective(2000px) rotateX(${mousePos.y * -0.05}deg) rotateY(${mousePos.x * 0.05}deg)` }}
                >
                    <div className="relative p-20 rounded-[4rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_80px_160px_-40px_rgba(0,0,0,0.8)] overflow-hidden">

                        {/* Interactive Accent */}
                        <div className={`absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br ${slide.color} opacity-20 blur-[100px] rounded-full animate-pulse`} />

                        <div className="flex flex-col md:flex-row gap-20 items-center">

                            {/* Visual Anchor */}
                            <div className="relative group">
                                <div className={`absolute -inset-8 bg-gradient-to-r ${slide.color} blur-3xl opacity-30 group-hover:opacity-60 transition-opacity`} />
                                <div className="relative w-48 h-48 bg-white text-black rounded-[3rem] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                                    <Icon className="w-20 h-20" />
                                </div>
                            </div>

                            {/* Text Info */}
                            <div className="flex-1 text-center md:text-left space-y-8">
                                <div className="space-y-2">
                                    <h2 className="text-emerald-400 text-sm font-black tracking-[0.6em] uppercase flex items-center gap-3">
                                        <Zap className="w-4 h-4 fill-current" /> High Performance
                                    </h2>
                                    <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none italic uppercase">
                                        {slide.title}
                                    </h1>
                                    <p className="text-2xl md:text-4xl font-light text-white/50 tracking-tight leading-tight">
                                        {slide.subtitle}
                                    </p>
                                </div>

                                <p className="text-xl md:text-2xl font-light text-white/80 leading-relaxed max-w-xl">
                                    {slide.description}
                                </p>

                                {/* dynamic feature tags */}
                                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                    {slide.features.map((f, i) => (
                                        <div key={i} className="px-5 py-2 rounded-full bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/60">
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* INTERACTIVE CONTROLS */}
                <div className={`mt-16 flex flex-col items-center gap-10 transition-all duration-1000 delay-500 ${animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

                    <button
                        onClick={handleNext}
                        className="group flex flex-col items-center gap-6 pointer-events-auto"
                    >
                        <div className="relative w-24 h-24 rounded-full border border-white/20 flex items-center justify-center transition-all group-hover:border-white group-hover:scale-110">
                            {currentSlide === SLIDES.length - 1 ? (
                                <Zap className="w-8 h-8 text-white fill-white animate-pulse" />
                            ) : (
                                <ChevronRight className="w-8 h-8 text-white group-hover:translate-x-1 transition-transform" />
                            )}
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 rounded-full" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.8em] text-white/40 group-hover:text-white transition-colors antialiased">
                            {currentSlide === SLIDES.length - 1 ? 'Iniciar Programa' : 'Próximo Capítulo'}
                        </span>
                    </button>

                    <div className="flex gap-4">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-700 ${idx === currentSlide ? 'w-16 bg-white shadow-[0_0_10px_white]' : 'w-4 bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* PERIPHERAL TECH HUD */}
            <div className="absolute inset-0 pointer-events-none p-12 flex flex-col justify-between select-none">
                <div className="flex justify-between items-start opacity-20">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-[9px] font-black tracking-widest text-white uppercase">
                            <Activity className="w-3 h-3" /> NET_TRAFFIC: OPTIMAL
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-black tracking-widest text-white uppercase">
                            <Clock className="w-3 h-3" /> UPTIME: 99.98%
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="flex items-center gap-3 justify-end text-[9px] font-black tracking-widest text-white uppercase">
                            BI_DASHBOARD <BarChart3 className="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-3 justify-end text-[9px] font-black tracking-widest text-white uppercase">
                            ACTIVE_PROTOCOLS <ShieldCheck className="w-3 h-3" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-end pointer-events-auto">
                    <div className="flex items-center gap-4 text-[10px] font-black tracking-[0.4em] text-white/20 uppercase italic">
                        <MousePointer2 className="w-4 h-4" /> Move mouse to explore
                    </div>
                    <button
                        onClick={handleFinish}
                        className="px-10 py-4 bg-white/5 hover:bg-white text-white/30 hover:text-black border border-white/10 rounded-2xl text-[10px] font-black tracking-[0.5em] transition-all uppercase hover:scale-105 active:scale-95 shadow-xl"
                    >
                        Saltar Tudo
                    </button>
                </div>
            </div>

            <style>{`
                .ease-expo {
                    transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
                }
            `}</style>
        </div>
    );
}
