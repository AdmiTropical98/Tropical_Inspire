import { useEffect, useRef, useState } from 'react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Start fade-in after a tiny delay to ensure mounting
        const enterTimeout = setTimeout(() => setIsEntering(false), 50);

        const playVideo = async () => {
            try {
                // Try to play with sound first
                await video.play();
            } catch (err) {
                console.log("Unmuted autoplay blocked, retrying muted...");
                // Fallback to muted autoplay which is always allowed
                video.muted = true;
                try {
                    await video.play();
                } catch (mutedErr) {
                    console.error("Muted autoplay also failed", mutedErr);
                }
            }
        };

        playVideo();

        return () => clearTimeout(enterTimeout);
    }, []);

    const handleComplete = () => {
        setIsExiting(true);
        // Match the fade-out duration (1000ms)
        setTimeout(onComplete, 1000);
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isEntering || isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
                }`}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleComplete}
                playsInline
                autoPlay
                src="/intro-video.mp4"
            />

            {/* Skip button available in corner */}
            <button
                onClick={handleComplete}
                className={`absolute bottom-10 right-10 z-30 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/60 hover:text-white rounded-full text-xs font-bold tracking-widest transition-all uppercase ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
                    }`}
            >
                Saltar Intro
            </button>
        </div>
    );
}
