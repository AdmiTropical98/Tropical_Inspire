import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [needsInteraction, setNeedsInteraction] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const playVideo = async () => {
            try {
                await video.play();
            } catch (err) {
                console.log("Autoplay blocked, waiting for user interaction");
                setNeedsInteraction(true);
            }
        };

        playVideo();
    }, []);

    const handleStart = () => {
        if (videoRef.current) {
            videoRef.current.play();
            setNeedsInteraction(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={onComplete}
                playsInline
                src="/intro-video.mp4"
            />

            {needsInteraction && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <button
                        onClick={handleStart}
                        className="group flex flex-col items-center gap-6 p-8 transition-all hover:scale-105"
                    >
                        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.5)] group-hover:bg-blue-500 transition-colors">
                            <Play className="w-10 h-10 text-white fill-current ml-1" />
                        </div>
                        <span className="text-white text-lg font-black tracking-[0.3em] uppercase animate-pulse">
                            Iniciar Experiência
                        </span>
                    </button>
                </div>
            )}

            {/* Skip button always available in corner for usability */}
            {!needsInteraction && (
                <button
                    onClick={onComplete}
                    className="absolute bottom-10 right-10 z-30 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/60 hover:text-white rounded-full text-xs font-bold tracking-widest transition-all uppercase"
                >
                    Saltar Intro
                </button>
            )}
        </div>
    );
}
