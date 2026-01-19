import { useEffect, useRef, useState } from 'react';

export default function IntroVideo({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Try playing unmuted, browsers will block if no interaction
        video.muted = false;

        const playVideo = async () => {
            try {
                await video.play();
            } catch (err) {
                console.warn("Unmuted autoplay blocked, falling back to muted for cinematic flow...");
                video.muted = true;
                try {
                    await video.play();
                } catch (mutedErr) {
                    console.error("Autoplay failed completely", mutedErr);
                }
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
                } pointer-events-none`}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleComplete}
                playsInline
                autoPlay
                src="/intro-video.mp4"
            />
        </div>
    );
}
