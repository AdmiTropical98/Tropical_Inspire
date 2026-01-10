import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface LayoutItemConfig {
    id: string;
    width: 'full' | 'half' | 'third' | 'quarter';
    hidden: boolean;
    order: number;
}

interface LayoutContextType {
    isEditMode: boolean;
    toggleEditMode: () => void;
    getLayout: (zoneId: string, defaultItems: any[]) => any[];
    updateLayoutOrder: (zoneId: string, newOrder: any[]) => void;
    toggleItemWidth: (zoneId: string, itemId: string) => void;
    toggleItemVisibility: (zoneId: string, itemId: string) => void;
    resetLayout: (zoneId: string) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { currentUser } = useAuth();
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Store layouts as: { [zoneId]: { [itemId]: { width, hidden, order } } }
    // Or simpler: { [zoneId]: Metadata[] }
    // Map: zoneId -> ItemConfig[]
    const [layouts, setLayouts] = useState<Record<string, LayoutItemConfig[]>>({});

    // Load from Supabase on mount
    useEffect(() => {
        if (!currentUser) return;
        
        const loadLayouts = async () => {
            const { data, error } = await supabase
                .from('user_layouts')
                .select('layout_data')
                .eq('user_id', currentUser.id)
                .single();
            
            if (data && data.layout_data) {
                setLayouts(data.layout_data);
            } else if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error("Error loading layout:", error);
            } else {
                 setLayouts({});
            }
        };
        
        loadLayouts();
    }, [currentUser]);

    // Save to Supabase on change (debounced)
    useEffect(() => {
        if (!currentUser) return;
        
        const timer = setTimeout(async () => {
             const { error } = await supabase
                .from('user_layouts')
                .upsert({ 
                    user_id: currentUser.id, 
                    layout_data: layouts,
                    updated_at: new Date().toISOString()
                });
                
            if (error) console.error("Error saving layout:", error);
        }, 1000);
        
        return () => clearTimeout(timer);
    }, [layouts, currentUser]);

    const toggleEditMode = () => setIsEditMode(prev => !prev);

    const getLayout = (zoneId: string, defaultItems: any[]) => {
        const zoneConfig = layouts[zoneId];
        if (!zoneConfig) return defaultItems;

        // Merge config with default items
        // 1. Sort based on config order
        // 2. Apply width/visibility properties
        // 3. Add any new default items that aren't in config yet at the end
        
        const configuredItems = zoneConfig
            .map(conf => {
                const item = defaultItems.find(i => i.id === conf.id);
                if (item) {
                    return { ...item, layoutConfig: conf };
                }
                return null;
            })
            .filter(Boolean);
            
        // Find items not in config
        const unconfiguredItems = defaultItems.filter(i => !zoneConfig.find(c => c.id === i.id));
        
        return [...configuredItems, ...unconfiguredItems];
    };

    const updateLayoutOrder = (zoneId: string, newItems: any[]) => {
        const currentZoneConfig = layouts[zoneId] || [];
        
        // Create new config array based on newItems order
        const newConfig = newItems.map((item, index) => {
            const existingConfig = currentZoneConfig.find(c => c.id === item.id);
            return {
                id: item.id,
                width: existingConfig?.width || 'full', // Default to full
                hidden: existingConfig?.hidden || false,
                order: index
            };
        });

        setLayouts(prev => ({ ...prev, [zoneId]: newConfig }));
    };

    const toggleItemWidth = (zoneId: string, itemId: string) => {
        setLayouts(prev => {
            const zone = prev[zoneId] || [];
            const itemIndex = zone.findIndex(i => i.id === itemId);
            let newZone = [...zone];
            
            if (itemIndex === -1) {
                // Config doesn't exist yet, create it. Next after 'full' is 'half'.
                newZone.push({ id: itemId, width: 'half', hidden: false, order: zone.length });
            } else {
                // Cycle widths: full -> half -> third -> quarter -> full
                const currentWidth = newZone[itemIndex].width;
                let nextWidth: 'full' | 'half' | 'third' | 'quarter' = 'full';
                
                switch (currentWidth) {
                    case 'full': nextWidth = 'half'; break;
                    case 'half': nextWidth = 'third'; break;
                    case 'third': nextWidth = 'quarter'; break;
                    case 'quarter': nextWidth = 'full'; break;
                    default: nextWidth = 'full';
                }
                
                newZone[itemIndex] = { ...newZone[itemIndex], width: nextWidth };
            }
            
            return { ...prev, [zoneId]: newZone };
        });
    };

    const toggleItemVisibility = (zoneId: string, itemId: string) => {
         setLayouts(prev => {
            const zone = prev[zoneId] || [];
            const itemIndex = zone.findIndex(i => i.id === itemId);
            let newZone = [...zone];
            
            if (itemIndex === -1) {
                newZone.push({ id: itemId, width: 'full', hidden: true, order: zone.length });
            } else {
                newZone[itemIndex] = { ...newZone[itemIndex], hidden: !newZone[itemIndex].hidden };
            }
            
            return { ...prev, [zoneId]: newZone };
        });
    };
    
    const resetLayout = (zoneId: string) => {
        setLayouts(prev => {
            const newLayouts = { ...prev };
            delete newLayouts[zoneId];
            return newLayouts;
        });
    };

    return (
        <LayoutContext.Provider value={{
            isEditMode,
            toggleEditMode,
            getLayout,
            updateLayoutOrder,
            toggleItemWidth,
            toggleItemVisibility,
            resetLayout
        }}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
}
