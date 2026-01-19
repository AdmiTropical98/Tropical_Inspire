import React, { useMemo } from 'react';
import { GridLayout, useContainerWidth, useResponsiveLayout } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useLayout } from '../../contexts/LayoutContext';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface DraggableGridProps {
    children: React.ReactNode;
    zoneId: string;
    className?: string;
    // Default layouts for when no user config exists
    defaultLayouts?: { lg: Layout[]; md: Layout[]; sm: Layout[] };
}

export default function DraggableGrid({ children, zoneId, className, defaultLayouts }: DraggableGridProps) {
    const { isEditMode, getGridLayout, saveGridLayout } = useLayout();
    const { width, containerRef, mounted } = useContainerWidth();

    // Get current layouts from context or defaults
    const layoutsFromContext = getGridLayout(zoneId);

    // We use a memoized initialLayouts to prevent infinite loops if getGridLayout returns a new object every time
    const initialLayouts = useMemo(() => {
        return layoutsFromContext || defaultLayouts || { lg: [], md: [], sm: [] };
    }, [layoutsFromContext, defaultLayouts]);

    const { layout, cols } = useResponsiveLayout({
        width,
        layouts: initialLayouts as any,
        onLayoutChange: (_, allLayouts) => {
            if (!isEditMode) return;
            saveGridLayout(zoneId, allLayouts as any);
        },
        breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
        cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
    });

    if (!mounted) {
        return <div ref={containerRef} className={className}>{children}</div>;
    }

    // Filter children to ensure they have valid keys
    const validChildren = React.Children.toArray(children).filter((child: any) => !!child.key);

    return (
        <div ref={containerRef} className={className}>
            <GridLayout
                width={width}
                cols={cols}
                layout={layout}
                rowHeight={60}
                isDraggable={isEditMode}
                isResizable={isEditMode}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                draggableHandle=".drag-handle"
            >
                {validChildren.map((child: any) => (
                    <div key={child.key} className={isEditMode ? "relative group border border-dashed border-slate-600/50 rounded-xl transition-all" : ""}>
                        {/* Drag Handle Overlay in Edit Mode */}
                        {isEditMode && (
                            <div className="absolute top-2 left-2 z-50 cursor-move drag-handle bg-slate-800 p-1.5 rounded-md shadow-lg border border-slate-700 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="19 9 22 12 19 15"></polyline><polyline points="9 19 12 22 15 19"></polyline><circle cx="12" cy="12" r="1"></circle></svg>
                            </div>
                        )}
                        <div className="h-full w-full overflow-hidden">
                            {child}
                        </div>
                    </div>
                ))}
            </GridLayout>
        </div>
    );
}
