import { useState, useEffect, useCallback, useRef } from 'react';
import { Rocket, Users, Wrench, LayoutDashboard, Volume2, Play, Music, Cpu, Globe, ShieldCheck, Activity } from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'TROPICAL',
        subtitle: 'BEM-VINDO AO FUTURO',
        narrative: 'Seja bem-vindo à Algartempo. Criámos este espaço digital para potenciar o talento e a dedicação da nossa equipa, elevando o transporte a um novo patamar de eficiência.',
        icon: Rocket,
        color: 'from-blue-600 via-indigo-600 to-violet-600',
        techNote: 'SYS_CORE: ONLINE_INIT'
    },
    {
        id: 'drivers',
        title: 'EQUIPA',
        subtitle: 'MOTORISTAS DE ELITE',
        narrative: 'Para os nossos motoristas, desenhámos sistemas que garantem precisão horária e segurança máxima. O vosso caminho é a nossa prioridade absoluta todos os dias.',
        icon: Users,
        color: 'from-emerald-500 via-teal-600 to-cyan-600',
        techNote: 'RT_GPS: SYNC_READY'
    },
    {
        id: 'workshop',
        title: 'RIGOR',
        subtitle: 'EXCELÊNCIA NA OFICINA',
        narrative: 'À equipa técnica, entregamos ferramentas de diagnóstico e controlo total. A saúde da nossa frota reflete o rigor e a mestria do vosso trabalho diário.',
        icon: Wrench,
        color: 'from-orange-500 via-amber-600 to-yellow-600',
        techNote: 'MNT_DIAG: ACTIVE'
    },
    {
        id: 'management',
        title: 'VISÃO',
        subtitle: 'GESTÃO E ESTRATÉGIA',
        narrative: 'Aos supervisores, oferecemos visão total. Dados em tempo real para decisões que movem a empresa. Juntos, definimos o futuro da mobilidade Algartempo.',
        icon: LayoutDashboard,
        color: 'from-rose-600 via-purple-600 to-indigo-600',
        techNote: 'MGMT_DASH: REALTIME_EXT'
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
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Parallax logic
    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const x = (clientX / window.innerWidth - 0.5) * 40;
        const y = (clientY / window.innerHeight - 0.5) * 40;
        setMousePos({ x, y });
    };

    const speak = useCallback((text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter(v => v.lang.toLowerCase().includes('pt'));

        // ELITE MASCULINE PT-PT VOICE SELECTION
        // Prioritizing names that sound masculine like Duarte, Helder, David, Pedro, or containing "Male"
        const malePatterns = ['Duarte', 'Helder', 'Helio', 'David', 'Pedro', 'Dário', 'Male', 'Dinis'];

        const bestVoice =
            // 1. PT-PT Neural Masculine (Duarte is common in MS systems)
            ptVoices.find(v => v.lang.includes('PT') && (v.name.includes('Neural') || v.name.includes('Premium')) && malePatterns.some(p => v.name.includes(p)))
            // 2. Any PT Neural
            || ptVoices.find(v => v.lang.includes('PT') && (v.name.includes('Neural') || v.name.includes('Premium')))
            // 3. Any PT-PT that matches male patterns
            || ptVoices.find(v => v.lang.includes('PT') && malePatterns.some(p => v.name.includes(p)))
            // 4. Any PT-PT
            || ptVoices.find(v => v.lang.includes('PT'))
            // 5. Fallback
            || ptVoices[0];

        if (bestVoice) {
            utterance.voice = bestVoice;
            console.log("Elite Voice Selection (Male Preferred):", bestVoice.name);
        }

        utterance.lang = 'pt-PT';
        utterance.rate = 0.98; // Natural pace
        utterance.pitch = 0.85; // LOWERED PITCH for deeper masculine feel
        utterance.volume = 1.0;

        utterance.onend = () => {
            setTimeout(() => {
                if (currentSlide === SLIDES.length - 1) {
                    handleFinish();
                } else {
                    nextSlide();
                }
            }, 1500);
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
            const fadeIn = setInterval(() => {
                if (audioRef.current && audioRef.current.volume < 0.2) {
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
        const t1 = setTimeout(() => setAnimationStage(1), 300);
        const t2 = setTimeout(() => setAnimationStage(2), 600);
        const t3 = setTimeout(() => {
            setAnimationStage(3);
            speak(SLIDES[currentSlide].narrative);
        }, 1100);

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
                setProgress(prev => Math.min(prev + 0.7, 100));
            }, 100);
            return () => clearInterval(interval);
        } else {
            setProgress(0);
        }
    }, [animationStage]);

    if (!hasIniciado) {
        return (
            <div className="fixed inset-0 z-[999999] bg-[#020205] flex items-center justify-center p-8 text-white select-none">
                <audio ref={audioRef} src={BGM_URL} loop />

                {/* Intro Background Elements */}
                <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:100px_100px]" />
                </div>

                <div className="max-w-xl text-center space-y-12 animate-in fade-in zoom-in duration-1000">
                    <div className="flex justify-center mb-12">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-white/10 blur-2xl rounded-full animate-pulse" />
                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-white to-white/20 p-[2px]">
                                <div className="w-full h-full rounded-full bg-black flex items-center justify-center backdrop-blur-3xl">
                                    <Volume2 className="w-12 h-12 text-white" />
                                </div>
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
                        className="group relative inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_20px_60px_rgba(255,255,255,0.1)]"
                    >
                        <span className="relative z-10 text-xl font-black uppercase tracking-widest">Entrar no Programa</span>
                        <Play className="relative z-10 w-6 h-6 fill-current" />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-black flex items-center justify-center gap-3">
                        <Music className="w-3 h-3" /> Professional Tech Narration Powered by AI
                    </p>
                </div>
            </div>
        );
    }

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            onMouseMove={handleMouseMove}
            className={`fixed inset-0 z-[999999] bg-[#020205] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 select-none ${isExiting ? 'opacity-0 scale-105 blur-3xl' : 'opacity-100'}`}
        >
            <audio ref={audioRef} src={BGM_URL} loop />

            {/* HIGH-TECH BACKGROUND ARCHITECTURE */}
            <div className="absolute inset-0 pointer-events-none">
                {/* 3D Moving Gradient Layer */}
                <div
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1800px] h-[1800px] bg-gradient-to-br ${slide.color} opacity-20 blur-[300px] transition-all duration-[4000ms] ease-expo ${animationStage >= 1 ? 'scale-110 opacity-30' : 'scale-50 opacity-0'}`}
                    style={{ transform: `translate(calc(-50% + ${mousePos.x * 0.5}px), calc(-50% + ${mousePos.y * 0.5}px))` }}
                />

                {/* Tech Grid System */}
                <div
                    className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-40 transition-transform duration-1000"
                    style={{ transform: `scale(1.1) translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)` }}
                />

                {/* Scanning Light Effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-1/4 animate-scan opacity-10" />

                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.2] mix-blend-overlay" />
            </div>

            {/* CINEMATIC HUD DECORATIONS */}
            <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between items-stretch">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[8px] font-black tracking-widest text-white/20 uppercase">
                            <Cpu className="w-2 h-2" /> CORE_LOAD: 2.44%
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">
                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> RT_ACCESS: GRANTED
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="text-[8px] font-black tracking-widest text-white/20 uppercase">LAT: 37.0194° N</div>
                        <div className="text-[8px] font-black tracking-widest text-white/20 uppercase">LNG: 7.9304° W</div>
                    </div>
                </div>

                <div className="flex justify-between items-end border-t border-white/5 pt-8">
                    <div className="flex gap-12 text-[9px] font-black tracking-[0.4em] text-white/10 uppercase">
                        <div className="flex items-center gap-4"><Globe className="w-3 h-3" /> GLOBAL_SYNC</div>
                        <div className="flex items-center gap-4"><ShieldCheck className="w-3 h-3" /> SEC_PROTOCOL_V4</div>
                        <div className="flex items-center gap-4"><Activity className="w-3 h-3" /> {slide.techNote}</div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="w-32 h-[1px] bg-white/10 mb-2" />
                        <div className="text-[8px] font-black tracking-[0.8em] text-white/5 uppercase">Algartempo System Framework</div>
                    </div>
                </div>
            </div>

            {/* MAIN CINEMATIC CONTENT */}
            <div
                className="relative z-10 w-full max-w-7xl px-12 text-center flex flex-col items-center justify-center min-h-[80vh] cursor-default"
                style={{ transform: `translate(${mousePos.x * -1}px, ${mousePos.y * -1}px)` }}
            >

                {/* Visual Anchor (Parallax Intense) */}
                <div className={`mb-12 transition-all duration-1000 transform ${animationStage >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-50 blur-xl'}`}>
                    <div
                        className="p-10 rounded-[3rem] bg-white text-black shadow-[0_60px_130px_rgba(0,0,0,0.9)] relative group transition-transform duration-300"
                    >
                        <Icon className="w-16 h-16 transform transition-transform group-hover:scale-110" />
                        <div className={`absolute -inset-8 bg-gradient-to-r ${slide.color} blur-[100px] opacity-40 -z-10 animate-pulse`} />
                    </div>
                </div>

                {/* Typography Architecture */}
                <div className="space-y-4 mb-20 relative">
                    <div className={`absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black tracking-[1.5em] text-white/10 italic transition-all duration-1000 ${animationStage >= 1 ? 'opacity-100 tracking-[2em]' : 'opacity-0'}`}>
                        ESTABLISHED_2024
                    </div>

                    <h2 className={`text-base tracking-[1.2em] font-black uppercase text-white/40 transition-all duration-1000 delay-100 ${animationStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                        }`}>
                        {slide.subtitle}
                    </h2>

                    <h1 className={`text-[8rem] md:text-[13rem] font-black tracking-[-0.07em] leading-[1.0] transition-all duration-1000 delay-300 ${animationStage >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-20 scale-95 blur-3xl'
                        }`}>
                        <span className="bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent italic filter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            {slide.title}
                        </span>
                    </h1>
                </div>

                {/* Narrative & Progress */}
                <div className={`max-w-5xl mx-auto space-y-16 transition-all duration-1000 delay-500 ${animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                    }`}>
                    <div className="relative h-[2px] w-80 mx-auto bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-300 ease-linear shadow-[0_0_20px_rgba(255,255,255,0.6)]`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-2xl md:text-5xl font-light text-white leading-relaxed [text-wrap:balance] tracking-tight">
                        {slide.narrative}
                    </p>
                </div>
            </div>

            {/* INTERACTIVE HUD OVERLAY */}
            <div className="absolute inset-x-0 bottom-0 p-12 flex justify-between items-end pointer-events-none">
                <div className="space-y-6 pointer-events-auto">
                    <div className="flex gap-3">
                        {SLIDES.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-700 ${idx === currentSlide ? 'w-32 bg-white' : 'w-6 bg-white/5'
                                    }`}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-[12px] font-black uppercase tracking-[0.8em] text-white/40">
                            STEP_0{currentSlide + 1} <span className="text-white/10 ml-4">//</span> INTEGRATION
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-10 pointer-events-auto">
                    <button
                        onClick={handleFinish}
                        className="group relative px-12 py-5 bg-white/5 hover:bg-white text-white/30 hover:text-black border border-white/10 rounded-full text-[11px] font-black tracking-[0.6em] transition-all uppercase hover:scale-105"
                    >
                        <span className="relative z-10 italic">Skip Experience</span>
                        <div className="absolute inset-0 bg-white/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="text-[10px] font-black uppercase tracking-[1em] text-white/10 italic">Algartempo OS v1.9</div>
                        <div className="w-16 h-[1px] bg-white/5" />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(400%); }
                }
                .animate-scan {
                    animation: scan 8s linear infinite;
                }
                .ease-expo {
                    transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
                }
            `}</style>
        </div>
    );
}
