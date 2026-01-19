import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Zap, LayoutDashboard, Rocket, Users, Wrench } from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'TROPICAL INSPIRE',
        subtitle: 'BEM-VINDO À EQUIPA',
        narrative: 'Seja muito bem-vindo à equipa Algar Frota. Esta plataforma foi desenvolvida com o objetivo de apoiar o trabalho de excelência que realizamos todos os dias.',
        icon: Rocket,
        color: 'from-blue-600 to-indigo-700'
    },
    {
        id: 'drivers',
        title: 'MOTORISTAS',
        subtitle: 'SEGURANÇA E ESCALAS',
        narrative: 'Aos nossos motoristas, disponibilizamos as ferramentas ideais para a consulta e gestão das vossas escalas diárias, garantindo percursos sempre seguros e eficientes.',
        icon: Users,
        color: 'from-emerald-500 to-teal-700'
    },
    {
        id: 'workshop',
        title: 'OFICINA',
        subtitle: 'CONTROLO TÉCNICO',
        narrative: 'À nossa dedicada equipa de oficina, facilitamos o registo técnico e a manutenção preventiva, assegurando que a nossa frota está sempre no seu melhor estado operacional.',
        icon: Wrench,
        color: 'from-orange-500 to-amber-700'
    },
    {
        id: 'management',
        title: 'GESTÃO DE TOPO',
        subtitle: 'CONTROLO ABSOLUTO',
        narrative: 'Para os supervisores e gestores, entregamos controlo absoluto e dados em tempo real para uma gestão de topo. Desejamos a todos um excelente dia de trabalho!',
        icon: LayoutDashboard,
        color: 'from-purple-600 to-fuchsia-800'
    }
];

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [progress, setProgress] = useState(0);

    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

    const handleNextSlide = useCallback(() => {
        setIsAnimating(false);
        setTimeout(() => {
            if (currentSlide === SLIDES.length - 1) {
                handleFinish();
            } else {
                setCurrentSlide(prev => prev + 1);
            }
        }, 1200); // Out animation transition
    }, [currentSlide]);

    const speak = useCallback((text: string) => {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        speechRef.current = utterance;

        // Voice selection: prioritize premium/natural voices
        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter(v => v.lang.startsWith('pt'));

        // Strategy: 1. Neural/Natural pt-PT, 2. Google pt-PT, 3. Microsoft pt-PT, 4. First pt found
        const preferredVoice = ptVoices.find(v => (v.lang === 'pt-PT' && (v.name.includes('Neural') || v.name.includes('Natural'))))
            || ptVoices.find(v => (v.lang === 'pt-PT' && v.name.includes('Google')))
            || ptVoices.find(v => (v.lang === 'pt-PT' && v.name.includes('Microsoft')))
            || ptVoices.find(v => v.lang === 'pt-PT')
            || ptVoices[0];

        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = 'pt-PT';
        utterance.rate = 0.85; // Natural, calm tempo
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            setIsAnimating(true);
            setProgress(0);
        };

        utterance.onend = () => {
            // Give 1 second of pause after speaking before changing slide
            setTimeout(handleNextSlide, 1000);
        };

        window.speechSynthesis.speak(utterance);
    }, [handleNextSlide]);

    useEffect(() => {
        // Initial load with delay to ensure first slide narrration starts
        const timeout = setTimeout(() => {
            speak(SLIDES[currentSlide].narrative);
        }, 800);

        return () => {
            clearTimeout(timeout);
            window.speechSynthesis.cancel();
        };
    }, [currentSlide, speak]);

    // Simple progress bar mock (since TTS progress is hard to track accurately cross-browser)
    useEffect(() => {
        if (isAnimating) {
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 1.5, 100));
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isAnimating]);

    const handleFinish = () => {
        window.speechSynthesis.cancel();
        setIsExiting(true);
        setTimeout(onComplete, 1200);
    };

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-[#020205] flex items-center justify-center overflow-hidden transition-all duration-1000 ${isExiting ? 'opacity-0 scale-110' : 'opacity-100'
                }`}
        >
            {/* Professional Background: Bokeh & Particles */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-gradient-to-br ${slide.color} opacity-20 blur-[200px] transition-all duration-[2000ms] ${isAnimating ? 'scale-110 rotate-12' : 'scale-50 rotate-0 opacity-0'}`} />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-soft-light" />

                {/* Floating particles (SVG approach for purity) */}
                <div className="absolute inset-0 overflow-hidden opacity-20">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute bg-white rounded-full animate-pulse-slow"
                            style={{
                                width: Math.random() * 4 + 'px',
                                height: Math.random() * 4 + 'px',
                                top: Math.random() * 100 + '%',
                                left: Math.random() * 100 + '%',
                                animationDelay: Math.random() * 5 + 's',
                                opacity: Math.random() * 0.5
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className={`relative z-10 flex flex-col items-center text-center px-8 max-w-6xl transition-all duration-1000 transform ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-20 scale-95 blur-2xl'
                }`}>

                {/* Elite Icon Container: Glassmorphism */}
                <div className="relative mb-20 group">
                    <div className={`absolute -inset-8 bg-gradient-to-r ${slide.color} blur-[60px] opacity-40 transition-all duration-1000 ${isAnimating ? 'scale-100' : 'scale-50'}`} />
                    <div className="relative w-44 h-44 border border-white/20 rounded-[3rem] bg-white/5 backdrop-blur-2xl flex items-center justify-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-transform duration-1000 hover:rotate-6">
                        <Icon className="w-20 h-20 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    </div>
                </div>

                {/* Professional Typography Box */}
                <div className="space-y-8 bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] shadow-2xl">
                    <div className="flex flex-col items-center gap-2">
                        <h2 className="text-[14px] font-bold uppercase tracking-[0.8em] text-white/40 mb-2">
                            {slide.subtitle}
                        </h2>
                        <h1 className={`text-6xl md:text-8xl font-black bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent tracking-tight leading-none`}>
                            {slide.title}
                        </h1>
                    </div>

                    <div className="h-[4px] w-64 bg-white/5 mx-auto rounded-full overflow-hidden shadow-inner">
                        <div
                            className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-[100ms] ease-linear`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <p className="text-xl md:text-3xl font-light text-slate-200/90 max-w-4xl mx-auto leading-relaxed tracking-wide px-4">
                        {slide.narrative}
                    </p>
                </div>
            </div>

            {/* Pagination & Status */}
            <div className="absolute bottom-20 flex flex-col items-center gap-6 z-20">
                <div className="flex gap-4">
                    {SLIDES.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-2 rounded-full transition-all duration-700 ${idx === currentSlide ? `w-24 bg-gradient-to-r ${slide.color}` : 'w-8 bg-white/5'
                                }`}
                        />
                    ))}
                </div>
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/20">
                    Módulo {currentSlide + 1} de {SLIDES.length}
                </p>
            </div>

            <button
                onClick={handleFinish}
                className="absolute top-12 right-12 z-[1000] px-10 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-3xl border border-white/10 text-white/30 hover:text-white rounded-full text-[11px] font-bold tracking-[0.5em] transition-all uppercase hover:scale-105 active:scale-95"
            >
                Saltar
            </button>
        </div>
    );
}
