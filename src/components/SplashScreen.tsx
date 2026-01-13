import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [progress, setProgress] = useState(0);

    const checkConnection = async () => {
        setStatus('loading');
        setProgress(10); // Start

        // Simulate initial check delay
        setTimeout(() => {
            if (navigator.onLine) {
                // Online sequence
                setProgress(60);
                setTimeout(() => {
                    setProgress(100);
                    setTimeout(onComplete, 500); // Fade out after full
                }, 800);
            } else {
                // Offline
                setStatus('error');
            }
        }, 1000);
    };

    useEffect(() => {
        checkConnection();

        // Safety timeout to force proceed (if stuck)
        const safetyTimer = setTimeout(() => {
            if (navigator.onLine && status === 'loading') {
                onComplete();
            }
        }, 3500);

        return () => clearTimeout(safetyTimer);
    }, []);

    const handleRetry = () => {
        checkConnection();
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0f172a] flex items-center justify-center">
            <div className="flex flex-col items-center max-w-xs w-full px-8">

                {/* Logo */}
                <div className="w-48 h-48 mb-12 relative animate-fade-in">
                    <img 
                        src="/logo-algar-frota.png" 
                        alt="Algar Frota" 
                        className="w-full h-full object-contain drop-shadow-2xl"
                    />
                </div>

                {status === 'loading' ? (
                    <div className="w-full animate-fade-in">
                        {/* Progress Bar Container */}
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4 border border-slate-700">
                            {/* Animated Fill */}
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-center text-slate-500 text-xs font-medium tracking-wider uppercase animate-pulse">
                            A iniciar aplicação...
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                            <WifiOff className="w-8 h-8 text-red-500" />
                        </div>
                            <h3 className="text-white font-bold text-lg mb-2">Sem Internet</h3>
                            <p className="text-slate-400 text-center text-sm mb-6 leading-relaxed">
                                Verifique a sua conexão para continuar.
                            </p>
                            <button
                                onClick={handleRetry}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tentar Novamente
                            </button>
                        </div>
                )}

                {/* Footer Brand */}
                <div className="absolute bottom-8 text-slate-600 text-[10px] font-bold tracking-[0.2em] opacity-40">
                    ALGARTEMPO
                </div>
            </div>
        </div>
    );
}
