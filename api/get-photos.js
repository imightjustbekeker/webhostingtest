// api/get-photos.js

export default async function handler(req, res) {
  // CORS configuration for local development or custom domains
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { IMMICH_INSTANCE_URL, IMMICH_API_KEY, IMMICH_ALBUM_ID } = process.env;

  if (!IMMICH_INSTANCE_URL || !IMMICH_API_KEY || !IMMICH_ALBUM_ID) {
    return res.status(500).json({ 
      error: 'Missing required environment variables on the server.' 
    });
  }

  // Sanitize trailing slashes in base URL
  const baseUrl = IMMICH_INSTANCE_URL.replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/albums/${IMMICH_ALBUM_ID}`, {
      method: 'GET',
      headers: {
        'x-api-key': IMMICH_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Immich API responded with status ${response.status}`);
    }

    const albumData = await response.json();
    const assets = albumData.assets || [];

    // Filter out non-image assets if necessary and map image URLs
    const photos = assets
      .filter((asset) => asset.type === 'IMAGE')
      .map((asset) => {
        return {
          id: asset.id,
          title: asset.originalFileName || 'Untitled',
          // Small preview thumbnail for gallery masonry
          thumbnailUrl: `${baseUrl}/api/assets/${asset.id}/thumbnail?size=preview`,
          // High-res preview/original for Lightbox viewing
          fullUrl: `${baseUrl}/api/assets/${asset.id}/thumbnail?size=thumbnail`,
          originalUrl: `${baseUrl}/api/assets/${asset.id}/original`,
          width: asset.exifInfo?.exifImageWidth || 800,
          height: asset.exifInfo?.exifImageHeight || 600,
        };
      });

    // Cache responses at edge for 60 seconds, allow stale-while-revalidate
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ albumTitle: albumData.albumName, photos });
  } catch (error) {
    console.error('Error fetching photos from Immich:', error);
    return res.status(500).json({ error: 'Failed to fetch photos from Immich server.' });
  }
}
