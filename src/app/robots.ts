import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/checkout', '/carrinho', '/album/dashboard'],
    },
    sitemap: 'https://www.maistrilhasmenosestresse.com/sitemap.xml',
  }
}
