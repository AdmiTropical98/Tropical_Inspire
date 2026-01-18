import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { Layout } from 'react-grid-layout';

interface ZoneLayouts {
    lg: Layout[];
    md: Layout[];
    sm: Layout[];
    [key: string]: Layout[];
}

interface LayoutContextType {
    isEditMode: boolean;
    toggleEditMode: () => void;
    cancelEditMode: () => void;
    saveChanges: () => Promise<void>;
    getGridLayout: (zoneId: string) => ZoneLayouts | null;
    saveGridLayout: (zoneId: string, layouts: ZoneLayouts) => void;
    hasUnsavedChanges: boolean;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { currentUser } = useAuth();
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Main state: Stores the CURRENT layout configuration for all zones
    const [layouts, setLayouts] = useState<Record<string, ZoneLayouts>>({});

    // Backup state: Stores the layout configuration BEFORE editing started (for Cancel)
    const [originalLayouts, setOriginalLayouts] = useState<Record<string, ZoneLayouts>>({});

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Load from Supabase on mount
    useEffect(() => {
        if (!currentUser) return;
        
        const loadLayouts = async () => {
            const { data, error } = await supabase
                .from('user_layouts')
                .select('layout_data')
                .eq('user_id', currentUser.id)
                .maybeSingle();
            
            if (data && data.layout_data) {
                setLayouts(data.layout_data);
            } else if (error && error.code !== 'PGRST116') {
                console.error("Error loading layout:", error);
            }
        };
        
        loadLayouts();
    }, [currentUser]);

    // Start Editing: Snapshot current state
    const toggleEditMode = () => {
        if (!isEditMode) {
            // Entering edit mode: Create backup
            setOriginalLayouts(JSON.parse(JSON.stringify(layouts)));
            setIsEditMode(true);
        } else {
            // Exiting without saving explicitly usually implies saving in many apps, 
            // but here we will force user to click "Save" or "Cancel".
            // If they just toggle off, we assume Save for backward compatibility, 
            // OR we can change this behavior. 
            // For now, let's keep it simple: Toggle = Enter Edit Mode.
            // We'll expose explicit Save/Cancel methods.
        }
    };

    const cancelEditMode = () => {
        // Restore backup
        setLayouts(JSON.parse(JSON.stringify(originalLayouts)));
        setIsEditMode(false);
        setHasUnsavedChanges(false);
    };

    const saveChanges = async () => {
        if (!currentUser) return;
        setIsEditMode(false);
        setHasUnsavedChanges(false);

        const { error } = await supabase
            .from('user_layouts')
            .upsert({
                user_id: currentUser.id,
                layout_data: layouts,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Error saving layout:", error);
            // Revert UI if save failed? Or just alert?
            alert("Erro ao salvar layout na nuvem.");
        }
    };

    const getGridLayout = (zoneId: string) => {
        return layouts[zoneId] || null;
    };

    const saveGridLayout = (zoneId: string, newLayouts: ZoneLayouts) => {
        setLayouts(prev => {
            const next = { ...prev, [zoneId]: newLayouts };
            // Simple dirty check could be here
            return next;
        });
        setHasUnsavedChanges(true);
    };

    return (
        <LayoutContext.Provider value={{
            isEditMode,
            toggleEditMode,
            cancelEditMode,
            saveChanges,
            getGridLayout,
            saveGridLayout,
            hasUnsavedChanges
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
