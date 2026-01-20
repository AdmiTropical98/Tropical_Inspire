import { useState, useEffect, useRef } from 'react';

export const useResizeObserver = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 0 });

    useEffect(() => {
        const element = containerRef.current;

        const updateDimensions = (measuredWidth: number, measuredHeight: number) => {
            let finalWidth = measuredWidth;

            // Safety check: specific scenario where grid gets squashed
            // If measured width is very small (< 200) but window is large, this is a bug.
            // Force a reasonable width based on window size.
            if (measuredWidth < 200 && window.innerWidth > 768) {
                // Approximate available space (Window - Sidebar ~280px - Padding)
                finalWidth = window.innerWidth - 320;
            }

            // Absolute minimum guard
            if (finalWidth < 300) finalWidth = 300;

            setDimensions({ width: finalWidth, height: measuredHeight });
        };

        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0) {
                    updateDimensions(width, height);
                }
            }
        });

        resizeObserver.observe(element);

        // Immediate fallback check
        if (element.offsetWidth > 0) {
            updateDimensions(element.offsetWidth, element.offsetHeight);
        } else {
            // Fallback if element is hidden/zero init
            updateDimensions(1200, 800);
        }

        return () => resizeObserver.disconnect();
    }, []);

    return { containerRef, width: dimensions.width, height: dimensions.height };
};
