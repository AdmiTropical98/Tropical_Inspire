import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showMuteIndicator, setShowMuteIndicator] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const playVideo = async () => {
            try {
                // Try to play unmuted first
                video.muted = false;
                await video.play();
                setIsMuted(false);
            } catch (err) {
                console.log("Unmuted autoplay blocked, falling back to muted...");
                video.muted = true;
                setIsMuted(true);
                setShowMuteIndicator(true);
                try {
                    await video.play();
                } catch (mutedErr) {
                    console.error("Muted autoplay also failed", mutedErr);
                }
            }
        };

        playVideo();

        // Global click listener to unmute if needed
        const handleGlobalClick = () => {
            if (video && video.muted) {
                video.muted = false;
                setIsMuted(false);
                setShowMuteIndicator(false);
            }
        };

        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const handleComplete = () => {
        setIsExiting(true);
        // Use a slightly longer timeout than the CSS transition to ensure clean cleanup
        setTimeout(onComplete, 1100);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMuted = !videoRef.current.muted;
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
            if (!newMuted) setShowMuteIndicator(false);
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                } ${isExiting ? 'pointer-events-none' : ''}`}
            onClick={() => {
                if (videoRef.current?.muted) {
                    videoRef.current.muted = false;
                    setIsMuted(false);
                    setShowMuteIndicator(false);
                }
            }}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleComplete}
                playsInline
                autoPlay
                src="/intro-video.mp4"
            />

            {/* Mute/Unmute Indicator if video is muted by browser policy */}
            {showMuteIndicator && (
                <div className="absolute top-10 right-10 z-30 flex items-center gap-3 animate-bounce">
                    <button
                        onClick={toggleMute}
                        className="p-3 bg-blue-600/80 hover:bg-blue-500 backdrop-blur-md rounded-full text-white shadow-lg transition-all"
                        title={isMuted ? "Ativar Som" : "Mudar para Silêncio"}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                        Clique para ativar som
                    </span>
                </div>
            )}

            {/* Skip button available in corner */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleComplete();
                }}
                className={`absolute bottom-10 right-10 z-30 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/60 hover:text-white rounded-full text-xs font-bold tracking-widest transition-all uppercase ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
                    }`}
            >
                Saltar Intro
            </button>
        </div>
    );
}
