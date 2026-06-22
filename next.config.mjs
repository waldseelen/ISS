import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Three.js needs this off
};

export default withBundleAnalyzer(nextConfig);
