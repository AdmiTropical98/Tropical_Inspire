import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

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
    const imageRef = useRef<HTMLImageElement>(null);

    // Reset pan when zoom changes to keep image somewhat centered if desired, 
    // or just let user adjust. We'll keep pan as is for better UX during zoom.

    // Use Refs so event listeners always access fresh data without re-binding
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

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
        if (!image) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Output size
        const size = 400;
        canvas.width = size;
        canvas.height = size;

        // Calculate crop
        // The container is fixed size (e.g. 280px). 
        // Logic: 
        // 1. We have an image magnified by 'zoom'
        // 2. We have a translation 'pan.x, pan.y' from center
        // 3. We want to draw what's in the circle to the canvas

        // Clear background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        // Center point of the canvas
        const center = size / 2;

        // Scale ratio between displayed crop area (280px) and output canvas (400px)
        // If we see 280px on screen, that maps to 400px on canvas.
        const outputScale = size / 280;

        // We need to apply the same transformations to the canvas context
        ctx.translate(center, center);
        // Combine zoom (user input) with baseScale (fit to container) and outputScale (container to canvas)
        const totalScale = zoom * baseScale * outputScale;
        ctx.scale(totalScale, totalScale);

        // Pan is in screen pixels (relative to 280px container)
        // We need to move the canvas context opposite to pan. 
        // But since we scaled the context, the translation must be adjusted.
        // Actually, easiest way: 
        // 1. Move context origin to center (done)
        // 2. Move context by PAN amount (scaled to output)
        //    Pan x=10 means we shifted image RIGHT by 10px on screen.
        //    So we should shift drawing LEFT by 10px on screen? No, the pan transforms the IMAGE.
        //    Image is at `translate(pan.x, pan.y)`.

        // Correct transform order for canvas to match CSS:
        // CSS: translate(pan) scale(zoom)
        // Canvas equivalent: translate(pan * outputScale) scale(zoom)? 

        // Simpler mental model:
        // We want to draw the image at the correct offset and scale relative to center.
        // pan.x is in pixels relative to the 280px container.
        // corresponding pixels in 400px canvas = pan.x * outputScale.

        ctx.translate((pan.x * outputScale) / totalScale * totalScale, (pan.y * outputScale) / totalScale * totalScale);
        // Simplified: ctx.translate(pan.x * outputScale, pan.y * outputScale);
        // WAIT. If we scale first, we translate in scaled units.

        // Let's reset and do standard order:
        // 1. Translate to center (200, 200)
        // 2. Translate by Pan (converted to output pixels)
        // 3. Scale

        // Reset Xform just to be safe (though local context)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        ctx.translate(center + pan.x * outputScale, center + pan.y * outputScale);
        ctx.scale(totalScale, totalScale);

        // Draw image centered
        // We draw the image such that its center is at (0,0) of the context
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

        onCropComplete(canvas.toDataURL('image/jpeg', 0.9));
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Move className="w-5 h-5 text-blue-400" />
                        Ajustar Foto
                    </h3>
                    <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center gap-6">
                    <p className="text-sm text-slate-400 text-center">
                        Arraste para posicionar e use a barra para fazer zoom.
                    </p>

                    {/* Crop Area Container */}
                    <div className={`relative w-[280px] h-[280px] bg-slate-950 rounded-full overflow-hidden border-4 border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.2)] touch-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                    >
                        {/* Image Layer */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * baseScale})`,
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
                                    const containerSize = 280;
                                    const scale = containerSize / Math.min(img.naturalWidth, img.naturalHeight);
                                    setBaseScale(scale);
                                }}
                            />
                        </div>

                        {/* Guide Overlay */}
                        <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"></div>
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-[280px] space-y-4">
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
