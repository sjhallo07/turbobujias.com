export const onRequest: PagesFunction = async () => {
  const today = new Date().toISOString().split('T')[0];
  const pages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/catalogo', priority: '0.9', changefreq: 'daily' },
    { loc: '/bujias', priority: '0.9', changefreq: 'weekly' },
    { loc: '/calentadores', priority: '0.9', changefreq: 'weekly' },
    { loc: '/filtros', priority: '0.9', changefreq: 'weekly' },
    { loc: '/diagnostico', priority: '0.8', changefreq: 'monthly' },
    { loc: '/asistente', priority: '0.8', changefreq: 'monthly' },
    { loc: '/contacto', priority: '0.7', changefreq: 'monthly' },
    { loc: '/nosotros', priority: '0.6', changefreq: 'monthly' },
    { loc: '/terminos', priority: '0.3', changefreq: 'yearly' },
    { loc: '/privacidad', priority: '0.3', changefreq: 'yearly' },
  ];

  const urls = pages.map(p => `  <url>
    <loc>https://www.turbobujias.com${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('
');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' }
  });
};
