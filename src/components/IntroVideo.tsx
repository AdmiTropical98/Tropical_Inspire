import { useEffect, useRef, useState } from 'react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Ensure video is muted for autoplay to work in all browsers
        video.muted = true;

        const playVideo = async () => {
            try {
                await video.play();
            } catch (err) {
                console.log("Autoplay failed even with muted", err);
            }
        };

        playVideo();
    }, []);

    const handleComplete = () => {
        setIsExiting(true);
        // Match the fade-out duration (1000ms) before calling onComplete
        setTimeout(onComplete, 1000);
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-opacity duration-1000 ease-in-out ${isExiting ? 'opacity-0' : 'opacity-100'
                }`}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleComplete}
                playsInline
                autoPlay
                muted
                src="/intro-video.mp4"
            />

            {/* Skip button available in corner */}
            <button
                onClick={handleComplete}
                className="absolute bottom-10 right-10 z-30 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/60 hover:text-white rounded-full text-xs font-bold tracking-widest transition-all uppercase"
            >
                Saltar Intro
            </button>
        </div>
    );
}
