import { useState, useEffect, useRef } from 'react';

export const useResizeObserver = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 0 });

    useEffect(() => {
        const element = containerRef.current;

        const updateDimensions = (measuredWidth: number, measuredHeight: number) => {
            let finalWidth = measuredWidth;

            // Safety check: specific scenario where grid gets squashed
            // If measured width is suspiciously small (< 500) but window is large (Desktop), 
            // this is likely a bug in the grid library or initial render timing.
            // Force a reasonable width based on window size.
            if (window.innerWidth > 1024) {
                // Desktop constraint
                if (measuredWidth < 500) {
                    // Approximate available space (Window - Sidebar ~300px - Padding ~64px)
                    finalWidth = window.innerWidth - 364;
                }
            } else if (window.innerWidth > 768) {
                // Tablet constraint
                if (measuredWidth < 300) {
                    finalWidth = window.innerWidth - 64;
                }
            }

            // Absolute minimum guard
            if (finalWidth < 300) finalWidth = 300;

            // Prevent jitter: only update if diff is significant (> 10px) or if it's the first time
            setDimensions(prev => {
                if (Math.abs(prev.width - finalWidth) > 10 || prev.height !== measuredHeight) {
                    return { width: finalWidth, height: measuredHeight };
                }
                return prev;
            });
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
            updateDimensions(window.innerWidth > 1024 ? window.innerWidth - 364 : window.innerWidth, 800);
        }

        // DOUBLE-CHECK after a delay to catch any layout shifts (e.g. Sidebar transition)
        const timer = window.setTimeout(() => {
            if (element) {
                updateDimensions(element.offsetWidth, element.offsetHeight);
            }
        }, 500);

        return () => {
            resizeObserver.disconnect();
            clearTimeout(timer);
        };
    }, []);

    return { containerRef, width: dimensions.width, height: dimensions.height };
};
