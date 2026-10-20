/**
 * Cloudflare Worker: TikTok Raw Media Extractor
 * 
 * High-performance edge worker for extracting watermark-free TikTok media:
 * - Direct CDN videos (HD & Standard No-Watermark)
 * - Original high-resolution photo carousels (up to 35+ images)
 * - Dynamic / Live photos
 * - Background audio tracks
 * - 100% Safe JSON guarantee (Never throws HTML / Unexpected token '<')
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    // Top-level global try/catch: GUARANTEES Cloudflare Worker NEVER returns an HTML 1101/500 error page!
    try {
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
            version: '2.0.0',
            endpoints: [
              '/api/extract?url=https://www.tiktok.com/...',
              '/api/download?url=https://...&filename=media.mp4',
            ],
          }, null, 2),
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
        return await handleExtract(url);
      }

      // Direct proxy download endpoint (forces attachment download)
      if (url.pathname === '/api/download') {
        return await handleDownload(url);
      }

      // 404 handler - ALWAYS JSON, never HTML
      return new Response(
        JSON.stringify({
          success: false,
          error: `Endpoint '${url.pathname}' không tồn tại.`,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    } catch (fatalError) {
      // Catch any unexpected runtime errors in the Worker and return clean JSON
      return new Response(
        JSON.stringify({
          success: false,
          error: fatalError.message || 'Worker internal processing exception',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
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
 * Robust JSON fetcher that NEVER crashes with "Unexpected token '<', <!doctype"
 * If upstream returns HTML (Cloudflare challenge, 502/503 HTML error), handles it gracefully.
 */
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const trimmed = text.trim();

    // Detect HTML responses from upstream
    if (
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<head') ||
      trimmed.includes('<body')
    ) {
      return {
        ok: false,
        status: res.status,
        isHtml: true,
        data: null,
        error: `Máy chủ dịch vụ trả về trang HTML (HTTP ${res.status}) thay vì JSON.`,
      };
    }

    try {
      const data = JSON.parse(text);
      return {
        ok: res.ok,
        status: res.status,
        isHtml: false,
        data,
      };
    } catch (parseErr) {
      return {
        ok: false,
        status: res.status,
        isHtml: false,
        data: null,
        error: 'Phản hồi không phải định dạng JSON hợp lệ: ' + parseErr.message,
      };
    }
  } catch (netErr) {
    return {
      ok: false,
      status: 0,
      isHtml: false,
      data: null,
      error: netErr.message || 'Lỗi kết nối mạng upstream',
    };
  }
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
      parsed.hostname.includes('m.tiktok.com')
    ) {
      const headRes = await fetch(cleanUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT },
      });
      if (headRes.url && headRes.url !== cleanUrl) {
        return headRes.url;
      }

      // If HEAD didn't follow, try GET with redirect manual/follow
      const getRes = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT },
      });
      if (getRes.url) {
        return getRes.url;
      }
    }

    return cleanUrl;
  } catch (err) {
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
        error: 'Thiếu tham số "url". Vui lòng dán link video hoặc ảnh TikTok.',
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
        safeFetchJson(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(uniqueId)}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }),
        safeFetchJson(`https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(uniqueId)}&count=35`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }),
      ]);

      const userInfo = infoRes.data?.data?.user || {};
      const userStats = infoRes.data?.data?.stats || {};
      const rawVideos = Array.isArray(postsRes.data?.data?.videos) ? postsRes.data.data.videos : [];

      const avatarHd = normalizeMediaUrl(userInfo.avatarLarger || userInfo.avatarMedium || userInfo.avatarThumb || '');

      const profileVideos = rawVideos.map((v) => ({
        id: v.id || '',
        title: v.title || '',
        cover: normalizeMediaUrl(v.cover || v.origin_cover || ''),
        duration: v.duration || 0,
        play: normalizeMediaUrl(v.play || ''),
        hdplay: normalizeMediaUrl(v.hdplay || v.play || ''),
        wmplay: normalizeMediaUrl(v.wmplay || ''),
        views: v.play_count || 0,
        likes: v.digg_count || 0,
        comments: v.comment_count || 0,
        shares: v.share_count || 0,
        created_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : '',
        images: Array.isArray(v.images) ? v.images.map(normalizeMediaUrl) : [],
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
            avatar: normalizeMediaUrl(userInfo.avatarThumb || userInfo.avatarMedium || avatarHd),
            avatar_hd: avatarHd,
            signature: userInfo.signature || '',
            verified: userInfo.verified || false,
          },
          stats: {
            plays: userStats.heartCount || userStats.heart || 0,
            likes: userStats.diggCount || 0,
            comments: userStats.followerCount || 0,
            shares: userStats.followingCount || 0,
            downloads: userStats.videoCount || profileVideos.length,
          },
          profile: {
            followers: userStats.followerCount || 0,
            following: userStats.followingCount || 0,
            hearts: userStats.heartCount || userStats.heart || 0,
            video_count: userStats.videoCount || profileVideos.length,
            signature: userInfo.signature || '',
          },
          profile_videos: profileVideos,
        }, null, 2),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Try Primary Provider (TikWM via GET)
    let payload = null;
    let tikwmRes = await safeFetchJson(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}&hd=1`,
      {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      }
    );

    if (tikwmRes.ok && tikwmRes.data && tikwmRes.data.code === 0 && tikwmRes.data.data) {
      payload = tikwmRes.data;
    }

    // Step 2: Fallback 1 - Try TikWM via POST (bypasses Cloudflare GET query firewall blocks)
    if (!payload) {
      const postBody = new URLSearchParams();
      postBody.append('url', resolvedUrl);
      postBody.append('hd', '1');

      const tikwmPostRes = await safeFetchJson('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: postBody.toString(),
      });

      if (tikwmPostRes.ok && tikwmPostRes.data && tikwmPostRes.data.code === 0 && tikwmPostRes.data.data) {
        payload = tikwmPostRes.data;
      }
    }

    // Step 3: Fallback 2 - If story/highlight or photo link returned an error, retry with normalized /video/ path
    if (
      (!payload || payload.code !== 0) &&
      (resolvedUrl.includes('/story/') || resolvedUrl.includes('/photo/'))
    ) {
      const normalizedUrl = resolvedUrl.replace(/\/story\//, '/video/').replace(/\/photo\//, '/video/');
      const retryRes = await safeFetchJson(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(normalizedUrl)}&hd=1`,
        {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }
      );
      if (retryRes.ok && retryRes.data && retryRes.data.code === 0 && retryRes.data.data) {
        payload = retryRes.data;
        resolvedUrl = normalizedUrl;
      }
    }

    // Step 4: Fallback 3 - Secondary Public API (TiklyDown)
    if (!payload || !payload.data) {
      const secondaryRes = await safeFetchJson(
        `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(resolvedUrl)}`,
        {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        }
      );

      if (secondaryRes.ok && secondaryRes.data) {
        const sec = secondaryRes.data;
        // Transform secondary format into uniform structure
        const secImages = Array.isArray(sec.images) ? sec.images.map((img) => normalizeMediaUrl(img.url || img)) : [];
        const secVideoPlay = normalizeMediaUrl(sec.video?.noWatermark || sec.video?.watermark || sec.url || '');

        if (secVideoPlay || secImages.length > 0) {
          payload = {
            code: 0,
            data: {
              id: sec.id || '',
              title: sec.title || '',
              play: secVideoPlay,
              hdplay: secVideoPlay,
              wmplay: normalizeMediaUrl(sec.video?.watermark || ''),
              duration: sec.duration || 0,
              images: secImages,
              cover: normalizeMediaUrl(sec.cover || ''),
              author: {
                id: sec.author?.id || '',
                unique_id: sec.author?.unique_id || sec.author?.name || 'tiktok_creator',
                nickname: sec.author?.nickname || sec.author?.name || 'TikTok Creator',
                avatar: normalizeMediaUrl(sec.author?.avatar || ''),
                avatar_larger: normalizeMediaUrl(sec.author?.avatar || ''),
              },
              music_info: {
                id: sec.music?.id || '',
                title: sec.music?.title || '',
                author: sec.music?.author || '',
                play: normalizeMediaUrl(sec.music?.play_url || ''),
                cover: normalizeMediaUrl(sec.music?.cover || ''),
              },
              play_count: sec.stats?.playCount || 0,
              digg_count: sec.stats?.likeCount || 0,
              comment_count: sec.stats?.commentCount || 0,
              share_count: sec.stats?.shareCount || 0,
              download_count: sec.stats?.downloadCount || 0,
            },
          };
        }
      }
    }

    if (!payload || payload.code !== 0 || !payload.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            payload?.msg ||
            'Không thể lấy dữ liệu từ link này. Bài đăng có thể đã bị xóa, giới hạn quyền riêng tư hoặc dịch vụ TikTok đang bận.',
        }),
        {
          status: 422,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = payload.data;

    // Detect Content Type:
    // Extract all images dynamically (supporting carousels up to 35+ images)
    let rawImages = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      rawImages = data.images.map((img) =>
        normalizeMediaUrl(typeof img === 'string' ? img : img.url_list?.[0] || img.url || '')
      );
    } else if (Array.isArray(data.image_post_info?.images)) {
      rawImages = data.image_post_info.images.map((img) =>
        normalizeMediaUrl(img.display_image?.url_list?.[0] || img.url || '')
      );
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

    const avatarHd = normalizeMediaUrl(
      data.author?.avatar_larger || data.author?.avatar_medium || data.author?.avatar || ''
    );
    const author = {
      id: data.author?.id || '',
      unique_id: data.author?.unique_id || 'unknown_creator',
      nickname: data.author?.nickname || 'TikTok Creator',
      avatar: normalizeMediaUrl(data.author?.avatar || avatarHd),
      avatar_hd: avatarHd,
      signature: data.author?.signature || '',
      verified: Boolean(data.author?.verified),
    };

    const stats = {
      plays: data.play_count || 0,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0,
      downloads: data.download_count || 0,
    };

    const music = {
      id: data.music_info?.id || data.music || '',
      title: data.music_info?.title || 'Original Sound',
      author: data.music_info?.author || author.nickname,
      play_url: normalizeMediaUrl(data.music_info?.play || data.music_info?.url || data.music || ''),
      cover: normalizeMediaUrl(data.music_info?.cover || ''),
      duration: data.music_info?.duration || 0,
    };

    const playVideoUrl = normalizeMediaUrl(data.play || '');
    const hdVideoUrl = normalizeMediaUrl(data.hdplay || data.play || '');
    const wmVideoUrl = normalizeMediaUrl(data.wmplay || '');

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

    return new Response(
      JSON.stringify({
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
      }, null, 2),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Lỗi xử lý khi trích xuất dữ liệu TikTok.',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle direct download proxy
 */
async function handleDownload(url) {
  const mediaUrl = url.searchParams.get('url');
  const filename = url.searchParams.get('filename') || 'tiktok_media.mp4';

  if (!mediaUrl) {
    return new Response(JSON.stringify({ success: false, error: 'Missing media URL parameter' }), {
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
      return new Response(
        JSON.stringify({ success: false, error: 'CDN returned an HTML page instead of raw media file.' }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
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
