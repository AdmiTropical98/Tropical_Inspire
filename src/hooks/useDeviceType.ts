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

            const minDim = Math.min(window.innerWidth, window.innerHeight);
            
            if (minDim < 600) {
                setDeviceType('mobile');
            } else if (minDim >= 600 && minDim <= 1024 && (isTouch || isNative)) {
                // Tablets typically have a minimum dimension of at least 600px (e.g. iPad is 768px, small Android tablet is 600px)
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
