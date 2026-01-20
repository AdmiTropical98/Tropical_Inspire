import { useState, useEffect, useRef } from 'react';
import {
    ChevronRight,
    Zap,
    Play,
    Volume2
} from 'lucide-react';

const SLIDES = [
    {
        id: 'renault',
        title: 'FROTA',
        subtitle: 'POTÊNCIA E CONFORTO',
        description: 'Viaturas de topo para viagens inesquecíveis.',
        image: '/assets/3d_renault.png',
        color: 'from-blue-500 to-indigo-600',
        accent: 'blue',
        animationClass: 'animate-drive-in-right'
    },
    {
        id: 'van',
        title: 'AGILIDADE',
        subtitle: 'FLEXIBILIDADE TOTAL',
        description: 'Rapidez e eficiência em cada serviço realizado.',
        image: '/assets/3d_agility.png',
        color: 'from-sky-400 to-cyan-600',
        accent: 'cyan',
        animationClass: 'animate-float-intense'
    },
    {
        id: 'driver',
        title: 'EQUIPA',
        subtitle: 'MOTORISTAS DE ELITE',
        description: 'Profissionais dedicados para uma experiência segura.',
        image: '/assets/3d_driver.png',
        color: 'from-emerald-400 to-teal-600',
        accent: 'emerald',
        animationClass: 'animate-float-intense'
    },
    {
        id: 'vision',
        title: 'VISÃO',
        subtitle: 'ESTRATÉGIA DIGITAL',
        description: 'Dados inteligentes para decisões que transformam o negócio.',
        image: '/assets/3d_manager.png',
        color: 'from-purple-500 to-fuchsia-600',
        accent: 'purple',
        animationClass: 'animate-float-intense'
    }
];

// Ultra-reliable Cinematic Track
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
                if (audioRef.current) audioRef.current.volume = Math.min(vol, 0.6);
                if (vol >= 0.6) clearInterval(fadeIn);
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
                vol -= 0.1;
                if (audioRef.current) audioRef.current.volume = Math.max(vol, 0);
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
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [currentSlide, hasIniciado]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center p-8 text-white select-none overflow-hidden font-sans">
                <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

                {/* Background Atmosphere */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />

                <div className="max-w-4xl text-center space-y-16 relative z-10 animate-in fade-in duration-1500 scale-in-95">
                    <div className="space-y-8">
                        <div className="relative inline-block mb-8">
                            <div className="absolute -inset-8 bg-blue-500/20 blur-[50px] rounded-full animate-pulse" />
                            <div className="relative w-24 h-24 bg-white text-black rounded-[2rem] flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.3)] transform hover:rotate-12 transition-transform cursor-pointer" onClick={handleStart}>
                                <Volume2 className="w-12 h-12 animate-bounce text-blue-600" />
                            </div>
                        </div>

                        {/* SCALED DOWN TITLE - FIXED AS REQUESTED */}
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none italic uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                            ALGAR TEMPO <br />
                            <span className="text-white/30 not-italic tracking-[0.2em] text-2xl md:text-4xl block mt-4 font-bold">EXPERIENCE</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-white/50 font-light max-w-xl mx-auto leading-relaxed uppercase tracking-[0.3em]">
                            A Revolução Digital nos Transportes
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_30px_80px_rgba(255,255,255,0.2)] border-[8px] border-transparent hover:border-white/20"
                    >
                        <span className="relative z-10 text-xl font-black uppercase tracking-widest italic">Iniciar Programa</span>
                        <Play className="relative z-10 w-8 h-8 fill-current transform group-hover:scale-150 group-hover:rotate-12 transition-transform" />
                    </button>

                    <div className="text-[10px] font-black uppercase tracking-[1.2em] text-white/10 mt-12 animate-pulse">
                        SISTEMA PRONTO
                    </div>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-150 blur-3xl' : 'opacity-100'
                }`}
        >
            <audio ref={audioRef} src={BGM_URL} loop preload="auto" />

            {/* VOLUMETRIC BACKGROUND ENGINE */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2200px] h-[2200px] bg-gradient-to-br ${slide.color} opacity-20 blur-[300px] transition-all duration-[2000ms] ${animationStage >= 1 ? 'scale-110 opacity-30' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-black/80" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:150px_150px]" />
            </div>

            <div className="relative z-10 w-full max-w-[1800px] px-12 md:px-24 flex flex-col items-center justify-center min-h-screen">

                <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-12 lg:gap-32">

                    {/* 3D VEHICLE ENGINE - DYNAMIC MOVEMENT & SCREEN BLENDING */}
                    <div className={`relative flex-1 w-full flex justify-center lg:justify-end transition-all duration-[1000ms]`}>
                        <div className="relative group w-full max-w-[800px]">
                            {/* Glow Effect */}
                            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-to-br ${slide.color} opacity-30 blur-[100px] rounded-full transition-all duration-1000 ${animationStage >= 1 ? 'scale-100' : 'scale-0'}`} />

                            {/* Screen Blend Mode for Perfect Transparency + Dynamic Keyframe Animation */}
                            <img
                                key={slide.id} // Force re-render for animation reset
                                src={slide.image}
                                alt={slide.title}
                                className={`relative w-full object-contain mix-blend-screen brightness-125 contrast-110 drop-shadow-[0_50px_100px_rgba(0,0,0,1)] ${animationStage >= 1 ? slide.animationClass : 'opacity-0 translate-y-20'
                                    }`}
                                style={{ maxHeight: '60vh' }}
                            />
                        </div>
                    </div>

                    {/* TYPOGRAPHY ARCHITECTURE */}
                    <div className="flex-1 text-center lg:text-left space-y-10 lg:pl-12">
                        <div className="space-y-4">
                            <h2 className={`text-xl md:text-2xl tracking-[1em] font-black uppercase text-white/30 transition-all duration-1000 delay-200 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                                }`}>
                                {slide.subtitle}
                            </h2>

                            <h1 className={`text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.8] italic transition-all duration-1000 delay-300 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 blur-2xl'
                                }`}>
                                <span className={`bg-gradient-to-br ${slide.color} bg-clip-text text-transparent uppercase drop-shadow-[0_10px_40px_rgba(255,255,255,0.2)]`}>
                                    {slide.title}
                                </span>
                            </h1>

                            <div className={`max-w-xl transition-all duration-1000 delay-500 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                                }`}>
                                <p className="text-2xl md:text-4xl font-light text-white leading-tight tracking-tight mt-8 antialiased">
                                    {slide.description}
                                </p>
                            </div>
                        </div>

                        {/* ELITE NAVIGATION */}
                        <div className={`pt-12 transition-all duration-1000 delay-700 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <button
                                onClick={handleNext}
                                className="group relative flex items-center gap-8 py-6 px-16 bg-white text-black rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_20px_60px_rgba(255,255,255,0.15)] border-[6px] border-transparent hover:border-black/5"
                            >
                                <span className="text-xl font-black uppercase tracking-widest italic">
                                    {currentSlide === SLIDES.length - 1 ? 'Aceder à Plataforma' : 'Continuar'}
                                </span>
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center transition-all group-hover:rotate-[-10deg] group-hover:scale-110 shadow-lg">
                                    {currentSlide === SLIDES.length - 1 ? <Zap className="w-6 h-6 fill-current text-yellow-400" /> : <ChevronRight className="w-8 h-8" />}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* PROGRESS METRICS */}
                <div className="absolute inset-x-0 bottom-8 px-12 flex justify-between items-end">
                    <div className="flex gap-4">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-1000 cubic-bezier(0.23, 1, 0.32, 1) ${idx === currentSlide ? 'w-[150px] bg-white shadow-[0_0_20px_white]' : 'w-8 bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <div className="text-[10px] font-black uppercase tracking-[1em] text-white/20 italic">ALGAR TEMPO ECOSYSTEM</div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes drive-in-right {
                    0% { transform: translateX(100%) scale(0.8) skewX(-10deg); opacity: 0; }
                    60% { transform: translateX(-5%) scale(1.02) skewX(2deg); opacity: 1; }
                    100% { transform: translateX(0) scale(1) skewX(0deg); opacity: 1; }
                }
                @keyframes drive-in-left {
                    0% { transform: translateX(-100%) scale(0.8) skewX(10deg); opacity: 0; }
                    60% { transform: translateX(5%) scale(1.02) skewX(-2deg); opacity: 1; }
                    100% { transform: translateX(0) scale(1) skewX(0deg); opacity: 1; }
                }
                @keyframes float-intense {
                    0% { transform: translateY(0px) rotate(0deg) scale(1); }
                    33% { transform: translateY(-20px) rotate(2deg) scale(1.02); }
                    66% { transform: translateY(10px) rotate(-1deg) scale(0.98); }
                    100% { transform: translateY(0px) rotate(0deg) scale(1); }
                }
                .animate-drive-in-right {
                    animation: drive-in-right 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .animate-drive-in-left {
                    animation: drive-in-left 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .animate-float-intense {
                    animation: float-intense 6s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
                }
                .text-transparent {
                    -webkit-background-clip: text;
                    background-clip: text;
                }
                .mix-blend-screen {
                    mix-blend-mode: screen;
                }
            `}</style>
        </div>
    );
}
