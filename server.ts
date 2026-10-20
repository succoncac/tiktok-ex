import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.use(express.json());

// Global CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

/**
 * Normalizes relative URLs (e.g. from TikWM API) to absolute HTTPS URLs
 */
function normalizeMediaUrl(url: any): string {
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
async function safeFetchJson(url: string, options: RequestInit = {}): Promise<{
  ok: boolean;
  status: number;
  isHtml: boolean;
  data: any;
  error?: string;
}> {
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
    } catch (parseErr: any) {
      return {
        ok: false,
        status: res.status,
        isHtml: false,
        data: null,
        error: 'Phản hồi không phải định dạng JSON hợp lệ: ' + parseErr.message,
      };
    }
  } catch (netErr: any) {
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
 * Resolves short links like vm.tiktok.com or vt.tiktok.com
 */
async function resolveTikTokUrl(inputUrl: string): Promise<string> {
  try {
    let cleanUrl = inputUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const parsed = new URL(cleanUrl);
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
    return inputUrl;
  }
}

/**
 * Health check endpoint
 */
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'TikTok Raw Media Extractor',
    version: '2.0.0',
  });
});

/**
 * API: Extract raw media metadata and direct CDN links
 */
app.get('/api/extract', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: 'Thiếu tham số "url". Vui lòng dán link video hoặc ảnh TikTok.',
    });
  }

  let checkUrl = targetUrl.trim();
  if (!checkUrl.startsWith('http://') && !checkUrl.startsWith('https://') && checkUrl.startsWith('@')) {
    checkUrl = 'https://www.tiktok.com/' + checkUrl;
  }

  if (!/(tiktok\.com|douyin\.com|^@[a-zA-Z0-9_.-]+$)/i.test(targetUrl)) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng cung cấp link TikTok hợp lệ (link video, ảnh, story hoặc link trang cá nhân @username).',
    });
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

      const profileVideos = rawVideos.map((v: any) => ({
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

      return res.json({
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
      });
    }

    // Step 1: Try Primary Provider (TikWM via GET)
    let payload: any = null;
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
        const secImages = Array.isArray(sec.images) ? sec.images.map((img: any) => normalizeMediaUrl(img.url || img)) : [];
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
      return res.status(422).json({
        success: false,
        error:
          payload?.msg ||
          'Không thể lấy dữ liệu từ link này. Bài đăng có thể đã bị xóa, giới hạn quyền riêng tư hoặc dịch vụ TikTok đang bận.',
      });
    }

    const data = payload.data;

    // Detect Content Type:
    // Extract all images dynamically (supporting carousels up to 35+ images)
    let rawImages: string[] = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      rawImages = data.images.map((img: any) =>
        normalizeMediaUrl(typeof img === 'string' ? img : img.url_list?.[0] || img.url || '')
      );
    } else if (Array.isArray(data.image_post_info?.images)) {
      rawImages = data.image_post_info.images.map((img: any) =>
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
        ? rawImages.map((imgUrl: string, idx: number) => ({
            index: idx + 1,
            image_url: imgUrl,
            motion_preview: playVideoUrl,
          }))
        : [],
      music,
    };

    return res.json({
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
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý khi trích xuất dữ liệu TikTok.',
    });
  }
});

/**
 * API: Proxy download media stream to enforce attachment header and bypass CORS
 */
app.get('/api/download', async (req: Request, res: Response) => {
  const mediaUrl = req.query.url as string;
  const filename = (req.query.filename as string) || 'tiktok_media.mp4';

  if (!mediaUrl) {
    return res.status(400).json({ success: false, error: 'Missing media "url" parameter' });
  }

  try {
    const cleanMediaUrl = normalizeMediaUrl(mediaUrl);

    const isTikwm = cleanMediaUrl.includes('tikwm.com');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: isTikwm ? 'https://www.tikwm.com/' : 'https://www.tiktok.com/',
      'Accept-Encoding': 'identity',
    };

    const mediaRes = await fetch(cleanMediaUrl, { headers: fetchHeaders });

    if (!mediaRes.ok) {
      return res.status(mediaRes.status).json({
        success: false,
        error: `CDN returned status ${mediaRes.status}`,
      });
    }

    const rawContentType = mediaRes.headers.get('content-type') || '';

    // If CDN returned an HTML error page or cloudflare challenge, DO NOT ATTACH AS DOWNLOAD
    if (rawContentType.includes('text/html')) {
      return res.status(502).json({
        success: false,
        error: 'CDN returned an HTML page instead of raw media file.',
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

    res.setHeader('Content-Type', resolvedContentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (!mediaRes.body) {
      return res.status(500).json({ success: false, error: 'No response body from CDN' });
    }

    const arrayBuffer = await mediaRes.arrayBuffer();

    // Secondary check: verify binary magic numbers (avoid downloading HTML string disguised as binary)
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 500 && buffer.toString('utf-8', 0, 50).toLowerCase().includes('<html')) {
      return res.status(502).json({ success: false, error: 'CDN response content is HTML error markup' });
    }

    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Download proxy error: ' + err.message });
  }
});

// Explicit 404 handler for any /api/* route: ALWAYS returns JSON, NEVER falls through to Vite HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route '${req.originalUrl}' không tồn tại.`,
  });
});

// Global Express error middleware
app.use((err: any, _req: Request, res: Response, next: any) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    error: err.message || 'Lỗi xử lý máy chủ nội bộ.',
  });
});

// Vite or Static files handling
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TikTok Raw Media Extractor running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
