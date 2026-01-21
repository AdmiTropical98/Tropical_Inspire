import React, { useEffect, useRef, useState } from 'react';
import { Responsive } from 'react-grid-layout';

interface DraggableGridProps {
  children: React.ReactNode;
  zoneId: string;
  className?: string;
  defaultLayouts: {
    lg: any[];
    md: any[];
    sm: any[];
  };
}

export default function DraggableGrid({
  children,
  defaultLayouts,
}: DraggableGridProps) {
  const layouts = defaultLayouts;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial measure
    if (containerRef.current.offsetWidth > 0) {
      setWidth(containerRef.current.offsetWidth);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Responsive
        width={width}
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 10, sm: 6 }}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {React.Children.map(children, (child, index) => (
          <div key={layouts.lg[index]?.i ?? index.toString()}>
            {child}
          </div>
        ))}
      </Responsive>
    </div>
  );
}
