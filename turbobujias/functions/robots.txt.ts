export const onRequest: PagesFunction = async () => {
  return new Response(
    'User-agent: *
Allow: /

Sitemap: https://www.turbobujias.com/sitemap.xml',
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
