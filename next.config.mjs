import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOT: Bu bayrak ayrı bir doğrulama adımında açılmalı. StrictMode dev'de
  // efektleri iki kez çalıştırır; EarthCanvas'ın WebGL/MapLibre yaşam döngüsü
  // (buildMap/destroyMap, MapboxOverlay) bu senaryoda ayrıca test edilmeli.
  reactStrictMode: false,
  experimental: {
    useTypeScriptCli: true,
  },
};

export default withBundleAnalyzer(nextConfig);
