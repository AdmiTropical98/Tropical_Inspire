import { useState, useEffect, useCallback, useRef } from 'react';
import { Rocket, Users, Wrench, LayoutDashboard, Volume2, Play, Music } from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'TROPICAL',
        subtitle: 'BEM-VINDO AO FUTURO',
        narrative: 'Seja bem-vindo à Algartempo. Criámos este espaço digital para potenciar o talento e a dedicação da nossa equipa, elevando o transporte a um novo patamar de eficiência.',
        icon: Rocket,
        color: 'from-blue-600 via-indigo-600 to-violet-600'
    },
    {
        id: 'drivers',
        title: 'EQUIPA',
        subtitle: 'MOTORISTAS DE ELITE',
        narrative: 'Para os nossos motoristas, desenhámos sistemas que garantem precisão horária e segurança máxima. O vosso caminho é a nossa prioridade absoluta todos os dias.',
        icon: Users,
        color: 'from-emerald-500 via-teal-600 to-cyan-600'
    },
    {
        id: 'workshop',
        title: 'RIGOR',
        subtitle: 'EXCELÊNCIA NA OFICINA',
        narrative: 'À equipa técnica, entregamos ferramentas de diagnóstico e controlo total. A saúde da nossa frota reflete o rigor e a mestria do vosso trabalho diário.',
        icon: Wrench,
        color: 'from-orange-500 via-amber-600 to-yellow-600'
    },
    {
        id: 'management',
        title: 'VISÃO',
        subtitle: 'GESTÃO E ESTRATÉGIA',
        narrative: 'Aos supervisores, oferecemos visão total. Dados em tempo real para decisões que movem a empresa. Juntos, definimos o futuro da mobilidade Algartempo.',
        icon: LayoutDashboard,
        color: 'from-rose-600 via-purple-600 to-indigo-600'
    }
];

// High-quality ambient track URL
const BGM_URL = "https://www.chosic.com/wp-content/uploads/2021/04/Ambient-Atmospheric-Cinematic-Background-Music-For-Videos-No-Copyright.mp3";

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [hasIniciado, setHasIniciado] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [animationStage, setAnimationStage] = useState(0); // 0: hidden, 1: subtitle, 2: title, 3: narrative+icon
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const speak = useCallback((text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter(v => v.lang.toLowerCase().includes('pt'));

        // Elite voice selection - searching for "Premium" or "Neural" first
        const bestVoice =
            // 1. PT-PT Neural / Premium (Microsoft/Google)
            ptVoices.find(v => v.lang.includes('PT') && (v.name.includes('Neural') || v.name.includes('Premium') || v.name.includes('Natural')))
            || ptVoices.find(v => v.lang.includes('PT') && (v.name.includes('Google') || v.name.includes('Microsoft')))
            // 2. Any PT-PT
            || ptVoices.find(v => v.lang.includes('PT'))
            // 3. Any PT (Fallback)
            || ptVoices[0];

        if (bestVoice) {
            utterance.voice = bestVoice;
            console.log("Selected Voice:", bestVoice.name);
        }

        utterance.lang = 'pt-PT';
        utterance.rate = 0.95; // Slightly slower for better clarity, but not robotic
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
            setTimeout(() => {
                if (currentSlide === SLIDES.length - 1) {
                    handleFinish();
                } else {
                    nextSlide();
                }
            }, 1200);
        };

        utterance.onerror = () => {
            console.error('Speech synthesis failure');
            setTimeout(() => {
                if (currentSlide === SLIDES.length - 1) handleFinish();
                else nextSlide();
            }, 6000);
        };

        window.speechSynthesis.speak(utterance);
    }, [currentSlide]);

    const nextSlide = () => {
        setAnimationStage(0);
        setTimeout(() => {
            setCurrentSlide(prev => prev + 1);
        }, 800);
    };

    const handleStart = () => {
        setHasIniciado(true);
        if (audioRef.current) {
            audioRef.current.volume = 0;
            audioRef.current.play().catch(e => console.error("Audio play blocked", e));
            // Fade in music
            const fadeIn = setInterval(() => {
                if (audioRef.current && audioRef.current.volume < 0.25) {
                    audioRef.current.volume += 0.01;
                } else {
                    clearInterval(fadeIn);
                }
            }, 50);
        }
    };

    const handleFinish = () => {
        window.speechSynthesis.cancel();
        setIsExiting(true);
        // Fade out music
        const fadeOut = setInterval(() => {
            if (audioRef.current && audioRef.current.volume > 0.01) {
                audioRef.current.volume -= 0.02;
            } else {
                if (audioRef.current) audioRef.current.pause();
                clearInterval(fadeOut);
            }
        }, 50);

        setTimeout(onComplete, 1200);
    };

    useEffect(() => {
        if (!hasIniciado) return;

        const t1 = setTimeout(() => setAnimationStage(1), 200);
        const t2 = setTimeout(() => setAnimationStage(2), 500);
        const t3 = setTimeout(() => {
            setAnimationStage(3);
            speak(SLIDES[currentSlide].narrative);
        }, 1000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.speechSynthesis.cancel();
        };
    }, [currentSlide, hasIniciado, speak]);

    useEffect(() => {
        if (animationStage === 3) {
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 0.8, 100));
            }, 100);
            return () => clearInterval(interval);
        } else {
            setProgress(0);
        }
    }, [animationStage]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-[#020205] flex items-center justify-center p-8 text-white">
                <audio ref={audioRef} src={BGM_URL} loop />
                <div className="max-w-xl text-center space-y-12 animate-in fade-in zoom-in duration-1000">
                    <div className="flex justify-center mb-12">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-white to-white/20 p-[2px] animate-pulse">
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center backdrop-blur-3xl">
                                <Volume2 className="w-12 h-12 text-white" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Experiência Imersiva</h1>
                        <p className="text-xl text-white/40 font-light leading-relaxed">
                            A tecnologia encontrou o seu propósito. <br />Ative o som para conhecer a nova Algartempo.
                        </p>
                    </div>
                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                    >
                        <span className="relative z-10 text-xl font-black uppercase tracking-widest">Entrar no Programa</span>
                        <Play className="relative z-10 w-6 h-6 fill-current" />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/10 font-black flex items-center justify-center gap-3">
                        <Music className="w-3 h-3" /> Background Music Enabled
                    </p>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-[#020205] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-105 blur-3xl' : 'opacity-100'
                }`}
        >
            <audio ref={audioRef} src={BGM_URL} loop />

            {/* Background Dynamics */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1600px] h-[1600px] bg-gradient-to-br ${slide.color} opacity-20 blur-[280px] transition-all duration-[3000ms] ease-expo ${animationStage >= 1 ? 'scale-110 rotate-6' : 'scale-75 opacity-0'}`} />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay" />
            </div>

            {/* Cinematic Content Layer */}
            <div className="relative z-10 w-full max-w-7xl px-12 text-center flex flex-col items-center justify-center min-h-[80vh]">

                {/* Visual Anchor */}
                <div className={`mb-8 transition-all duration-1000 transform ${animationStage >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-50 blur-xl'}`}>
                    <div className={`p-8 rounded-[2.5rem] bg-white text-black shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative`}>
                        <Icon className="w-12 h-12" />
                        <div className={`absolute -inset-4 bg-gradient-to-r ${slide.color} blur-3xl opacity-30 -z-10`} />
                    </div>
                </div>

                {/* Typography Architecture */}
                <div className="space-y-2 mb-12">
                    <h2 className={`text-sm tracking-[0.8em] font-black uppercase text-white/30 transition-all duration-1000 delay-100 ${animationStage >= 1 ? 'opacity-100 translate-y-0 tracking-[1.2em]' : 'opacity-0 translate-y-10 tracking-[2em]'
                        }`}>
                        {slide.subtitle}
                    </h2>

                    <h1 className={`text-[6rem] md:text-[10rem] font-black tracking-[-0.05em] leading-[1.1] transition-all duration-1000 delay-300 ${animationStage >= 2 ? 'opacity-100 translate-y-0 scale-100 rotate-0' : 'opacity-0 translate-y-20 scale-90 rotate-2 blur-3xl'
                        }`}>
                        <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent italic">
                            {slide.title}
                        </span>
                    </h1>
                </div>

                {/* Narrative & Progress */}
                <div className={`max-w-4xl mx-auto space-y-12 transition-all duration-1000 delay-500 ${animationStage >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-20 scale-95 blur-2xl'
                    }`}>
                    <div className="h-[3px] w-64 mx-auto bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-300 ease-linear shadow-[0_0_20px_rgba(255,255,255,0.4)]`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xl md:text-4xl font-light text-white/90 leading-relaxed tracking-wide text-center">
                        {slide.narrative}
                    </p>
                </div>
            </div>

            {/* HUD Layer */}
            <div className="absolute inset-x-0 bottom-0 p-12 flex justify-between items-end pointer-events-none">
                <div className="space-y-4 pointer-events-auto">
                    <div className="flex gap-2">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 rounded-full transition-all duration-700 ${idx === currentSlide ? 'w-24 bg-white' : 'w-4 bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.6em] text-white/20">
                        Módulo {currentSlide + 1} // Progressão de Equipas
                    </div>
                </div>

                <div className="flex flex-col items-end gap-6 pointer-events-auto">
                    <button
                        onClick={handleFinish}
                        className="px-10 py-4 bg-white/5 hover:bg-white text-white/40 hover:text-black backdrop-blur-3xl border border-white/10 rounded-full text-[10px] font-black tracking-[0.4em] transition-all uppercase hover:scale-105 active:scale-95"
                    >
                        Saltar Experiência
                    </button>
                    <div className="text-[10px] font-black uppercase tracking-[0.6em] text-white/10">Algartempo v1.9.1</div>
                </div>
            </div>
        </div>
    );
}
