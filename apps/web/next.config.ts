import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
}

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(';')
if (allowedDevOrigins) nextConfig.allowedDevOrigins = allowedDevOrigins

export default nextConfig
