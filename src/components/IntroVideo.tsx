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
    Play
} from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'ALGARTEMPO',
        subtitle: 'VISIONÁRIA E EFICIENTE',
        description: 'A fundação tecnológica para o sucesso da frota moderna.',
        icon: Rocket,
        color: 'from-blue-600 via-indigo-600 to-violet-600'
    },
    {
        id: 'drivers',
        title: 'EQUIPA',
        subtitle: 'MOTORISTAS DE ELITE',
        description: 'Precisão absoluta no planeamento e gestão de percursos.',
        icon: Users,
        color: 'from-emerald-500 via-teal-600 to-cyan-600'
    },
    {
        id: 'workshop',
        title: 'RIGOR',
        subtitle: 'EXCELÊNCIA TÉCNICA',
        description: 'Controlo total e diagnóstico avançado em tempo real.',
        icon: Wrench,
        color: 'from-orange-500 via-amber-600 to-yellow-600'
    },
    {
        id: 'management',
        title: 'VISÃO',
        subtitle: 'DADOS E ESTRATÉGIA',
        description: 'A inteligência necessária para decisões de topo.',
        icon: LayoutDashboard,
        color: 'from-rose-600 via-purple-600 to-indigo-600'
    }
];

// Direct link from Pixabay CDN (usually very reliable)
const BGM_URL = "https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73512.mp3";

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [hasIniciado, setHasIniciado] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [animationStage, setAnimationStage] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleStart = () => {
        setHasIniciado(true);
        if (audioRef.current) {
            audioRef.current.volume = 0;
            audioRef.current.play().catch(e => console.error("Audio block", e));
            // Progressive Fade In
            let vol = 0;
            const fadeIn = setInterval(() => {
                vol += 0.02;
                if (audioRef.current) {
                    audioRef.current.volume = Math.min(vol, 0.4);
                }
                if (vol >= 0.4) clearInterval(fadeIn);
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
            }, 500);
        }
    };

    const handleFinish = () => {
        setIsExiting(true);
        if (audioRef.current) {
            let vol = audioRef.current.volume;
            const fadeOut = setInterval(() => {
                vol -= 0.05;
                if (audioRef.current) {
                    audioRef.current.volume = Math.max(vol, 0);
                }
                if (vol <= 0) {
                    if (audioRef.current) audioRef.current.pause();
                    clearInterval(fadeOut);
                }
            }, 50);
        }
        setTimeout(onComplete, 1200);
    };

    useEffect(() => {
        if (!hasIniciado) return;
        const t1 = setTimeout(() => setAnimationStage(1), 100);
        const t2 = setTimeout(() => setAnimationStage(2), 500);
        const t3 = setTimeout(() => setAnimationStage(3), 900);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [currentSlide, hasIniciado]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center p-8 text-white select-none overflow-hidden">
                <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

                {/* Minimal Background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />

                <div className="max-w-2xl text-center space-y-16 relative z-10 animate-in fade-in duration-1000">
                    <div className="space-y-6">
                        <div className="w-24 h-24 bg-white text-black rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] mb-12 transform hover:scale-110 transition-transform">
                            <Zap className="w-12 h-12 fill-current" />
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none uppercase">
                            ALGARTEMPO <br />
                            <span className="text-white/20 italic">PREMIUM</span>
                        </h1>
                        <p className="text-xl text-white/40 font-light max-w-sm mx-auto leading-relaxed uppercase tracking-[0.2em]">
                            Explore o futuro da gestão de frota.
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_80px_rgba(255,255,255,0.1)]"
                    >
                        <span className="relative z-10 text-xl font-black uppercase tracking-widest italic">Entrar no Programa</span>
                        <Play className="relative z-10 w-6 h-6 fill-current transform group-hover:scale-125 transition-transform" />
                    </button>

                    <div className="pt-12 flex justify-center gap-10 text-white/10">
                        <Activity className="w-4 h-4 animate-pulse" />
                        <Globe className="w-4 h-4 animate-pulse delay-75" />
                        <Cpu className="w-4 h-4 animate-pulse delay-150" />
                    </div>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-110' : 'opacity-100'
                }`}
        >
            <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

            {/* HIGH-CONTRAST AMBIENT BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1600px] h-[1600px] bg-gradient-to-br ${slide.color} opacity-20 blur-[300px] transition-all duration-[2500ms] ${animationStage >= 1 ? 'scale-100 opacity-30' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] opacity-40" />
            </div>

            <div className="relative z-10 w-full max-w-7xl px-12 text-center flex flex-col items-center justify-center min-h-screen space-y-12">

                {/* Visual Anchor - Pure White Background for Icon */}
                <div className={`transition-all duration-1000 transform ${animationStage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-50 blur-xl'}`}>
                    <div className="p-10 rounded-[3rem] bg-white text-black shadow-[0_0_100px_rgba(255,255,255,0.1)] relative transform hover:rotate-6 transition-transform">
                        <Icon className="w-16 h-16" />
                    </div>
                </div>

                {/* Typography Architecture - PURE WHITE ON BLACK */}
                <div className="space-y-6">
                    <h2 className={`text-sm md:text-base tracking-[1.5em] font-black uppercase text-white/30 transition-all duration-1000 delay-200 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                        }`}>
                        {slide.subtitle}
                    </h2>

                    <h1 className={`text-8xl md:text-[14rem] font-black tracking-custom leading-none transition-all duration-1000 delay-400 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 blur-3xl'
                        }`}>
                        <span className="text-white uppercase italic drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                            {slide.title}
                        </span>
                    </h1>

                    <div className={`max-w-2xl mx-auto transition-all duration-1000 delay-600 ${animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                        }`}>
                        <p className="text-2xl md:text-4xl font-light text-white/70 leading-relaxed tracking-wide">
                            {slide.description}
                        </p>
                    </div>
                </div>

                {/* INTERACTIVE CONTROLS */}
                <div className={`pt-12 transition-all duration-1000 delay-800 ${animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    <button
                        onClick={handleNext}
                        className="group flex flex-col items-center gap-6 pointer-events-auto"
                    >
                        <div className="w-24 h-24 rounded-full border-2 border-white/10 flex items-center justify-center transition-all group-hover:border-white group-hover:bg-white group-hover:text-black shadow-2xl">
                            {currentSlide === SLIDES.length - 1 ? (
                                <Zap className="w-8 h-8 fill-current" />
                            ) : (
                                <ChevronRight className="w-10 h-10 group-hover:translate-x-1 transition-transform" />
                            )}
                        </div>
                        <span className="text-[12px] font-black uppercase tracking-[0.8em] text-white/30 group-hover:text-white transition-colors antialiased shadow-sm">
                            {currentSlide === SLIDES.length - 1 ? 'Iniciar' : 'Próximo'}
                        </span>
                    </button>

                    <div className="mt-12 flex justify-center gap-6">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 rounded-full transition-all duration-700 ${idx === currentSlide ? 'w-24 bg-white shadow-[0_0_20px_white]' : 'w-6 bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* HUD / Branding */}
            <div className="absolute inset-x-0 top-12 px-12 flex justify-between items-start pointer-events-none opacity-20 antialiased">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.5em] text-white">SEC_SYNC_ACTIVE</span>
                </div>
                <div className="text-[10px] font-black tracking-[0.5em] text-white">ALGARTEMPO_SYSTEMS</div>
            </div>

            <style>{`
                .tracking-custom {
                    letter-spacing: -0.05em;
                }
                .antialiased {
                    -webkit-font-smoothing: antialiased;
                }
            `}</style>
        </div>
    );
}
