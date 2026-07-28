import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
}

export default nextConfig
