import { useState, useEffect } from 'react';
import { Shield, Zap, LayoutDashboard, Rocket } from 'lucide-react';

const SLIDES = [
    {
        id: 'brand',
        title: 'TROPICAL INSPIRE',
        subtitle: 'SISTEMAS INTEGRAIS DE GESTÃO',
        icon: Rocket,
        color: 'from-blue-600 to-indigo-600'
    },
    {
        id: 'security',
        title: 'SEGURANÇA TOTAL',
        subtitle: 'CONTROLO E PROTEÇÃO DE ATIVOS',
        icon: Shield,
        color: 'from-purple-600 to-fuchsia-600'
    },
    {
        id: 'performance',
        title: 'PERFORMANCE',
        subtitle: 'OTIMIZAÇÃO DE FLUXOS E PROCESSOS',
        icon: Zap,
        color: 'from-amber-500 to-orange-600'
    },
    {
        id: 'future',
        title: 'BEM-VINDO AO FUTURO',
        subtitle: 'ALGAR FROTA V1.10',
        icon: LayoutDashboard,
        color: 'from-emerald-500 to-teal-600'
    }
];

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        if (currentSlide < SLIDES.length) {
            const timer = setTimeout(() => {
                setIsAnimating(false);
                setTimeout(() => {
                    if (currentSlide === SLIDES.length - 1) {
                        handleFinish();
                    } else {
                        setCurrentSlide(prev => prev + 1);
                        setIsAnimating(true);
                    }
                }, 800); // Out animation transition
            }, 3000); // Slide duration

            return () => clearTimeout(timer);
        }
    }, [currentSlide]);

    const handleFinish = () => {
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
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r ${slide.color} opacity-10 blur-[150px] transition-all duration-1000 ${isAnimating ? 'scale-100 opacity-20' : 'scale-50 opacity-0'}`} />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            </div>

            <div className={`relative z-10 flex flex-col items-center text-center px-6 transition-all duration-1000 transform ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90 blur-xl'
                }`}>

                {/* Animated Icon Container */}
                <div className="relative mb-12 group">
                    <div className={`absolute inset-0 bg-gradient-to-r ${slide.color} blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-1000 animate-pulse`} />
                    <div className="relative w-32 h-32 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-3xl flex items-center justify-center shadow-2xl rotate-12 animate-in zoom-in-50 duration-1000">
                        <Icon className="w-16 h-16 text-white" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[1em] text-white/40 animate-in slide-in-from-bottom-4 duration-700">
                        {slide.id === 'brand' ? 'Apresentamos' : 'Compromisso'}
                    </h2>
                    <h1 className={`text-5xl md:text-7xl font-black bg-gradient-to-r ${slide.color} bg-clip-text text-transparent tracking-tighter animate-in slide-in-from-bottom-8 duration-1000`}>
                        {slide.title}
                    </h1>
                    <div className="h-[2px] w-24 bg-white/20 mx-auto rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${slide.color} transition-all duration-[3000ms] ease-linear ${isAnimating ? 'w-full' : 'w-0'}`} />
                    </div>
                    <p className="text-sm font-medium text-slate-400 tracking-[0.2em] uppercase animate-in fade-in duration-1000 delay-500">
                        {slide.subtitle}
                    </p>
                </div>
            </div>

            {/* Pagination Dots */}
            <div className="absolute bottom-12 flex gap-3 z-20">
                {SLIDES.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1 rounded-full transition-all duration-500 ${idx === currentSlide ? `w-12 bg-gradient-to-r ${slide.color}` : 'w-4 bg-white/10'
                            }`}
                    />
                ))}
            </div>

            <button
                onClick={handleFinish}
                className="absolute top-12 right-12 z-[1000] px-6 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/30 hover:text-white rounded-full text-[10px] font-black tracking-[0.3em] transition-all uppercase"
            >
                Saltar
            </button>
        </div>
    );
}
