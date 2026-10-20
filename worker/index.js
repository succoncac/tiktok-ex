/**
 * Cloudflare Worker: TikTok Raw Media Extractor
 * 
 * High-performance edge worker for extracting watermark-free TikTok media:
 * - Direct CDN videos (HD & Standard No-Watermark)
 * - Original high-resolution photo carousels
 * - Dynamic / Live photos
 * - Background audio tracks
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'online',
          service: 'TikTok Raw Media Extractor Worker',
          version: '1.0.0',
          endpoints: [
            '/api/extract?url=https://www.tiktok.com/...',
            '/api/download?url=https://...&filename=media.mp4',
          ],
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Media extraction endpoint
    if (url.pathname === '/api/extract') {
      return handleExtract(url);
    }

    // Direct proxy download endpoint (forces attachment download)
    if (url.pathname === '/api/download') {
      return handleDownload(url);
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  },
};

/**
 * Normalizes relative URLs (e.g. from TikWM API) to absolute HTTPS URLs
 */
function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  if (trimmed.startsWith('/')) return 'https://www.tikwm.com' + trimmed;
  return trimmed;
}

/**
 * Resolve short links (vm.tiktok.com, vt.tiktok.com) to canonical URL
 */
async function resolveTikTokUrl(inputUrl) {
  try {
    let cleanUrl = inputUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const parsed = new URL(cleanUrl);
    // If it's a short link, follow redirects
    if (
      parsed.hostname.includes('vm.tiktok.com') ||
      parsed.hostname.includes('vt.tiktok.com') ||
      parsed.hostname.includes('t.tiktok.com') ||
      parsed.pathname.startsWith('/t/')
    ) {
      const redirectResponse = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      return redirectResponse.url || cleanUrl;
    }

    return cleanUrl;
  } catch (err) {
    // Return original if resolution fails
    return inputUrl;
  }
}

/**
 * Handle TikTok extraction
 */
async function handleExtract(url) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing required "url" parameter',
      }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  let checkUrl = targetUrl.trim();
  if (!checkUrl.startsWith('http://') && !checkUrl.startsWith('https://') && checkUrl.startsWith('@')) {
    checkUrl = 'https://www.tiktok.com/' + checkUrl;
  }

  if (!/(tiktok\.com|douyin\.com|^@[a-zA-Z0-9_.-]+$)/i.test(targetUrl)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Vui lòng cung cấp link TikTok hợp lệ (link video, ảnh, story hoặc link trang cá nhân @username).',
      }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let resolvedUrl = await resolveTikTokUrl(checkUrl);

    // Profile URL Detection (e.g. tiktok.com/@username or @username)
    const profileMatch = resolvedUrl.match(/(?:^|\/|\b)@([a-zA-Z0-9_.-]+)\/?(?:\?.*)?$/);
    const isProfileUrl = Boolean(profileMatch) && !/\/(video|photo|story)\//.test(resolvedUrl);

    if (isProfileUrl && profileMatch) {
      const uniqueId = profileMatch[1];
      const [infoRes, postsRes] = await Promise.all([
        fetch(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(uniqueId)}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }).catch(() => null),
        fetch(`https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(uniqueId)}&count=35`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }).catch(() => null),
      ]);

      const infoJson = infoRes && infoRes.ok ? await infoRes.json() : null;
      const postsJson = postsRes && postsRes.ok ? await postsRes.json() : null;

      const userInfo = infoJson?.data?.user || {};
      const userStats = infoJson?.data?.stats || {};
      const rawVideos = Array.isArray(postsJson?.data?.videos) ? postsJson.data.videos : [];

      const avatarHd = userInfo.avatarLarger || userInfo.avatarMedium || userInfo.avatarThumb || '';

      const profileVideos = rawVideos.map((v) => ({
        id: v.id || '',
        title: v.title || '',
        cover: v.cover || v.origin_cover || '',
        duration: v.duration || 0,
        play: v.play || '',
        hdplay: v.hdplay || v.play || '',
        wmplay: v.wmplay || '',
        views: v.play_count || 0,
        likes: v.digg_count || 0,
        comments: v.comment_count || 0,
        shares: v.share_count || 0,
        created_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : '',
        images: Array.isArray(v.images) ? v.images : []
      }));

      return new Response(
        JSON.stringify({
          success: true,
          content_type: 'profile',
          id: userInfo.id || uniqueId,
          title: userInfo.nickname || `@${uniqueId}`,
          created_at: new Date().toISOString(),
          canonical_url: `https://www.tiktok.com/@${uniqueId}`,
          author: {
            id: userInfo.id || '',
            unique_id: userInfo.uniqueId || uniqueId,
            nickname: userInfo.nickname || uniqueId,
            avatar: userInfo.avatarThumb || userInfo.avatarMedium || avatarHd,
            avatar_hd: avatarHd,
            signature: userInfo.signature || '',
            verified: userInfo.verified || false
          },
          stats: {
            plays: userStats.heartCount || userStats.heart || 0,
            likes: userStats.diggCount || 0,
            comments: userStats.followerCount || 0,
            shares: userStats.followingCount || 0,
            downloads: userStats.videoCount || profileVideos.length
          },
          profile: {
            followers: userStats.followerCount || 0,
            following: userStats.followingCount || 0,
            hearts: userStats.heartCount || userStats.heart || 0,
            video_count: userStats.videoCount || profileVideos.length,
            signature: userInfo.signature || ''
          },
          profile_videos: profileVideos
        }, null, 2),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call TikWM API with HD enabled
    let apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}&hd=1`;
    let apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`TikWM API responded with status ${apiResponse.status}`);
    }

    let payload = await apiResponse.json();

    // Fallback: If story/highlight or photo link returned an error, retry with normalized /video/ path
    if (payload.code !== 0 && (resolvedUrl.includes('/story/') || resolvedUrl.includes('/photo/'))) {
      const normalizedUrl = resolvedUrl.replace(/\/story\//, '/video/').replace(/\/photo\//, '/video/');
      const retryRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(normalizedUrl)}&hd=1`, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (retryRes.ok) {
        const retryPayload = await retryRes.json();
        if (retryPayload.code === 0 && retryPayload.data) {
          payload = retryPayload;
          resolvedUrl = normalizedUrl;
        }
      }
    }

    if (payload.code !== 0 || !payload.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: payload.msg || 'Không thể lấy dữ liệu từ link này. Bài đăng có thể đã bị xóa hoặc ở chế độ riêng tư.',
        }),
        {
          status: 422,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = payload.data;

    // Detect Content Type:
    // 1. "images" - photo carousel / slideshow
    // 2. "live_photo" - dynamic / live photo sequence
    // 3. "video" - standard or HD watermark-free video
    // Extract all images dynamically (supporting carousels up to 35+ images)
    let rawImages = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      rawImages = data.images.map((img) => normalizeMediaUrl(typeof img === 'string' ? img : img.url_list?.[0] || img.url || ''));
    } else if (Array.isArray(data.image_post_info?.images)) {
      rawImages = data.image_post_info.images.map((img) => normalizeMediaUrl(img.display_image?.url_list?.[0] || img.url || ''));
    }

    const isImageCarousel = rawImages.length > 0;
    const hasDynamicPhotos = isImageCarousel && Boolean(data.play);

    let contentType = 'video';
    if (hasDynamicPhotos) {
      contentType = 'live_photo';
    } else if (isImageCarousel) {
      contentType = 'images';
    } else {
      contentType = 'video';
    }

    // Format author with high-res avatar
    const avatarHd = normalizeMediaUrl(data.author?.avatar_larger || data.author?.avatar_medium || data.author?.avatar || '');
    const author = {
      id: data.author?.id || '',
      unique_id: data.author?.unique_id || 'unknown_creator',
      nickname: data.author?.nickname || 'TikTok Creator',
      avatar: normalizeMediaUrl(data.author?.avatar || avatarHd),
      avatar_hd: avatarHd,
      signature: data.author?.signature || '',
    };

    // Format stats
    const stats = {
      plays: data.play_count || 0,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0,
      downloads: data.download_count || 0,
    };

    // Format music
    const music = {
      id: data.music_info?.id || data.music_id || '',
      title: data.music_info?.title || data.music || 'Original Sound',
      author: data.music_info?.author || author.nickname,
      play_url: normalizeMediaUrl(data.music || data.music_info?.play || ''),
      cover: normalizeMediaUrl(data.music_info?.cover || ''),
      duration: data.music_info?.duration || 0,
    };

    const playVideoUrl = normalizeMediaUrl(data.play || '');
    const hdVideoUrl = normalizeMediaUrl(data.hdplay || data.play || '');
    const wmVideoUrl = normalizeMediaUrl(data.wmplay || '');

    // Format media links
    const media = {
      video: {
        no_watermark: playVideoUrl,
        hd: hdVideoUrl,
        watermarked: wmVideoUrl,
        size: data.size || 0,
        hd_size: data.hd_size || 0,
        duration: data.duration || 0,
        cover: normalizeMediaUrl(data.cover || data.origin_cover || ''),
        dynamic_cover: normalizeMediaUrl(data.dynamic_cover || ''),
      },
      images: rawImages,
      images_count: rawImages.length,
      live_photos: hasDynamicPhotos
        ? rawImages.map((imgUrl, idx) => ({
            index: idx + 1,
            image_url: imgUrl,
            motion_preview: playVideoUrl,
          }))
        : [],
      music,
    };

    const responsePayload = {
      success: true,
      content_type: contentType,
      id: data.id || '',
      title: data.title || '',
      images_count: rawImages.length,
      created_at: data.create_time ? new Date(data.create_time * 1000).toISOString() : new Date().toISOString(),
      canonical_url: resolvedUrl,
      author,
      stats,
      media,
    };

    return new Response(JSON.stringify(responsePayload, null, 2), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while processing the TikTok URL.',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Proxy download media to force Content-Disposition attachment header
 */
async function handleDownload(url) {
  const mediaUrl = url.searchParams.get('url');
  const filename = url.searchParams.get('filename') || 'tiktok_media.mp4';

  if (!mediaUrl) {
    return new Response(JSON.stringify({ success: false, error: 'Missing media "url" parameter' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const cleanMediaUrl = normalizeMediaUrl(mediaUrl);

    const isTikwm = cleanMediaUrl.includes('tikwm.com');
    const fetchHeaders = {
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
      'Referer': isTikwm ? 'https://www.tikwm.com/' : 'https://www.tiktok.com/',
      'Accept-Encoding': 'identity',
    };

    const mediaRes = await fetch(cleanMediaUrl, { headers: fetchHeaders });

    if (!mediaRes.ok) {
      return new Response(JSON.stringify({ success: false, error: `CDN returned status ${mediaRes.status}` }), {
        status: mediaRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const rawContentType = mediaRes.headers.get('content-type') || '';

    // If CDN returned an HTML error page or cloudflare challenge, DO NOT ATTACH AS DOWNLOAD
    if (rawContentType.includes('text/html')) {
      return new Response(JSON.stringify({ success: false, error: 'CDN returned an HTML page instead of raw media file.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Determine correct content-type from filename extension to guarantee binary file
    let resolvedContentType = rawContentType || 'application/octet-stream';
    const lowerName = filename.toLowerCase();
    if (lowerName.endsWith('.mp4')) {
      resolvedContentType = 'video/mp4';
    } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      resolvedContentType = 'image/jpeg';
    } else if (lowerName.endsWith('.png')) {
      resolvedContentType = 'image/png';
    } else if (lowerName.endsWith('.mp3')) {
      resolvedContentType = 'audio/mpeg';
    } else if (lowerName.endsWith('.zip')) {
      resolvedContentType = 'application/zip';
    }

    const contentLength = mediaRes.headers.get('content-length');

    const headers = {
      ...CORS_HEADERS,
      'Content-Type': resolvedContentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}"`,
      'Cache-Control': 'public, max-age=3600',
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    return new Response(mediaRes.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Download proxy error: ' + err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
