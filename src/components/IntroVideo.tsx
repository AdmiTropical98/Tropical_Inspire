import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const playVideo = async () => {
            try {
                // Try playing unmuted first
                video.muted = false;
                await video.play();
                setIsMuted(false);
                setIsBlocked(false);
            } catch (err) {
                console.warn("Unmuted autoplay blocked, falling back to muted...");
                // Browser blocked unmuted autoplay. 
                // We MUST mute it to at least get the video moving.
                video.muted = true;
                setIsMuted(true);
                setIsBlocked(true);

                try {
                    await video.play();
                } catch (mutedErr) {
                    console.error("Even muted autoplay failed. This usually means no user interaction has occurred at all.", mutedErr);
                }
            }
        };

        playVideo();
    }, []);

    const handleUnmute = () => {
        if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            setIsBlocked(false);
            // Ensure it's playing
            videoRef.current.play().catch(e => console.error("Error playing after unmute:", e));
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(onComplete, 1100);
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                } ${isExiting ? 'pointer-events-none' : ''}`}
            onClick={isBlocked ? handleUnmute : undefined}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleComplete}
                playsInline
                autoPlay
                src="/intro-video.mp4"
            />

            {/* Subtle overlay if sound is blocked */}
            {isBlocked && !isExiting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer animate-in fade-in duration-700">
                    <button
                        onClick={handleUnmute}
                        className="group flex flex-col items-center gap-4 p-8 transition-transform hover:scale-105"
                    >
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] group-hover:bg-blue-500 transition-colors">
                            <Volume2 className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-white text-xs font-black tracking-[0.3em] uppercase animate-pulse">
                            Clique para som
                        </span>
                    </button>
                </div>
            )}

            {/* Skip button available in corner */}
            {!isExiting && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                    }}
                    className="absolute bottom-10 right-10 z-30 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/40 hover:text-white rounded-full text-[10px] font-bold tracking-widest transition-all uppercase"
                >
                    Saltar Intro
                </button>
            )}
        </div>
    );
}
