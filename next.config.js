/** @type {import('next').NextConfig} */
const nextConfig = {
  // recharts 등 브라우저 전용 패키지를 서버 번들에서 제외
  experimental: {
    optimizePackageImports: ['recharts'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 서버 사이드에서 recharts 완전 제외
      config.externals = [...(config.externals || []), 'recharts'];
    }
    return config;
  },
};

module.exports = nextConfig;