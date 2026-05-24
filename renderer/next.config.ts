import type { NextConfig } from 'next'

// In production the renderer is served as static files from Electron.
// In dev it runs as a normal Next.js server at localhost:3000.
const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  // Static export for production so Electron can serve file:// URLs.
  // Dev mode skips this to keep HMR working.
  output: isProd ? 'export' : undefined,

  // Electron serves the static export from a custom origin, so we need
  // relative asset paths rather than the default absolute /path.
  assetPrefix: isProd ? './' : undefined,

  // Next.js Image Optimization is not available in static export.
  // We use plain <img> tags for book covers anyway.
  images: {
    unoptimized: true,
  },

  // Allow importing ESM-only packages that ship without CJS builds.
  transpilePackages: ['pdfjs-dist'],

  // App directory is inside renderer/, so this resolves correctly.
  experimental: {},
}

export default nextConfig
