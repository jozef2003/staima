import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Lockfile-based workspace inference confuses Turbopack because the parent
    // staima/ folder has its own package-lock. Pin the root here.
    root: dirname(fileURLToPath(import.meta.url)),
  },
}

export default nextConfig
