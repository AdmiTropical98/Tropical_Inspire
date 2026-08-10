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
            
            if (minDim < 500) {
                // Phones have a short side less than 500px (typically 390-430px)
                setDeviceType('mobile');
            } else if (isTouch || isNative) {
                // Any touch device with short side >= 500px is considered a tablet
                setDeviceType('tablet');
            } else if (window.innerWidth < 768) {
                setDeviceType('mobile');
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
