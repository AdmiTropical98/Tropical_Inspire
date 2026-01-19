import { useEffect, useRef, useState } from 'react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Force sound
        video.muted = false;

        const playVideo = async () => {
            try {
                await video.play();
            } catch (err) {
                console.error("Autoplay with sound failed. Browser might requires interaction.", err);
            }
        };

        playVideo();
    }, []);

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(onComplete, 1100);
    };

    return (
        <div
            className={`fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                } ${isExiting ? 'pointer-events-none' : ''}`}
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
