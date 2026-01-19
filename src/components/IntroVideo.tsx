import { useState, useEffect, useRef } from 'react';
import {
    ChevronRight,
    Zap,
    Play,
    Volume2
} from 'lucide-react';

const SLIDES = [
    {
        id: 'fleet',
        title: 'FROTA',
        subtitle: 'POTÊNCIA E CONTROLO',
        description: 'A tecnologia Algartempo liga cada veículo ao sucesso da sua empresa.',
        image: '/assets/3d_truck.png',
        color: 'from-blue-500 to-indigo-600',
        accent: 'blue'
    },
    {
        id: 'drivers',
        title: 'EQUIPA',
        subtitle: 'MOTORISTAS DE ELITE',
        description: 'Eficiência e segurança em cada quilómetro percorrido.',
        image: '/assets/3d_driver.png',
        color: 'from-emerald-400 to-teal-600',
        accent: 'emerald'
    },
    {
        id: 'workshop',
        title: 'RIGOR',
        subtitle: 'MANUTENÇÃO AVANÇADA',
        description: 'Diagnóstico em tempo real para uma frota sempre disponível.',
        image: '/assets/3d_tools.png',
        color: 'from-orange-400 to-rose-600',
        accent: 'orange'
    },
    {
        id: 'vision',
        title: 'VISÃO',
        subtitle: 'ESTRATÉGIA DIGITAL',
        description: 'Dados inteligentes para decisões que transformam o negócio.',
        image: '/assets/3d_manager.png',
        color: 'from-purple-500 to-fuchsia-600',
        accent: 'purple'
    }
];

// High-quality cinematic track from Archive.org
const BGM_URL = "https://archive.org/download/ambient-film-music/Infinity.mp3";

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
            let vol = 0;
            const fadeIn = setInterval(() => {
                vol += 0.05;
                if (audioRef.current) audioRef.current.volume = Math.min(vol, 0.5);
                if (vol >= 0.5) clearInterval(fadeIn);
            }, 100);
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
                vol -= 0.1;
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
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [currentSlide, hasIniciado]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center p-8 text-white select-none overflow-hidden font-sans">
                <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

                {/* Visual Ambient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />

                <div className="max-w-3xl text-center space-y-16 relative z-10 animate-in fade-in duration-1000">
                    <div className="space-y-8">
                        <div className="relative inline-block">
                            <div className="absolute -inset-4 bg-white/20 blur-3xl rounded-full animate-pulse" />
                            <div className="relative w-32 h-32 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.3)]">
                                <Volume2 className="w-16 h-16 animate-bounce" />
                            </div>
                        </div>
                        <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-tight italic uppercase drop-shadow-2xl">
                            ALGARTEMPO <br />
                            <span className="text-white/20 not-italic">EXPERIENCE</span>
                        </h1>
                        <p className="text-2xl text-white/40 font-light max-w-lg mx-auto leading-relaxed uppercase tracking-[0.3em]">
                            Uma Nova Dimensão de Gestão
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-8 px-20 py-10 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_30px_100px_rgba(255,255,255,0.2)] border-8 border-transparent hover:border-white/20"
                    >
                        <span className="relative z-10 text-2xl font-black uppercase tracking-widest italic">Começar Agora</span>
                        <Play className="relative z-10 w-8 h-8 fill-current transform group-hover:scale-150 transition-transform" />
                    </button>

                    <div className="text-[10px] font-black uppercase tracking-[1em] text-white/10 mt-12">
                        Premium Cinematic Audio Enabled
                    </div>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-125' : 'opacity-100'
                }`}
        >
            <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

            {/* HIGH-IMPACT AMBIENT BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2000px] h-[2000px] bg-gradient-to-br ${slide.color} opacity-30 blur-[350px] transition-all duration-[2000ms] ${animationStage >= 1 ? 'scale-100 opacity-40' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:120px_120px]" />
            </div>

            <div className="relative z-10 w-full max-w-7xl px-12 flex flex-col items-center justify-center min-h-screen space-y-20">

                <div className="flex flex-col lg:flex-row items-center gap-20 lg:gap-32 w-full">

                    {/* 3D CHARACTER ANIMATION */}
                    <div className={`relative flex-1 transition-all duration-[2000ms] cubic-bezier(0.34, 1.56, 0.64, 1) transform ${animationStage >= 1 ? 'opacity-100 translate-x-0 scale-110' : 'opacity-0 -translate-x-32 scale-50'
                        }`}>
                        <div className="relative">
                            <div className={`absolute -inset-20 bg-gradient-to-br ${slide.color} opacity-40 blur-[120px] rounded-full animate-pulse`} />
                            <img
                                src={slide.image}
                                alt={slide.title}
                                className="relative w-full max-w-2xl mx-auto drop-shadow-[0_80px_100px_rgba(0,0,0,0.8)] animate-float"
                            />
                        </div>
                    </div>

                    {/* CONTENT ARCHITECTURE */}
                    <div className="flex-1 text-center lg:text-left space-y-12">
                        <div className="space-y-4">
                            <h2 className={`text-xl md:text-2xl tracking-[1em] font-black uppercase text-white/30 transition-all duration-1000 delay-200 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                                }`}>
                                {slide.subtitle}
                            </h2>

                            <h1 className={`text-9xl md:text-[14rem] font-black tracking-tighter leading-[0.8] italic transition-all duration-1000 delay-400 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 blur-3xl'
                                }`}>
                                <span className={`bg-gradient-to-br ${slide.color} bg-clip-text text-transparent uppercase drop-shadow-[0_10px_40px_rgba(255,255,255,0.2)]`}>
                                    {slide.title}
                                </span>
                            </h1>

                            <div className={`max-w-xl transition-all duration-1000 delay-600 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                                }`}>
                                <p className="text-3xl md:text-5xl font-light text-white leading-tight tracking-tight mt-12">
                                    {slide.description}
                                </p>
                            </div>
                        </div>

                        {/* NAVIGATION BUTTON */}
                        <div className={`pt-12 transition-all duration-1000 delay-800 ${animationStage >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-20 scale-90'}`}>
                            <button
                                onClick={handleNext}
                                className={`group flex items-center gap-8 py-8 px-16 bg-white text-black rounded-3xl transition-all hover:scale-110 active:scale-95 shadow-[0_30px_80px_rgba(255,255,255,0.1)]`}
                            >
                                <span className="text-2xl font-black uppercase tracking-widest italic">
                                    {currentSlide === SLIDES.length - 1 ? 'Iniciar' : 'Continuar'}
                                </span>
                                <div className={`w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center transition-all group-hover:rotate-12`}>
                                    {currentSlide === SLIDES.length - 1 ? <Zap className="w-6 h-6 fill-current" /> : <ChevronRight className="w-8 h-8" />}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* PROGRESS HUD */}
                <div className="absolute inset-x-0 bottom-12 px-12 flex justify-between items-end">
                    <div className="flex gap-4">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-1000 ${idx === currentSlide ? 'w-48 bg-white' : 'w-8 bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-[12px] font-black uppercase tracking-[1em] text-white/10 italic">Algartempo Ecosystem</div>
                        <button
                            onClick={handleFinish}
                            className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-white transition-colors"
                        >
                            Saltar Intro
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(2deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                .drop-shadow-2xl {
                    filter: drop-shadow(0 25px 25px rgb(0 0 0 / 0.7));
                }
            `}</style>
        </div>
    );
}
