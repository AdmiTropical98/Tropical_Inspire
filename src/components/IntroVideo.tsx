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
        description: 'A tecnologia Algartempo liga cada autocarro ao sucesso da sua frota.',
        image: '/assets/3d_bus.png',
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

                <div className="max-w-4xl text-center space-y-20 relative z-10 animate-in fade-in duration-1500 scale-in-95">
                    <div className="space-y-12">
                        <div className="relative inline-block scale-150 mb-12">
                            <div className="absolute -inset-8 bg-blue-500/30 blur-[60px] rounded-full animate-pulse" />
                            <div className="relative w-32 h-32 bg-white text-black rounded-[2.5rem] flex items-center justify-center shadow-[0_0_100px_rgba(255,255,255,0.4)] transform hover:rotate-12 transition-transform cursor-pointer" onClick={handleStart}>
                                <Volume2 className="w-16 h-16 animate-bounce text-blue-600" />
                            </div>
                        </div>
                        <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter leading-[0.95] italic uppercase drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                            ALGAR TEMPO <br />
                            <span className="text-white/20 not-italic tracking-[0.2em] text-5xl md:text-7xl block mt-4">EXPERIENCE</span>
                        </h1>
                        <p className="text-2xl md:text-3xl text-white/50 font-light max-w-2xl mx-auto leading-relaxed uppercase tracking-[0.4em]">
                            A Revolução Digital nos Transportes
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-10 px-24 py-12 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_40px_120px_rgba(255,255,255,0.25)] border-[12px] border-transparent hover:border-white/20"
                    >
                        <span className="relative z-10 text-3xl font-black uppercase tracking-widest italic">Iniciar Programa</span>
                        <Play className="relative z-10 w-10 h-10 fill-current transform group-hover:scale-150 group-hover:rotate-12 transition-transform" />
                    </button>

                    <div className="text-[12px] font-black uppercase tracking-[1.5em] text-white/10 mt-20">
                        AUDIOPHASIC IMMERSION ENABLED
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
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2200px] h-[2200px] bg-gradient-to-br ${slide.color} opacity-30 blur-[400px] transition-all duration-[2500ms] ${animationStage >= 1 ? 'scale-110 opacity-50' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-black/70" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:150px_150px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
            </div>

            <div className="relative z-10 w-full max-w-[1800px] px-24 flex flex-col items-center justify-center min-h-screen">

                <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-24 lg:gap-40">

                    {/* 3D CHARACTER ENGINE - SCREEN BLENDING & MASSIVE SCALE */}
                    <div className={`relative flex-1 transition-all duration-[2500ms] cubic-bezier(0.23, 1, 0.32, 1) transform ${animationStage >= 1 ? 'opacity-100 translate-x-0 scale-125' : 'opacity-0 -translate-x-60 scale-50 rotate-[-10deg]'
                        }`}>
                        <div className="relative group">
                            <div className={`absolute -inset-40 bg-gradient-to-br ${slide.color} opacity-40 blur-[180px] rounded-full animate-pulse`} />
                            {/* The 'screen' blend mode removes the black background perfectly */}
                            <img
                                src={slide.image}
                                alt={slide.title}
                                className="relative w-full max-w-[900px] mx-auto mix-blend-screen brightness-125 contrast-110 drop-shadow-[0_120px_150px_rgba(0,0,0,1)] animate-float-intense"
                            />
                        </div>
                    </div>

                    {/* TYPOGRAPHY ARCHITECTURE */}
                    <div className="flex-1 text-center lg:text-left space-y-16">
                        <div className="space-y-6">
                            <h2 className={`text-2xl md:text-3xl tracking-[1.2em] font-black uppercase text-white/20 transition-all duration-1200 delay-300 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                                }`}>
                                {slide.subtitle}
                            </h2>

                            <h1 className={`text-[10rem] md:text-[18rem] font-black tracking-tighter leading-[0.75] italic transition-all duration-1500 delay-500 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-40 blur-3xl'
                                }`}>
                                <span className={`bg-gradient-to-br ${slide.color} bg-clip-text text-transparent uppercase drop-shadow-[0_20px_80px_rgba(255,255,255,0.3)]`}>
                                    {slide.title}
                                </span>
                            </h1>

                            <div className={`max-w-2xl transition-all duration-1200 delay-700 ${animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                                }`}>
                                <p className="text-4xl md:text-6xl font-light text-white leading-[1.1] tracking-tight mt-16 antialiased">
                                    {slide.description}
                                </p>
                            </div>
                        </div>

                        {/* ELITE NAVIGATION */}
                        <div className={`pt-20 transition-all duration-1500 delay-1000 ${animationStage >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-40 scale-90'}`}>
                            <button
                                onClick={handleNext}
                                className="group relative flex items-center gap-12 py-10 px-24 bg-white text-black rounded-[3rem] transition-all hover:scale-110 active:scale-95 shadow-[0_50px_100px_rgba(255,255,255,0.2)] border-[10px] border-transparent hover:border-black/5"
                            >
                                <span className="text-3xl font-black uppercase tracking-widest italic">
                                    {currentSlide === SLIDES.length - 1 ? 'Iniciar Agora' : 'Próximo Passo'}
                                </span>
                                <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center transition-all group-hover:rotate-[-10deg] group-hover:scale-125 shadow-xl">
                                    {currentSlide === SLIDES.length - 1 ? <Zap className="w-8 h-8 fill-current text-yellow-400" /> : <ChevronRight className="w-10 h-10" />}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* FUTURISTIC PROGRESS METRICS */}
                <div className="absolute inset-x-0 bottom-16 px-24 flex justify-between items-end">
                    <div className="flex gap-8">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-3 rounded-full transition-all duration-[1200ms] cubic-bezier(0.23, 1, 0.32, 1) ${idx === currentSlide ? 'w-[300px] bg-white shadow-[0_0_40px_white]' : 'w-12 bg-white/5'
                                    }`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col items-end gap-4">
                        <div className="text-[14px] font-black uppercase tracking-[1.2em] text-white/10 italic">ALGAR TEMPO ECOSYSTEM v4.0</div>
                        <button
                            onClick={handleFinish}
                            className="group flex items-center gap-4 text-[12px] font-black uppercase tracking-[0.8em] text-white/20 hover:text-white transition-all transform hover:translate-x-2"
                        >
                            SALTAR EXPERIÊNCIA <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float-intense {
                    0% { transform: translateY(0px) rotate(0deg) scale(1); }
                    33% { transform: translateY(-40px) rotate(3deg) scale(1.02); }
                    66% { transform: translateY(10px) rotate(-2deg) scale(0.98); }
                    100% { transform: translateY(0px) rotate(0deg) scale(1); }
                }
                .animate-float-intense {
                    animation: float-intense 8s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
                }
                .tracking-tighter {
                    letter-spacing: -0.06em;
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
