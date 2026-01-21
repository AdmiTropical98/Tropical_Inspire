import React, { useMemo } from 'react';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import { useLayout } from '../../contexts/LayoutContext';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface DraggableGridProps {
    children: React.ReactNode;
    zoneId: string;
    className?: string;
    // Default layouts for when no user config exists
    defaultLayouts?: { lg: any[]; md: any[]; sm: any[] };
}

export default function DraggableGrid({ children, zoneId, className, defaultLayouts }: DraggableGridProps) {
    const { isEditMode, getGridLayout, saveGridLayout } = useLayout();
    const { containerRef, width } = useResizeObserver();

    // Get current layouts from context or defaults
    const layoutsFromContext = getGridLayout(zoneId);

    // We use a memoized initialLayouts to prevent infinite loops if getGridLayout returns a new object every time
    // We use a memoized initialLayouts with validation
    const layouts = useMemo(() => {
        // Start with defaults to ensure we have a fallback
        const finalLayouts: any = {
            lg: [], md: [], sm: [],
            ...(defaultLayouts || {})
        };

        if (layoutsFromContext) {
            // Merge valid layouts from context
            Object.entries(layoutsFromContext).forEach(([bp, bpLayout]: [string, any]) => {
                if (!Array.isArray(bpLayout) || bpLayout.length === 0) return;

                // CRITICAL VALIDATION: Detect "squashed" layouts (everything at x=0)
                if (bpLayout.length > 1) {
                    const allXZero = bpLayout.every((item: any) => item.x === 0);

                    if (allXZero) {
                        // Check if default layout for this breakpoint has items with x > 0
                        // If default has horizontal spread, then the x=0 state is likely corruption.
                        const defaults = defaultLayouts?.[bp as keyof typeof defaultLayouts];
                        if (defaults && Array.isArray(defaults) && defaults.some((d: any) => d.x > 0)) {
                            // CORRUPTION DETECTED: Skip this breakpont layout, use default
                            console.warn(`[DraggableGrid] Detected corrupt layout for ${bp} (all x=0). Reverting to default.`);
                            return;
                        }

                        // Fallback: If no defaults to compare, specific check for Desktop
                        // A vertical stack of >1 items on Desktop is highly suspicious for a dashboard
                        if ((bp === 'lg' || bp === 'md') && width > 768) {
                            console.warn(`[DraggableGrid] Detected suspicious vertical stack on Desktop for ${bp}. Reverting to default.`);
                            return;
                        }
                    }
                }

                // Standard check: Must have logical width
                if (!bpLayout.every((item: any) => item.w > 0)) return;

                // If valid, override default
                finalLayouts[bp] = bpLayout;
            });
        }

        return finalLayouts;
    }, [layoutsFromContext, defaultLayouts, width]);

    const handleLayoutChange = (_: any, allLayouts: any) => {
        // Prevent saving if we shouldn't be editing, OR if the layout looks corrupted (width 0 safety)
        if (!isEditMode) return;

        // Safety: Don't save if width is suspiciously small (prevents overwriting with squashed layout)
        if (width < 300) return;

        saveGridLayout(zoneId, allLayouts);
    };

    // Filter children to ensure they have valid keys
    const validChildren = React.Children.toArray(children).filter((child: any) => !!child.key);

    // SAFETY: Do not render grid until we have a realistic width. 
    // Rendering with width=0 causes RGL to auto-squash everything to x=0, which then triggers onLayoutChange and saves the corruption.
    if (!width || width < 100) {
        return <div ref={containerRef} className={`${className} w-full min-h-[100px] animate-pulse bg-slate-800/20 rounded-xl`} />;
    }

    return (
        <div ref={containerRef} className={`${className} w-full`} style={{ width: '100%', minHeight: '100px' }}>
            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={60}
                width={width}
                // @ts-ignore
                isDraggable={isEditMode}
                // @ts-ignore
                isResizable={isEditMode}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                draggableHandle=".drag-handle"
                onLayoutChange={handleLayoutChange}
                useCSSTransforms={true}
            >
                {validChildren.map((child: any) => (
                    <div key={child.key} className={isEditMode ? "relative group border border-dashed border-slate-600/50 rounded-xl transition-all bg-slate-800/20" : ""}>
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
            </ResponsiveGridLayout>
        </div>
    );
}
