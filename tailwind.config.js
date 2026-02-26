/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            spacing: {
                '8': '8px',
                '16': '16px',
                '24': '24px',
                '32': '32px',
                '40': '40px',
                '48': '48px',
                '56': '56px',
                '64': '64px',
            },
            colors: {
                slate: {
                    850: '#151e32', // Slightly richer dark for backgrounds
                    900: '#0f172a',
                    950: '#020617', // Deeper black-blue
                },
                blue: {
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb', // Corporate Primary
                    700: '#1d4ed8',
                    900: '#1e3a8a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            backdropBlur: {
                xs: '2px',
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
                'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.05)',
                'neon': '0 0 5px theme("colors.blue.500"), 0 0 20px theme("colors.blue.900")',
                'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                'elevated-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
            animation: {
                'gradient-x': 'gradient-x 15s ease infinite',
                'fade-in': 'fade-in 0.5s ease-in-out',
                'slide-in-from-bottom-4': 'slide-in-from-bottom-4 0.5s ease-out',
                'slide-in-from-left': 'slide-in-from-left 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                'gradient-x': {
                    '0%, 100%': {
                        'background-size': '200% 200%',
                        'background-position': 'left center'
                    },
                    '50%': {
                        'background-size': '200% 200%',
                        'background-position': 'right center'
                    }
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                'slide-in-from-bottom-4': {
                    '0%': { transform: 'translateY(1rem)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                'slide-in-from-left': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' }
                }
            },
            transitionDuration: {
                '120': '120ms',
                '180': '180ms',
            },
            gridTemplateColumns: {
                '13': 'repeat(13, minmax(0, 1fr))',
                '14': 'repeat(14, minmax(0, 1fr))',
            }
        },
    },
    plugins: [],
}
