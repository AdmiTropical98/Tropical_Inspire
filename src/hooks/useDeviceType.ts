import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function useDeviceType() {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');

    useEffect(() => {
        const checkDeviceType = () => {
            const width = window.innerWidth;
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const isNative = Capacitor.isNativePlatform();
            
            // Allow explicit override via URL parameter or local storage for testing
            const override = new URLSearchParams(window.location.search).get('device') || localStorage.getItem('forceDeviceType');
            if (override === 'tablet' || override === 'mobile' || override === 'desktop') {
                setDeviceType(override as DeviceType);
                return;
            }

            if (width < 768) {
                setDeviceType('mobile');
            } else if (width >= 768 && width <= 1366 && (isTouch || isNative)) {
                // Consider iPad / Tablets (768 to 1366) with touch capability or native app wrapper
                setDeviceType('tablet');
            } else {
                setDeviceType('desktop');
            }
        };

        checkDeviceType();
        window.addEventListener('resize', checkDeviceType);
        
        return () => window.removeEventListener('resize', checkDeviceType);
    }, []);

    return deviceType;
}
