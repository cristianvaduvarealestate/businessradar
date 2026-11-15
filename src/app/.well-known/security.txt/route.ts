export const dynamic = 'force-dynamic';

export async function GET() {
  const content = [
    'Contact: mailto:myremaxclubcristianv@gmail.com',
    'Preferred-Languages: ro, en',
    'Expires: 2027-12-31T23:59:59.000Z',
    'Canonical: https://businessradar.cristianvaduva.com/.well-known/security.txt',
    'Policy: https://businessradar.cristianvaduva.com/privacy',
  ].join('\n');

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
