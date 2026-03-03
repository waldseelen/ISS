/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                cyan: { DEFAULT: '#00e5ff', 50: '#e0fcff', 100: '#b3f5ff', 200: '#80edff', 300: '#4de5ff', 400: '#1addff', 500: '#00e5ff', 600: '#00b8cc', 700: '#008a99', 800: '#005c66', 900: '#002e33' },
                glass: 'rgba(8,12,22,0.72)',
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            backdropBlur: {
                xl: '20px',
            },
        },
    },
    plugins: [],
};
