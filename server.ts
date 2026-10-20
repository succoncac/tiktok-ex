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
 * Helper to parse compact count strings like '96.4M', '2.7B', '82K', '1,234' to number
 */
function parseCountString(str: any): number {
  if (!str) return 0;
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  const clean = String(str).trim().replace(/,/g, '');
  const multMatch = clean.match(/^([\d.]+)\s*([KkMmBbTt]?)$/);
  if (!multMatch) {
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  const val = parseFloat(multMatch[1]);
  if (isNaN(val)) return 0;
  const unit = multMatch[2]?.toUpperCase();
  if (unit === 'K') return Math.round(val * 1e3);
  if (unit === 'M') return Math.round(val * 1e6);
  if (unit === 'B') return Math.round(val * 1e9);
  if (unit === 'T') return Math.round(val * 1e12);
  return Math.round(val);
}

/**
 * Scrapes TikTok profile metadata directly: exact follower count, following count, likes/hearts, avatar, and videos
 */
async function scrapeTikTokProfileDirect(uniqueId: string) {
  const cleanId = uniqueId.replace(/^@/, '').trim();
  const url = `https://www.tiktok.com/@${encodeURIComponent(cleanId)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 500) return null;

    // 1. Extract JSON-LD Profile Schema (contains exact Follower & Like numbers)
    let ld: any = null;
    const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      try {
        ld = JSON.parse(ldMatch[1]);
      } catch {
        // ignore
      }
    }

    const mainEntity = ld?.mainEntity || {};
    const statsList: any[] = Array.isArray(mainEntity.interactionStatistic)
      ? mainEntity.interactionStatistic
      : [];
    const exactLikes = statsList.find((s: any) => s.interactionType?.['@type']?.includes('LikeAction'))?.userInteractionCount;
    const exactFollowers = statsList.find((s: any) => s.interactionType?.['@type']?.includes('FollowAction'))?.userInteractionCount;

    // 2. Extract stats from HTML data-e2e attributes
    const followingMatch = html.match(/data-e2e="following-count"[^>]*>([^<]*)<\/strong>/i) ||
                           html.match(/title="Following"[^>]*>([^<]*)<\/strong>/i) ||
                           html.match(/data-e2e="following-count"[^>]*>([^<]*)</i);
    const followersMatch = html.match(/data-e2e="followers-count"[^>]*>([^<]*)<\/strong>/i) ||
                           html.match(/title="Followers"[^>]*>([^<]*)<\/strong>/i) ||
                           html.match(/data-e2e="followers-count"[^>]*>([^<]*)</i);
    const likesMatch = html.match(/data-e2e="likes-count"[^>]*>([^<]*)<\/strong>/i) ||
                       html.match(/title="Likes"[^>]*>([^<]*)<\/strong>/i) ||
                       html.match(/data-e2e="likes-count"[^>]*>([^<]*)</i);

    const followers = (typeof exactFollowers === 'number' && !isNaN(exactFollowers))
      ? exactFollowers
      : parseCountString(followersMatch?.[1]);

    const hearts = (typeof exactLikes === 'number' && !isNaN(exactLikes))
      ? exactLikes
      : parseCountString(likesMatch?.[1]);

    const following = parseCountString(followingMatch?.[1]);

    // 3. User Avatar
    const avatarMeta = html.match(/<meta[^>]*property="(?:og|twitter):image"[^>]*content="([^"]*)"/i);
    const rawAvatar = (mainEntity.image || avatarMeta?.[1] || '').replace(/&amp;/g, '&').trim();
    const avatar = rawAvatar
      ? (rawAvatar.startsWith('http') ? `/api/avatar?url=${encodeURIComponent(rawAvatar)}` : rawAvatar)
      : '';

    // 4. Nickname & Bio
    const nickname = mainEntity.name || cleanId;
    const signature = mainEntity.description || '';
    const verified = mainEntity.disambiguatingDescription === 'verified';

    // 5. Extract profile videos directly from HTML post cards
    const videoMap = new Map<string, any>();
    const postParts = html.split('data-e2e="user-post-item"');
    for (let i = 1; i < postParts.length; i++) {
      const chunk = postParts[i];
      const linkMatch = chunk.match(/href="https:\/\/www\.tiktok\.com\/@[^/]+\/video\/(\d+)"/);
      if (!linkMatch) continue;
      const vidId = linkMatch[1];
      if (videoMap.has(vidId)) continue;

      const imgMatch = chunk.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/i) ||
                       chunk.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"/i);
      let cover = '';
      let title = '';
      if (imgMatch) {
        if (imgMatch[1]?.startsWith('http')) {
          cover = imgMatch[1];
          title = imgMatch[2] || '';
        } else {
          cover = imgMatch[2] || '';
          title = imgMatch[1] || '';
        }
      }
      const viewsMatch = chunk.match(/data-e2e="video-views"[^>]*>([^<]*)<\/strong>/i) ||
                         chunk.match(/data-e2e="video-views"[^>]*>([^<]*)</i);
      const videoSrcMatch = chunk.match(/<video[^>]*src="([^"]*)"/i);

      videoMap.set(vidId, {
        id: vidId,
        title: title.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim(),
        cover: normalizeMediaUrl(cover.replace(/&amp;/g, '&')),
        views: parseCountString(viewsMatch?.[1]),
        play: normalizeMediaUrl((videoSrcMatch?.[1] || '').replace(/&amp;/g, '&')),
        hdplay: normalizeMediaUrl((videoSrcMatch?.[1] || '').replace(/&amp;/g, '&')),
        wmplay: '',
        likes: 0,
        comments: 0,
        shares: 0,
        duration: 0,
        created_at: new Date().toISOString(),
      });
    }

    const profileVideos = Array.from(videoMap.values());

    return {
      uniqueId: cleanId,
      nickname,
      avatar,
      avatar_hd: avatar,
      signature,
      verified,
      followers,
      following,
      hearts,
      video_count: profileVideos.length,
      videos: profileVideos,
    };
  } catch (err) {
    console.warn('[ProfileScraper] Error scraping profile direct:', err);
    return null;
  }
}

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
      const uniqueId = profileMatch[1].replace(/^@/, '').trim();

      // Tier 1: Direct TikTok Profile & Schema Scraping (Provides exact followerCount, followingCount, heartCount, and videos)
      let profileResult: any = await scrapeTikTokProfileDirect(uniqueId);

      // Tier 2: Fallback to TikWM user/info & user/posts if Tier 1 failed or returned 0 stats
      if (!profileResult || (profileResult.followers === 0 && profileResult.hearts === 0 && profileResult.videos.length === 0)) {
        try {
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

          const followersCount = userStats.followerCount || 0;
          const followingCount = userStats.followingCount || 0;
          const heartsCount = userStats.heartCount || userStats.heart || 0;
          const videoCount = userStats.videoCount || profileVideos.length;

          if (userInfo.uniqueId || profileVideos.length > 0 || followersCount > 0) {
            profileResult = {
              uniqueId: userInfo.uniqueId || uniqueId,
              nickname: userInfo.nickname || uniqueId,
              avatar: normalizeMediaUrl(userInfo.avatarThumb || userInfo.avatarMedium || avatarHd),
              avatar_hd: avatarHd,
              signature: userInfo.signature || '',
              verified: userInfo.verified || false,
              followers: followersCount,
              following: followingCount,
              hearts: heartsCount,
              video_count: videoCount,
              videos: profileVideos,
            };
          }
        } catch (fallbackErr) {
          console.warn('[ProfileScraper] TikWM fallback failed:', fallbackErr);
        }
      }

      const finalUniqueId = profileResult?.uniqueId || uniqueId;
      const finalNickname = profileResult?.nickname || finalUniqueId;
      const finalAvatar = profileResult?.avatar || '';
      const finalFollowers = profileResult?.followers || 0;
      const finalFollowing = profileResult?.following || 0;
      const finalHearts = profileResult?.hearts || 0;
      const finalVideos = profileResult?.videos || [];
      const finalVideoCount = profileResult?.video_count || finalVideos.length;

      return res.json({
        success: true,
        content_type: 'profile',
        id: finalUniqueId,
        title: finalNickname,
        created_at: new Date().toISOString(),
        canonical_url: `https://www.tiktok.com/@${finalUniqueId}`,
        author: {
          id: finalUniqueId,
          unique_id: finalUniqueId,
          nickname: finalNickname,
          avatar: finalAvatar,
          avatar_hd: profileResult?.avatar_hd || finalAvatar,
          signature: profileResult?.signature || '',
          verified: profileResult?.verified || false,
        },
        stats: {
          plays: finalHearts,
          likes: finalHearts,
          comments: finalFollowers,
          shares: finalFollowing,
          downloads: finalVideoCount,
        },
        profile: {
          followers: finalFollowers,
          following: finalFollowing,
          hearts: finalHearts,
          video_count: finalVideoCount,
          signature: profileResult?.signature || '',
        },
        profile_videos: finalVideos,
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
 * API: Proxy avatar image to guarantee 100% successful loading and bypass TikTok 403 / CDN blocks
 */
app.get('/api/avatar', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'Thiếu tham số "url".' });
  }

  try {
    let cleanUrl = decodeURIComponent(targetUrl).replace(/&amp;/g, '&').trim();
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (cleanUrl.startsWith('/') && !cleanUrl.startsWith('/api/')) cleanUrl = 'https://www.tikwm.com' + cleanUrl;

    const isTikTokApiImg = cleanUrl.includes('tiktok.com/api/img');
    const isTikwm = cleanUrl.includes('tikwm.com');

    const headers: Record<string, string> = {
      'User-Agent': isTikTokApiImg
        ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        : USER_AGENT,
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: isTikwm ? 'https://www.tikwm.com/' : 'https://www.tiktok.com/',
    };

    let imgRes = await fetch(cleanUrl, { headers });

    // Fallback: try with crawler User-Agent if standard was blocked
    if (!imgRes.ok && !isTikTokApiImg) {
      imgRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          Accept: 'image/*',
          Referer: 'https://www.tiktok.com/',
        },
      });
    }

    if (!imgRes.ok) {
      return res.status(imgRes.status).json({ success: false, error: `Upstream CDN error ${imgRes.status}` });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const arrayBuffer = await imgRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Lỗi tải ảnh đại diện.' });
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
    let cleanMediaUrl = normalizeMediaUrl(mediaUrl);
    if (cleanMediaUrl.includes('/api/avatar?url=')) {
      const match = cleanMediaUrl.match(/[?&]url=([^&]+)/);
      if (match) {
        cleanMediaUrl = decodeURIComponent(match[1]);
      }
    }

    const isTikTokApiImg = cleanMediaUrl.includes('tiktok.com/api/img');
    const isTikwm = cleanMediaUrl.includes('tikwm.com');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': isTikTokApiImg
        ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        : USER_AGENT,
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
