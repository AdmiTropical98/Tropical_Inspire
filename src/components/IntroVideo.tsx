import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    const startExperience = () => {
        setHasStarted(true);
        if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.play().catch(err => {
                console.error("Playback failed even with interaction:", err);
            });
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(onComplete, 1100);
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                }`}
        >
            {!hasStarted && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] animate-in fade-in duration-1000">
                    <div className="relative group cursor-pointer" onClick={startExperience}>
                        <div className="absolute inset-0 bg-blue-600/20 blur-3xl group-hover:bg-blue-600/40 transition-all duration-700" />
                        <button className="relative flex flex-col items-center gap-6 p-12 transition-all">
                            <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-xl group-hover:scale-110 group-active:scale-95 transition-all duration-500 shadow-2xl">
                                <Play className="w-10 h-10 text-white fill-white ml-1" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-white text-sm font-black tracking-[0.5em] uppercase opacity-80 group-hover:opacity-100 transition-opacity">
                                    Iniciar Experiência
                                </span>
                                <div className="h-[1px] w-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent group-hover:w-full transition-all duration-700" />
                            </div>
                        </button>
                    </div>

                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/30 blur-[120px] rounded-full" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
                    </div>
                </div>
            )}

            <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-1000 ${hasStarted ? 'opacity-100' : 'opacity-0'}`}
                onEnded={handleComplete}
                playsInline
                src="/intro-video.mp4"
            />

            {hasStarted && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                    }}
                    className={`absolute bottom-10 right-10 z-[60] px-8 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/40 hover:text-white rounded-full text-[10px] font-black tracking-widest transition-all uppercase ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
                        }`}
                >
                    Saltar
                </button>
            )}
        </div>
    );
}
