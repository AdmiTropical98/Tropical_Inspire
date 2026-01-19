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
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(0);

    // Voice selection logic
    const getBestVoice = useCallback(() => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return null;

        const ptVoices = voices.filter(v => v.lang.startsWith('pt'));

        // Priority: 1. Neural pt-PT, 2. Natural pt-PT, 3. Google pt-PT, 4. Microsoft pt-PT, 5. Any pt-PT, 6. Any pt
        return ptVoices.find(v => v.lang === 'pt-PT' && (v.name.includes('Neural') || v.name.includes('Natural')))
            || ptVoices.find(v => v.lang === 'pt-PT' && v.name.includes('Google'))
            || ptVoices.find(v => v.lang === 'pt-PT' && v.name.includes('Microsoft'))
            || ptVoices.find(v => v.lang === 'pt-PT')
            || ptVoices[0];
    }, []);

    const handleNextSlide = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => {
            if (currentSlide === SLIDES.length - 1) {
                handleFinish();
            } else {
                setCurrentSlide(prev => prev + 1);
            }
        }, 1000);
    }, [currentSlide]);

    const speak = useCallback((text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const voice = getBestVoice();
        if (voice) utterance.voice = voice;

        utterance.lang = 'pt-PT';
        utterance.rate = 0.85; // Slower for more natural feel
        utterance.pitch = 1.0;

        utterance.onend = () => {
            setTimeout(handleNextSlide, 1500);
        };

        utterance.onerror = () => {
            console.error('Speech error, skipping slide...');
            setTimeout(handleNextSlide, 5000);
        };

        window.speechSynthesis.speak(utterance);
    }, [getBestVoice, handleNextSlide]);

    useEffect(() => {
        // Show content immediately when slide changes
        setIsVisible(true);
        setProgress(0);

        // Start voice
        const initVoice = () => {
            speak(SLIDES[currentSlide].narrative);
        };

        const timeout = setTimeout(initVoice, 500);

        return () => {
            clearTimeout(timeout);
            window.speechSynthesis.cancel();
        };
    }, [currentSlide, speak]);

    // Progress bar animation
    useEffect(() => {
        if (isVisible) {
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 0.8, 100)); // Slower progress bar to match longer audio
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isVisible]);

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
            {/* Background Dynamics */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] bg-gradient-to-br ${slide.color} opacity-20 blur-[220px] transition-all duration-[3000ms] ${isVisible ? 'scale-110 rotate-6' : 'scale-50 rotate-0 opacity-0'}`} />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-soft-light" />

                {/* Subtle slow particles */}
                <div className="absolute inset-0 overflow-hidden opacity-10">
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute bg-white rounded-full"
                            style={{
                                width: '2px',
                                height: '2px',
                                top: Math.random() * 100 + '%',
                                left: Math.random() * 100 + '%',
                                transition: 'all 10s linear',
                                opacity: Math.random() * 0.5
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className={`relative z-10 flex flex-col items-center text-center px-10 max-w-7xl transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-24 scale-95 blur-3xl'
                }`}>

                {/* Elite Icon Container */}
                <div className="relative mb-24 group">
                    <div className={`absolute -inset-10 bg-gradient-to-r ${slide.color} blur-[80px] opacity-40 transition-all duration-1000 ${isVisible ? 'scale-100' : 'scale-50'}`} />
                    <div className="relative w-48 h-48 border border-white/20 rounded-[3.5rem] bg-white/5 backdrop-blur-3xl flex items-center justify-center shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
                        <Icon className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
                    </div>
                </div>

                {/* Professional Typography Box */}
                <div className="space-y-10 bg-black/40 backdrop-blur-3xl border border-white/10 p-16 rounded-[3rem] shadow-2xl ring-1 ring-white/10">
                    <div className="flex flex-col items-center gap-4">
                        <h2 className="text-[14px] font-black uppercase tracking-[1em] text-white/30 mb-2">
                            {slide.subtitle}
                        </h2>
                        <h1 className={`text-6xl md:text-9xl font-black bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent tracking-tighter leading-[0.9] pb-4`}>
                            {slide.title}
                        </h1>
                    </div>

                    <div className="h-[2px] w-72 bg-white/5 mx-auto rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-100 ease-linear`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <p className="text-xl md:text-4xl font-light text-slate-100 tracking-wide max-w-5xl mx-auto leading-relaxed">
                        {slide.narrative}
                    </p>
                </div>
            </div>

            {/* Pagination */}
            <div className="absolute bottom-24 flex flex-col items-center gap-8 z-20">
                <div className="flex gap-6">
                    {SLIDES.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-[2px] rounded-full transition-all duration-1000 ${idx === currentSlide ? `w-28 bg-white` : 'w-10 bg-white/10'
                                }`}
                        />
                    ))}
                </div>
                <p className="text-[12px] font-bold uppercase tracking-[0.5em] text-white/20">
                    Módulo {currentSlide + 1} de {SLIDES.length}
                </p>
            </div>

            <button
                onClick={handleFinish}
                className="absolute top-12 right-12 z-[1000] px-12 py-5 bg-white/5 hover:bg-white/10 backdrop-blur-3xl border border-white/10 text-white/30 hover:text-white rounded-full text-[12px] font-black tracking-[0.6em] transition-all uppercase hover:scale-105"
            >
                Saltar
            </button>
        </div>
    );
}
