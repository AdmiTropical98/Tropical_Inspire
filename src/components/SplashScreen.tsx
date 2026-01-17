import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

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
        <div className="fixed inset-0 z-[99999] bg-[#0f172a] flex items-center justify-center overflow-hidden">
            {/* Cinematic Moving Fleet Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/fleet-bg.png"
                    alt="Algar Tempo Fleet"
                    className="w-full h-full object-cover scale-110 animate-slow-zoom"
                />
                {/* Optimized overlay for the moving scene */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/80" />
            </div>

            <div className="flex flex-col items-center max-w-xs w-full px-8 relative z-10">

                {/* Logo with clean glow */}
                <div className="w-56 h-56 mb-12 relative animate-fade-in">
                    <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full" />
                    <img
                        src="/logo-algar-frota.png"
                        alt="Algar Frota"
                        className="w-full h-full object-contain drop-shadow-[0_10px_35px_rgba(0,0,0,0.5)] relative z-10"
                    />
                </div>

                {status === 'loading' ? (
                    <div className="w-full animate-fade-in">
                        {/* Progress Bar Container */}
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4 backdrop-blur-md border border-white/5">
                            {/* Animated Fill */}
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-300 transition-all duration-700 ease-out shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-center text-white text-[10px] font-black tracking-[0.4em] uppercase animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {message}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                            <WifiOff className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">Sem Internet</h3>
                        <p className="text-slate-400 text-center text-sm mb-6 leading-relaxed">
                            Verifique a sua conexão para continuar.
                        </p>
                        <button
                            onClick={handleRetry}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-xl shadow-blue-900/40"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Tentar Novamente
                        </button>
                    </div>
                )}

                {/* Footer Brand */}
                <div className="absolute -bottom-24 text-white text-[10px] font-black tracking-[0.4em] opacity-60 drop-shadow-lg">
                    ALGARTEMPO
                </div>
            </div>
        </div>
    );
}
