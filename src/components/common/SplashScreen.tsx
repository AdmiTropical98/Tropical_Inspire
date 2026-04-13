export default function SplashScreen({ onComplete: _onComplete, message }: { onComplete?: () => void; message?: string }) {
    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none">
            {/* Background — matches Login gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(147,197,253,0.24),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(191,219,254,0.34),_transparent_30%),linear-gradient(135deg,_#edf4ff_0%,_#fafcff_55%,_#edf4ff_100%)]" />

            {/* GPS grid overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-25"
                style={{
                    backgroundImage: 'url(/grid-pattern.svg)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center 6%',
                    backgroundSize: '40rem auto',
                }}
            />

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
            <div className="relative z-10 flex flex-col items-center gap-6 px-8 animate-in fade-in duration-500">
                {/* Logo */}
                <img
                    src="/LOGO.png"
                    alt="Algartempo Frota"
                    className="h-14 w-auto md:h-[72px] drop-shadow-[0_4px_16px_rgba(17,24,39,0.18)] object-contain"
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
                <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0s]" />
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.18s]" />
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.36s]" />
                </div>
            </div>
        </div>
    );
}
