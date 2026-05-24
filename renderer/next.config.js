/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  output: isProd ? 'export' : undefined,
  assetPrefix: isProd ? './' : undefined,
  images: {
    unoptimized: true,
  },
  transpilePackages: ['pdfjs-dist'],
}

module.exports = nextConfig
