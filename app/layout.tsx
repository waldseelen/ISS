import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Earth Tracker',
    description: '3D interactive Earth — ISS, weather, air quality, day/night terminator, planes, marine data',
    openGraph: {
        title: 'Earth Tracker',
        description: 'Zoom Earth + Google Earth + ISS Tracker hybrid',
        type: 'website',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="tr">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-black overflow-hidden">{children}</body>
        </html>
    );
}
