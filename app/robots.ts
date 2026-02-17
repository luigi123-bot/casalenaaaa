import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/cashier/', '/cocina/'],
        },
        sitemap: 'https://casalena.app.netlify.app/sitemap.xml',
    }
}
