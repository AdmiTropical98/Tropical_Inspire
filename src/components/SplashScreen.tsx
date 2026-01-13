import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            setTimeout(onComplete, 500); // 0.5s fade out
        }, 1500); // reduced from 2000 to 1500 for snappier feel

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 z-[99999] bg-[#0f172a] flex items-center justify-center transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="relative flex flex-col items-center">
                {/* Logo Container */}
                <div className="relative w-32 h-32 md:w-48 md:h-48 mb-6">
                    {/* Pulsing Glow */}
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                    
                    {/* Logo Image */}
                    <img 
                        src="/logo-algar-frota.png" 
                        alt="Algar Frota" 
                        className="relative z-10 w-full h-full object-contain animate-bounce-slight"
                    />
                </div>

                {/* Fleet Animation */}
                <div className="relative w-48 h-8 overflow-hidden">
                    <div className="absolute top-0 left-0 animate-fleet-drive text-blue-500">
                        <Truck className="w-6 h-6 fill-blue-500/20" />
                    </div>
                </div>

                {/* Loading Bar (faster) */}
                <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-full animate-loading-bar-fast" />
                </div>
            </div>
        </div>
    );
}
