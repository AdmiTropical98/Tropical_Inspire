import { useState, useEffect, useRef } from 'react';

export const useResizeObserver = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 0 }); // Default to non-zero width to prevent initial squash

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Use contentRect for precise content box measurement
                const { width, height } = entry.contentRect;
                // Only update if width > 0 to avoid zero-width layout collapse during transitions
                if (width > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        resizeObserver.observe(element);

        // Immediate measurement fallback
        if (element.offsetWidth > 0) {
            setDimensions({
                width: element.offsetWidth,
                height: element.offsetHeight
            });
        }

        return () => resizeObserver.disconnect();
    }, []);

    return { containerRef, width: dimensions.width, height: dimensions.height };
};
