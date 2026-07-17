import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.25'],
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: `${process.env.AWS_S3_BUCKET_NAME || 'maistrilha-menosestresse'}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com`,
      pathname: '/**',
    }],
  },
  async headers() {
    return [
      {
        // Aplica os cabeçalhos corporativos de segurança em todas as rotas do site
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
