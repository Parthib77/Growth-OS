const apiOrigin =
  process.env.API_ORIGIN ||
  (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');

const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
