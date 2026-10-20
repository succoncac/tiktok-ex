# TikTok Raw Media Extractor

A high-performance, full-stack application and standalone Cloudflare Worker for extracting and previewing raw, watermark-free media from TikTok links (supporting canonical URLs and short links such as `vm.tiktok.com` and `vt.tiktok.com`).

---

## 🚀 Key Features

1. **Raw Video Stream**:
   - Direct CDN extraction without platform player UI wrappers or TikTok watermark logos.
   - 1080p Ultra HD and standard quality endpoints.
   - Direct download with custom file naming (`tiktok_@author_id_nowatermark.mp4`).
   - Copy direct stream URL to clipboard.

2. **Photo Carousels & Slideshows**:
   - Extracts all high-resolution original images from photo posts.
   - Responsive gallery grid with individual slide download and CDN link copy.
   - Interactive Lightbox with keyboard navigation (`←` `→` `Esc`).
   - **One-click "Download All as ZIP"** (`.zip`) client-side archiver with real-time progress bar.

3. **Live & Dynamic Photos**:
   - Extracts dynamic photo assets, frames, and motion sequences.
   - Toggle preview between high-res still frames and live motion playback.

4. **Background Audio Track**:
   - Direct clean `.mp3` stream extraction, inline audio player, and download button.

5. **Short Link Resolution**:
   - Automatically resolves `vm.tiktok.com`, `vt.tiktok.com`, and `t.tiktok.com` mobile links to canonical post endpoints.

6. **Proxy Download Service**:
   - Bypasses CORS and forced browser tab redirection by streaming files with proper `Content-Disposition: attachment` headers.

---

## 📁 Project Architecture

```
├── worker/
│   ├── index.js            # Standalone Cloudflare Worker entry point
│   └── wrangler.jsonc      # Cloudflare Wrangler deployment configuration
├── src/
│   ├── components/
│   │   ├── Header.tsx             # Navbar with brand logo & actions
│   │   ├── UrlInputForm.tsx       # Search bar with paste and demo samples
│   │   ├── AuthorCard.tsx         # Creator info, caption, and metrics
│   │   ├── VideoSection.tsx       # Raw video player, HD switch, and downloads
│   │   ├── PhotoCarouselSection.tsx # Gallery grid, Lightbox, and ZIP downloader
│   │   ├── LivePhotoSection.tsx   # Dynamic frames & motion preview
│   │   ├── AudioSection.tsx       # Sound track extractor and player
│   │   ├── CdnInspector.tsx       # Raw JSON and endpoint debugger
│   │   ├── HistoryDrawer.tsx      # LocalStorage extraction history drawer
│   │   └── WorkerDocsModal.tsx    # In-app deployment guide & API specs
│   ├── utils/
│   │   └── media.ts               # Download helpers, ZIP bundler, copy utilities
│   ├── types.ts                   # TypeScript interfaces
│   ├── App.tsx                    # Main state machine and layout
│   ├── main.tsx                   # React root entry
│   └── index.css                  # Tailwind styles and custom scrollbars
├── server.ts                      # Express full-stack proxy & Vite dev server
└── package.json
```

---

## ⚡ Deployment & Setup Guide

### Option A: Running Full-Stack App (Express + Vite)

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server
npm run dev
# Server will run on http://localhost:3000

# 3. Build and run in production
npm run build
npm run start
```

### Option B: Deploying Standalone Cloudflare Worker

The `worker/index.js` file is completely standalone and ready for zero-cold-start edge deployment:

```bash
# 1. Navigate to the worker directory
cd worker

# 2. Authenticate with Cloudflare Wrangler
npx wrangler login

# 3. Test locally in the edge simulator
npx wrangler dev

# 4. Deploy globally to Cloudflare Workers
npx wrangler deploy
```

---

## 📡 API Reference

### 1. Extract Media Metadata
**Endpoint:** `GET /api/extract?url=<TIKTOK_URL>`

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453678"
```

**JSON Response Format:**
```json
{
  "success": true,
  "content_type": "video", // "video" | "images" | "live_photo"
  "id": "7106594312292453678",
  "title": "Caption text...",
  "canonical_url": "https://www.tiktok.com/@tiktok/video/7106594312292453678",
  "author": {
    "id": "107955",
    "unique_id": "tiktok",
    "nickname": "TikTok",
    "avatar": "https://..."
  },
  "stats": {
    "plays": 1250000,
    "likes": 84200,
    "comments": 1500,
    "shares": 3200,
    "downloads": 980
  },
  "media": {
    "video": {
      "no_watermark": "https://...",
      "hd": "https://...",
      "watermarked": "https://...",
      "size": 15728640,
      "hd_size": 25165824,
      "duration": 45,
      "cover": "https://..."
    },
    "images": [],
    "live_photos": [],
    "music": {
      "id": "7106594312",
      "title": "Original Sound",
      "author": "TikTok",
      "play_url": "https://...",
      "cover": "https://..."
    }
  }
}
```

### 2. Direct Proxy Download
**Endpoint:** `GET /api/download?url=<CDN_URL>&filename=<FILENAME>`

Streams the media content with `Content-Disposition: attachment; filename="..."` to force direct browser download.
