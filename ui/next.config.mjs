/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const api = process.env.CODIFICA_API_URL ?? 'http://localhost:3000';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
    ];
  },
};

export default nextConfig;
