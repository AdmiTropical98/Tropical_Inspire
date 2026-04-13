export default function SplashScreen({
    onComplete: _onComplete,
    message,
    exiting = false,
}: {
    onComplete?: () => void;
    message?: string;
    exiting?: boolean;
}) {
    return (
        <div
            className={`fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none transition-opacity duration-400 ${
                exiting ? 'opacity-0' : 'opacity-100'
            }`}
        >
            {/* Background — soft blue map look */}
            <div
                className="absolute inset-0 animate-in fade-in duration-500"
                style={{
                    backgroundImage:
                        "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(246,250,255,0.86) 36%, rgba(219,233,255,0.82) 68%, rgba(186,210,252,0.88) 100%), radial-gradient(95% 75% at 50% 100%, rgba(126,165,235,0.42) 0%, rgba(126,165,235,0) 65%), radial-gradient(65% 55% at 10% 80%, rgba(173,204,255,0.36) 0%, rgba(173,204,255,0) 72%), radial-gradient(55% 45% at 85% 90%, rgba(173,204,255,0.34) 0%, rgba(173,204,255,0) 74%), url('/grid-pattern.svg')",
                    backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, cover',
                    backgroundPosition: 'center, center, center, center, center',
                    backgroundRepeat: 'no-repeat',
                }}
            />

            {/* GPS grid overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/35 via-transparent to-blue-200/25" />

            {/* Decorative lines (same as Login) */}
            <div className="absolute left-[-8%] top-[18%] h-px w-[52%] rotate-[-16deg] bg-gradient-to-r from-transparent via-blue-200/80 to-transparent opacity-70" />
            <div className="absolute left-[2%] top-[38%] h-px w-[46%] rotate-[8deg] bg-gradient-to-r from-transparent via-blue-100/90 to-transparent opacity-80" />
            <div className="absolute right-[4%] top-[28%] h-px w-[24%] rotate-[28deg] bg-gradient-to-r from-transparent via-slate-200/80 to-transparent opacity-60 hidden lg:block" />

            {/* Bottom glow */}
            <div
                className="absolute inset-x-[-10%] bottom-[-2%] h-[28vh] opacity-90 pointer-events-none"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(219,234,254,0.18) 35%, rgba(191,219,254,0.32) 100%)',
                    clipPath: 'ellipse(72% 58% at 50% 100%)',
                }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-7 px-6 text-center">
                {/* Logo */}
                <img
                    src="/LOGO.png"
                    alt="Algartempo Frota"
                    className="w-[340px] sm:w-[430px] md:w-[560px] h-auto object-contain [transform:scale(1.18)] drop-shadow-[0_14px_26px_rgba(17,24,39,0.20)] [animation:logoFadeIn_0.6s_ease_forwards]"
                />

                {/* Title + subtitle */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">
                        Sistema interno de gestão de transportes
                    </p>
                    {message && (
                        <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">
                            {message}
                        </p>
                    )}
                </div>

                {/* Three-dot loading indicator */}
                                <div className="flex items-center gap-2 mt-1 [animation:logoFadeIn_0.8s_ease_forwards]">
                                        <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-bounce [animation-delay:0s]" />
                                        <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-bounce [animation-delay:0.18s]" />
                                        <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-bounce [animation-delay:0.36s]" />
                </div>
            </div>

                        <style>{`
                            @keyframes logoFadeIn {
                                from {
                                    opacity: 0;
                                    transform: scale(0.96);
                                }
                                to {
                                    opacity: 1;
                                    transform: scale(1);
                                }
                            }
                        `}</style>
        </div>
    );
}
