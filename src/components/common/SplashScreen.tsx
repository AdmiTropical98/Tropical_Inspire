import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function SplashScreen({ onComplete, message = "A iniciar aplicação..." }: { onComplete?: () => void, message?: string }) {
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let interval: any;
        let timeout: any;

        const checkConnection = () => {
            // Reset
            setStatus('loading');
            setProgress(0);

            // Smooth progress animation
            interval = setInterval(() => {
                setProgress(prev => {
                    // Slow down as we get closer to 90%
                    if (prev >= 90) return 90;
                    const increment = Math.max(1, (90 - prev) / 10);
                    return Math.min(90, prev + increment);
                });
            }, 100);

            // Check connection simulation
            timeout = setTimeout(() => {
                if (navigator.onLine) {
                    clearInterval(interval);
                    setProgress(100);
                    // Slight delay before completing to show full bar
                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 500);
                } else {
                    clearInterval(interval);
                    setStatus('error');
                }
            }, 2000); // Wait 2s to simulate load/check
        };

        checkConnection();

        return () => {
            if (interval) clearInterval(interval);
            if (timeout) clearTimeout(timeout);
        };
    }, []); // Run once on mount

    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#020617] flex items-center justify-center overflow-hidden">
            {/* Cinematic Moving Fleet Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/fleet-bg.png"
                    alt="Algartempo Frota Fleet"
                    className="w-full h-full object-cover scale-110 animate-slow-zoom brightness-75"
                />
                {/* Deeper, more sophisticated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80" />
            </div>

            <div className="flex flex-col items-center w-full px-8 relative z-10">

                {/* Massive Logo with Premium Glow */}
                <div className="w-80 h-80 md:w-[500px] md:h-[500px] mb-12 relative animate-fade-in group">
                    <div className="absolute inset-0 bg-blue-500/25 blur-[120px] rounded-full animate-pulse transition-all duration-1000 group-hover:bg-blue-400/35" />
                    <img
                        src="/LOGO.png"
                        alt="Algar Frota"
                        className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.7)] relative z-10 transition-transform duration-1000 hover:scale-105"
                    />
                </div>

                {status === 'loading' ? (
                    <div className="w-full max-w-sm animate-fade-in">
                        {/* Professional Progress Bar with Glassmorphism */}
                        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-6 backdrop-blur-xl border border-white/10 shadow-inner">
                            {/* Glow behind the bar */}
                            <div className="absolute inset-0 bg-blue-500/5 blur-sm" />

                            {/* Animated Fill with Gradient and Shimmer */}
                            <div
                                className="h-full bg-gradient-to-r from-blue-700 via-blue-500 to-blue-300 transition-all duration-700 ease-out shadow-[0_0_25px_rgba(59,130,246,0.8)] relative rounded-full"
                                style={{ width: `${progress}%` }}
                            >
                            </div>
                        </div>

                        {/* High-end Typography */}
                        <div className="space-y-1">
                            <p className="text-center text-white text-[11px] font-black tracking-[0.6em] uppercase animate-pulse drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
                                {message}
                            </p>
                            <div className="flex justify-center gap-1 opacity-40">
                                <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0s]" />
                                <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 bg-slate-950/80 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
                        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20 rotate-3">
                            <WifiOff className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-white font-black text-xl mb-3 tracking-tight">Sem Internet</h3>
                        <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed max-w-[200px]">
                            A sua conexão falhou. Vamos tentar restabelecer o acesso?
                        </p>
                        <button
                            onClick={handleRetry}
                            className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-8 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-[0_15px_30px_rgba(37,99,235,0.4)] border border-blue-400/20"
                        >
                            <RefreshCw className="w-5 h-5" />
                            TENTAR NOVAMENTE
                        </button>
                    </div>
                )}

                {/* Footer Brand Premium */}
                <div className="absolute -bottom-24 flex flex-col items-center gap-2 opacity-60">
                    <div className="h-[1px] w-8 bg-white/20" />
                    <div className="text-white text-[11px] font-black tracking-[0.5em] drop-shadow-lg">
                        ALGARTEMPO FROTA
                    </div>
                </div>
            </div>
        </div>
    );
}
