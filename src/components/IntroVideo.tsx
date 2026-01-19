import { useRef, useState, useEffect } from 'react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const startPlayback = async () => {
            try {
                // Since this happens after a login click, unmuted should work
                video.muted = false;
                await video.play();
                setIsLoaded(true);
            } catch (err) {
                console.warn("Unmuted playback failed, attempting muted fallback...", err);
                video.muted = true;
                try {
                    await video.play();
                    setIsLoaded(true);
                } catch (mutedErr) {
                    console.error("Video playback completely failed", mutedErr);
                    onComplete(); // Skip if it can't play at all
                }
            }
        };

        startPlayback();
    }, [onComplete]);

    const handleComplete = () => {
        setIsExiting(true);
        // Fade out duration
        setTimeout(onComplete, 1200);
    };

    return (
        <div
            className={`fixed inset-0 z-[999999] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isExiting ? 'opacity-0' : 'opacity-100'
                }`}
        >
            {/* Background cinematic glow */}
            <div className={`absolute inset-0 bg-blue-600/5 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

            <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-all duration-1000 scale-100 ${isLoaded ? 'opacity-100' : 'opacity-0'
                    } ${isExiting ? 'scale-110' : 'scale-100'}`}
                onEnded={handleComplete}
                playsInline
                src="/intro-video.mp4"
            />

            {/* Subtle Overlay gradients */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/40" />

            <button
                onClick={handleComplete}
                className="absolute bottom-12 right-12 z-[1000] px-6 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/30 hover:text-white rounded-full text-[10px] font-black tracking-[0.3em] transition-all uppercase"
            >
                Saltar
            </button>
        </div>
    );
}
