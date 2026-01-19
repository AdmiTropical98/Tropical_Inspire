import { useState, useEffect, useCallback } from 'react';
import { Shield, Zap, LayoutDashboard, Rocket, Users, Wrench } from 'lucide-react';

const SLIDES = [
    {
        id: 'welcome',
        title: 'BEM-VINDO À EQUIPA',
        subtitle: 'ALGAR FROTA EXCELÊNCIA',
        narrative: 'Seja muito bem-vindo à equipa Algar Frota. Esta plataforma foi desenvolvida com o objetivo de apoiar o trabalho de excelência que realizamos todos os dias.',
        icon: Rocket,
        color: 'from-blue-600 to-indigo-600'
    },
    {
        id: 'drivers',
        title: 'MOTORISTAS',
        subtitle: 'SEGURANÇA E ESCALAS',
        narrative: 'Aos nossos motoristas, disponibilizamos as ferramentas ideais para a consulta e gestão das vossas escalas diárias, garantindo percursos sempre seguros e eficientes.',
        icon: Users,
        color: 'from-emerald-500 to-teal-600'
    },
    {
        id: 'workshop',
        title: 'OFICINA',
        subtitle: 'CONTROLO TÉCNICO',
        narrative: 'À nossa dedicada equipa de oficina, facilitamos o registo técnico e a manutenção preventiva, assegurando que a nossa frota está sempre no seu melhor estado operacional.',
        icon: Wrench,
        color: 'from-orange-500 to-amber-600'
    },
    {
        id: 'management',
        title: 'GESTÃO DE TOPO',
        subtitle: 'CONTROLO ABSOLUTO',
        narrative: 'Para os supervisores e gestores, entregamos controlo absoluto e dados em tempo real para uma gestão de topo. Desejamos a todos um excelente dia de trabalho!',
        icon: LayoutDashboard,
        color: 'from-purple-600 to-fuchsia-600'
    }
];

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isAnimating, setIsAnimating] = useState(true);

    const speak = useCallback((text: string) => {
        // Stop any current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Try to find a PT-PT female voice
        const voices = window.speechSynthesis.getVoices();
        const ptPtVoices = voices.filter(v => v.lang.startsWith('pt-PT') || v.lang.startsWith('pt'));

        // Prefer female-sounding voices if possible (many browsers don't expose gender explicitly, 
        // but naming usually gives a hint or we pick the first PT voice available)
        const femaleVoice = ptPtVoices.find(v =>
            v.name.toLowerCase().includes('maria') ||
            v.name.toLowerCase().includes('joana') ||
            v.name.toLowerCase().includes('female')
        ) || ptPtVoices[0];

        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.lang = 'pt-PT';
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.05; // Slightly higher for a more feminine/friendly tone if default

        window.speechSynthesis.speak(utterance);
    }, []);

    useEffect(() => {
        // Initial voice load (some browsers need a moment to populate getVoices)
        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                if (currentSlide === 0) speak(SLIDES[0].narrative);
            };
        } else if (currentSlide === 0) {
            speak(SLIDES[0].narrative);
        }
    }, [speak]);

    useEffect(() => {
        if (currentSlide < SLIDES.length) {
            // Speak the narrative of the new slide
            if (currentSlide > 0) speak(SLIDES[currentSlide].narrative);

            const timer = setTimeout(() => {
                setIsAnimating(false);
                setTimeout(() => {
                    if (currentSlide === SLIDES.length - 1) {
                        handleFinish();
                    } else {
                        setCurrentSlide(prev => prev + 1);
                        setIsAnimating(true);
                    }
                }, 1000); // Out animation transition
            }, 6500); // Increased duration to accommodate longer speech

            return () => clearTimeout(timer);
        }
    }, [currentSlide, speak]);

    const handleFinish = () => {
        window.speechSynthesis.cancel();
        setIsExiting(true);
        setTimeout(onComplete, 1200);
    };

    const slide = SLIDES[currentSlide];
    const Icon = slide.icon;

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-[#050510] flex items-center justify-center overflow-hidden transition-all duration-1000 ${isExiting ? 'opacity-0 scale-110' : 'opacity-100'
                }`}
        >
            {/* Background Cinematic Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-to-r ${slide.color} opacity-10 blur-[180px] transition-all duration-1000 ${isAnimating ? 'scale-110 opacity-30 shadow-[0_0_100px_rgba(255,255,255,0.1)]' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            </div>

            <div className={`relative z-10 flex flex-col items-center text-center px-6 max-w-5xl transition-all duration-1000 transform ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90 blur-xl'
                }`}>

                {/* Animated Icon Container */}
                <div className="relative mb-16 group">
                    <div className={`absolute inset-0 bg-gradient-to-r ${slide.color} blur-3xl opacity-30 group-hover:opacity-50 transition-all duration-1000 animate-pulse`} />
                    <div className="relative w-40 h-40 border border-white/10 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl flex items-center justify-center shadow-2xl rotate-6 animate-in zoom-in-50 duration-1000">
                        <Icon className="w-20 h-20 text-white" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-6">
                    <h2 className="text-[12px] font-black uppercase tracking-[1.2em] text-white/50 animate-in slide-in-from-bottom-4 duration-700">
                        {slide.subtitle}
                    </h2>
                    <h1 className={`text-6xl md:text-9xl font-black bg-gradient-to-r ${slide.color} bg-clip-text text-transparent tracking-tighter leading-tight animate-in slide-in-from-bottom-8 duration-1000`}>
                        {slide.title}
                    </h1>
                    <div className="h-[3px] w-48 bg-white/10 mx-auto rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-[6500ms] ease-linear ${isAnimating ? 'w-full' : 'w-0'}`} />
                    </div>
                    <p className="text-xl md:text-2xl font-medium text-slate-300 max-w-3xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-500 px-4">
                        {slide.narrative}
                    </p>
                </div>
            </div>

            {/* Pagination Dots */}
            <div className="absolute bottom-16 flex gap-4 z-20">
                {SLIDES.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-2 rounded-full transition-all duration-700 ${idx === currentSlide ? `w-20 bg-gradient-to-r ${slide.color}` : 'w-6 bg-white/10'
                            }`}
                    />
                ))}
            </div>

            <button
                onClick={handleFinish}
                className="absolute top-12 right-12 z-[1000] px-8 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/40 hover:text-white rounded-full text-[11px] font-black tracking-[0.4em] transition-all uppercase shadow-2xl"
            >
                Saltar
            </button>
        </div>
    );
}
