/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
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
            }
        },
    },
    plugins: [],
}
