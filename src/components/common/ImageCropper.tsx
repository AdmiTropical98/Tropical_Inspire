import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ZoomIn, ZoomOut, Move, RotateCcw, RotateCw } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    onCancel: () => void;
    onCropComplete: (croppedBase64: string) => void;
}

export default function ImageCropper({ imageSrc, onCancel, onCropComplete }: ImageCropperProps) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [baseScale, setBaseScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [rotation, setRotation] = useState(0);
    const imageRef = useRef<HTMLImageElement>(null);

    // Reset pan when zoom changes to keep image somewhat centered if desired, 
    // or just let user adjust. We'll keep pan as is for better UX during zoom.

    // Use Refs so event listeners always access fresh data without re-binding
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if ('button' in e && e.button !== 0) return;
        e.preventDefault(); // Stop native drag/selection

        isDraggingRef.current = true;
        setIsDragging(true); // Trigger render for UI state if needed

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        // Calculate the anchor point relative to current pan
        dragStartRef.current = {
            x: clientX - pan.x,
            y: clientY - pan.y
        };
    };

    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            e.preventDefault(); // Stop scrolling on touch

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            // Update state (triggers render)
            setPan({
                x: clientX - dragStartRef.current.x,
                y: clientY - dragStartRef.current.y
            });
        };

        const handleGlobalUp = () => {
            isDraggingRef.current = false;
            setIsDragging(false);
        };

        // Attach listeners once
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('touchend', handleGlobalUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalUp);
        };
    }, []);

    const handleSave = () => {
        const image = imageRef.current;
        const container = containerRef.current;
        if (!image || !container) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Output size matches 7:9 aspect ratio
        const outWidth = 700;
        const outHeight = 900;
        canvas.width = outWidth;
        canvas.height = outHeight;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, outWidth, outHeight);

        // Center point of the canvas
        const centerX = outWidth / 2;
        const centerY = outHeight / 2;

        // Scale ratio between displayed crop area and output canvas
        const outputScale = outWidth / container.clientWidth;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom * baseScale * outputScale, zoom * baseScale * outputScale);

        const imgCenterX = image.naturalWidth / 2;
        const imgCenterY = image.naturalHeight / 2;

        ctx.drawImage(
            image,
            -imgCenterX + (pan.x / (zoom * baseScale)),
            -imgCenterY + (pan.y / (zoom * baseScale))
        );

        ctx.restore();
        onCropComplete(canvas.toDataURL('image/jpeg', 0.9));
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md pb-safe">
            <div className="w-full max-w-md mx-auto h-full flex flex-col pt-safe">
                {/* Header */}
                <div className="flex items-center justify-between p-4 mb-4">
                    <h3 className="text-white font-semibold text-lg">Ajustar Fatura</h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden gap-6 pb-6">
                    <div 
                        ref={containerRef}
                        className={`relative w-full max-w-[340px] aspect-[7/9] bg-slate-950 rounded-lg overflow-hidden border-2 border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.2)] touch-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                    >
                        {/* Image Layer */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * baseScale}) rotate(${rotation}deg)`,
                                transformOrigin: 'center',
                                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                            }}
                        >
                            <img
                                ref={imageRef}
                                src={imageSrc}
                                alt="Crop Preview"
                                className="max-w-none max-h-none select-none"
                                draggable={false} // Native drag off
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    const containerSize = containerRef.current?.clientWidth || 280;
                                    const scale = containerSize / Math.min(img.naturalWidth, img.naturalHeight);
                                    setBaseScale(scale);
                                }}
                            />
                        </div>

                        {/* Guide Overlay */}
                        <div className="absolute inset-0 border border-white/20 pointer-events-none rounded-lg"></div>
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-[280px] space-y-4">
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setRotation((prev) => prev - 90)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Rodar
                            </button>
                            <button
                                type="button"
                                onClick={() => setRotation((prev) => prev + 90)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
                            >
                                <RotateCw className="w-4 h-4" />
                                Rodar
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <ZoomOut className="w-5 h-5 text-slate-500" />
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.1"
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <ZoomIn className="w-5 h-5 text-slate-500" />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        <Check className="w-5 h-5" />
                        Guardar Foto
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
