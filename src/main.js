/**
 * TikTok Raw Media Extractor - Core Frontend Controller
 * Focused exclusively on extracting and previewing raw watermark-free media:
 * - Clear visual thumbnail/poster preview for videos and photos so users know what it is before downloading
 * - Direct download and copy-link buttons
 * - Bulk ZIP download for photo carousels (up to 35+ items)
 */

import JSZip from 'jszip';
import './style.css';

// State Management
const state = {
  isLoading: false,
  result: null,
  error: null,
  lightboxIndex: null,
  isZipping: false,
};

// DOM Elements
const urlInput = document.getElementById('url-input');
const extractBtn = document.getElementById('extract-btn');
const extractForm = document.getElementById('extract-form');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const errorContainer = document.getElementById('error-container');
const errorText = document.getElementById('error-text');
const resultsContainer = document.getElementById('results-container');
const loaderContainer = document.getElementById('loader-container');
const loaderText = document.getElementById('loader-text');
const lightboxModal = document.getElementById('lightbox-modal');

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  if (extractForm) {
    extractForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = urlInput.value.trim();
      if (val) handleExtract(val);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      urlInput.value = '';
      toggleClearBtn();
      urlInput.focus();
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', toggleClearBtn);
  }

  // Keyboard navigation for Lightbox
  window.addEventListener('keydown', (e) => {
    if (state.lightboxIndex === null) return;
    const images = state.result?.media?.images || [];
    if (!images.length) return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
  });
}

function toggleClearBtn() {
  if (!clearBtn || !urlInput) return;
  if (urlInput.value.trim().length > 0) {
    clearBtn.classList.remove('hidden');
    pasteBtn?.classList.add('hidden');
  } else {
    clearBtn.classList.add('hidden');
    pasteBtn?.classList.remove('hidden');
  }
}

// Extraction API Handler
async function handleExtract(url) {
  state.isLoading = true;
  state.error = null;
  hideError();
  showLoader('Đang lấy link video & ảnh...');

  try {
    const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể lấy thông tin từ liên kết này. Video có thể đã bị xóa hoặc ở chế độ riêng tư.');
    }

    state.result = data;
    renderResults(data);

    setTimeout(() => {
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    state.error = err.message || 'Đã có lỗi xảy ra khi kết nối máy chủ.';
    showError(state.error);
  } finally {
    state.isLoading = false;
    hideLoader();
  }
}

function showLoader(message) {
  if (loaderContainer) {
    loaderText.textContent = message || 'Đang xử lý...';
    loaderContainer.classList.remove('hidden');
  }
  if (extractBtn) {
    extractBtn.disabled = true;
    extractBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Đang tải...</span>
    `;
  }
}

function hideLoader() {
  if (loaderContainer) loaderContainer.classList.add('hidden');
  if (extractBtn) {
    extractBtn.disabled = false;
    extractBtn.innerHTML = `
      <span>Bắt đầu lấy</span>
      <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
      </svg>
    `;
  }
}

function showError(msg) {
  if (errorContainer && errorText) {
    errorText.textContent = msg;
    errorContainer.classList.remove('hidden');
  }
}

function hideError() {
  if (errorContainer) errorContainer.classList.add('hidden');
}

// Render dynamic results
function renderResults(data) {
  if (!resultsContainer) return;
  resultsContainer.innerHTML = '';
  resultsContainer.classList.remove('hidden');

  const { content_type, author, stats, title, created_at, canonical_url, media } = data;

  // 1. Author & Overview
  resultsContainer.appendChild(createAuthorCard(author, stats, title, created_at, canonical_url));

  // 2. Media Section: Photos or Video
  if (content_type === 'images' && media.images && media.images.length > 0) {
    resultsContainer.appendChild(createPhotoCarouselSection(media.images, author.unique_id, data.id));
  } else if (content_type === 'live_photo') {
    const rawImgs = (media.live_photos && media.live_photos.length > 0)
      ? media.live_photos.map(lp => lp.image_url)
      : (media.images || []);
    resultsContainer.appendChild(createPhotoCarouselSection(rawImgs, author.unique_id, data.id));
  } else {
    // Single Video
    resultsContainer.appendChild(createVideoSection(media.video, author.unique_id, data.id));
  }

  // 3. Audio Track
  if (media.music && media.music.play_url) {
    resultsContainer.appendChild(createAudioSection(media.music, author.unique_id));
  }
}

// ------------------------------------------------------------------
// COMPONENT 1: Author & Title Card
// ------------------------------------------------------------------
function createAuthorCard(author, stats, title, createdAt, canonicalUrl) {
  const card = document.createElement('div');
  card.className = 'glass-panel rounded-2xl p-4 sm:p-5 shadow-xl';

  card.innerHTML = `
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        ${author.avatar ? `<img src="${author.avatar}" alt="${escapeHtml(author.nickname)}" class="w-12 h-12 rounded-full object-cover border border-zinc-700 bg-zinc-800" referrerpolicy="no-referrer">` : `<div class="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 border border-zinc-700">${author.unique_id?.[0]?.toUpperCase() || 'T'}</div>`}
        <div>
          <h3 class="font-bold text-white text-base">${escapeHtml(author.nickname || 'Creator')}</h3>
          <p class="text-xs text-zinc-400 font-mono">@${escapeHtml(author.unique_id || 'creator')}</p>
        </div>
      </div>

      <a href="${canonicalUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-850 hover:bg-zinc-750 rounded-lg transition-colors border border-zinc-750">
        <span>Xem trên TikTok</span>
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
      </a>
    </div>

    ${title ? `<div class="mt-3 text-sm text-zinc-200 leading-relaxed">${formatCaption(title)}</div>` : ''}
  `;

  return card;
}

// ------------------------------------------------------------------
// COMPONENT 2: Video Section (Clear Thumbnail Preview + Direct Actions)
// ------------------------------------------------------------------
function createVideoSection(video, authorHandle, postId) {
  const section = document.createElement('div');
  section.className = 'glass-panel rounded-2xl p-5 sm:p-6 shadow-xl';

  const downloadUrl = video.hd || video.no_watermark;
  const posterUrl = video.cover || video.dynamic_cover || '';

  section.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
      <!-- Visual Video Preview (Cover Poster & Player) -->
      <div class="md:col-span-5 flex justify-center">
        <div class="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[460px] w-full max-w-[280px] border border-zinc-800 shadow-2xl">
          <video
            src="${downloadUrl}"
            poster="${posterUrl}"
            controls
            playsinline
            loop
            preload="metadata"
            class="w-full h-full object-contain"
          ></video>
        </div>
      </div>

      <!-- Direct Action Controls -->
      <div class="md:col-span-7 flex flex-col justify-center space-y-4">
        <div>
          <span class="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            Đã xóa logo & watermark
          </span>
          <h2 class="text-xl font-bold text-white">Video không logo (MP4)</h2>
          <p class="text-xs text-zinc-400 mt-1">Xem trước video ở khung bên trái và bấm nút bên dưới để tải hoặc sao chép liên kết.</p>
        </div>

        <div class="space-y-3 pt-2">
          <!-- Big Download Button -->
          <button id="dl-video-btn" class="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#fe2c55] to-[#e01440] hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#fe2c55]/20 flex items-center justify-center gap-2 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Tải Video về máy</span>
          </button>

          <!-- Copy Stream Link Button -->
          <button id="copy-video-btn" class="w-full py-3 px-4 rounded-xl font-semibold text-sm text-zinc-200 bg-zinc-850 hover:bg-zinc-750 hover:text-white border border-zinc-700/80 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer">
            <svg class="w-4 h-4 text-[#25f4ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            <span>Sao chép link video</span>
          </button>
        </div>

        <!-- Direct CDN link box -->
        <div class="bg-zinc-950 border border-zinc-850 rounded-xl p-3 mt-2">
          <div class="text-[10px] font-mono uppercase text-zinc-500 mb-1">Link trực tiếp</div>
          <div class="text-xs font-mono text-zinc-400 truncate select-all">${downloadUrl}</div>
        </div>
      </div>
    </div>
  `;

  // Download
  section.querySelector('#dl-video-btn')?.addEventListener('click', () => {
    triggerFileDownload(downloadUrl, `tiktok_@${authorHandle}_${postId}_nowatermark.mp4`);
  });

  // Copy
  section.querySelector('#copy-video-btn')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(downloadUrl);
    if (ok) showToast('Đã sao chép link video vào bộ nhớ tạm!', 'success');
  });

  return section;
}

// ------------------------------------------------------------------
// COMPONENT 3: Photo Carousel Section (Images Preview + Bulk & Individual Downloads)
// ------------------------------------------------------------------
function createPhotoCarouselSection(images, authorHandle, postId) {
  const section = document.createElement('div');
  section.className = 'glass-panel rounded-2xl p-5 sm:p-6 shadow-xl';

  const totalCount = images.length;

  section.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-bold text-white">Album ảnh gốc</h2>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            ${totalCount} ảnh
          </span>
        </div>
        <p class="text-xs text-zinc-400 mt-0.5">Nhấp vào ảnh để xem to hoặc bấm nút tải từng ảnh / tải toàn bộ.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button id="copy-all-btn" class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-zinc-850 hover:bg-zinc-750 border border-zinc-700 rounded-xl transition-all cursor-pointer">
          <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span>Sao chép tất cả link</span>
        </button>

        <button id="zip-all-btn" class="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#fe2c55] to-pink-600 hover:brightness-110 active:scale-95 border border-pink-500/30 rounded-xl transition-all shadow-lg shadow-[#fe2c55]/20 cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          <span id="zip-btn-text">Tải tất cả (${totalCount} ảnh .ZIP)</span>
        </button>
      </div>
    </div>

    <!-- ZIP Progress -->
    <div id="zip-progress-container" class="hidden my-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
      <div class="flex justify-between items-center text-xs text-zinc-400 mb-1.5 font-medium">
        <span>Đang nén toàn bộ ảnh vào file ZIP...</span>
        <span id="zip-progress-text" class="font-mono text-zinc-200">0 / ${totalCount} (0%)</span>
      </div>
      <div class="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
        <div id="zip-progress-bar" class="bg-gradient-to-r from-[#fe2c55] to-[#25f4ee] h-full rounded-full transition-all duration-150" style="width: 0%"></div>
      </div>
    </div>

    <!-- Images Grid -->
    <div class="mt-6 gallery-grid" id="image-gallery-container"></div>
  `;

  // Copy all links
  section.querySelector('#copy-all-btn')?.addEventListener('click', async () => {
    const text = images.join('\n');
    const ok = await copyToClipboard(text);
    if (ok) showToast(`Đã sao chép toàn bộ ${totalCount} link ảnh!`, 'success');
  });

  // ZIP Download
  const zipBtn = section.querySelector('#zip-all-btn');
  const zipBtnText = section.querySelector('#zip-btn-text');
  const zipContainer = section.querySelector('#zip-progress-container');
  const zipText = section.querySelector('#zip-progress-text');
  const zipBar = section.querySelector('#zip-progress-bar');

  zipBtn?.addEventListener('click', async () => {
    if (state.isZipping) return;
    try {
      state.isZipping = true;
      zipBtn.disabled = true;
      zipBtnText.textContent = 'Đang nén ZIP...';
      zipContainer.classList.remove('hidden');

      const zip = new JSZip();
      const folder = zip.folder(`tiktok_${authorHandle}_photos`) || zip;

      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i];
        try {
          const res = await fetch(`/api/download?url=${encodeURIComponent(imgUrl)}&filename=image_${i + 1}.jpg`);
          if (res.ok) {
            const blob = await res.blob();
            folder.file(`photo_${String(i + 1).padStart(2, '0')}.jpg`, blob);
          }
        } catch (e) {
          console.warn(`Lỗi ảnh ${i + 1}`, e);
        }

        const pct = Math.round(((i + 1) / totalCount) * 100);
        zipBar.style.width = `${pct}%`;
        zipText.textContent = `${i + 1} / ${totalCount} (${pct}%)`;
      }

      zipText.textContent = 'Đang hoàn tất file...';
      const content = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `tiktok_@${authorHandle}_${postId}_photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      showToast(`Đã tải xong toàn bộ ${totalCount} ảnh!`, 'success');
    } catch (err) {
      showToast('Lỗi khi nén file ZIP: ' + err.message, 'error');
    } finally {
      state.isZipping = false;
      zipBtn.disabled = false;
      zipBtnText.textContent = `Tải tất cả (${totalCount} ảnh .ZIP)`;
      setTimeout(() => {
        zipContainer.classList.add('hidden');
        zipBar.style.width = '0%';
      }, 1500);
    }
  });

  // Render cards
  const gallery = section.querySelector('#image-gallery-container');
  images.forEach((imgUrl, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';

    card.innerHTML = `
      <div class="image-thumb-wrapper" data-lightbox-index="${index}">
        <img src="${imgUrl}" alt="Ảnh ${index + 1}" loading="lazy" referrerpolicy="no-referrer">
        <div class="image-badge">#${String(index + 1).padStart(2, '0')}</div>
      </div>

      <div class="image-actions">
        <button class="dl-single-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg transition-colors border border-zinc-700/60 cursor-pointer">
          <svg class="w-3.5 h-3.5 text-[#25f4ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          <span>Tải về</span>
        </button>

        <button class="copy-single-btn p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors cursor-pointer" title="Sao chép link">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        </button>

        <a href="${imgUrl}" target="_blank" rel="noopener noreferrer" class="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors" title="Mở ảnh gốc">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>
    `;

    card.querySelector('.image-thumb-wrapper').addEventListener('click', () => {
      openLightbox(index);
    });

    card.querySelector('.dl-single-btn').addEventListener('click', () => {
      triggerFileDownload(imgUrl, `tiktok_@${authorHandle}_${postId}_photo_${index + 1}.jpg`);
    });

    card.querySelector('.copy-single-btn').addEventListener('click', async () => {
      const ok = await copyToClipboard(imgUrl);
      if (ok) showToast(`Đã sao chép link ảnh #${index + 1}!`, 'success');
    });

    gallery.appendChild(card);
  });

  return section;
}

// ------------------------------------------------------------------
// COMPONENT 4: Background Audio Section
// ------------------------------------------------------------------
function createAudioSection(music, authorHandle) {
  const section = document.createElement('div');
  section.className = 'glass-panel rounded-2xl p-4 sm:p-5 shadow-xl';

  section.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
          ${music.cover ? `<img src="${music.cover}" alt="Sound cover" class="w-full h-full object-cover animate-spin-slow" referrerpolicy="no-referrer">` : `<svg class="w-5 h-5 text-[#25f4ee] animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>`}
        </div>
        <div>
          <div class="text-[11px] font-mono text-zinc-400">Nhạc nền</div>
          <h4 class="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">${escapeHtml(music.title || 'Original Sound')}</h4>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button id="copy-audio-btn" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-850 hover:bg-zinc-750 border border-zinc-750 rounded-lg transition-all cursor-pointer">
          <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span>Sao chép link nhạc</span>
        </button>

        <button id="dl-audio-btn" class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 active:scale-95 rounded-lg transition-all cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          <span>Tải MP3</span>
        </button>
      </div>
    </div>

    <div class="mt-3 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
      <audio src="${music.play_url}" controls class="w-full h-8 brightness-90 filter invert-[0.85] hue-rotate-180" preload="metadata"></audio>
    </div>
  `;

  section.querySelector('#copy-audio-btn')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(music.play_url);
    if (ok) showToast('Đã sao chép link nhạc nền!', 'success');
  });

  section.querySelector('#dl-audio-btn')?.addEventListener('click', () => {
    const cleanName = (music.title || 'audio').replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerFileDownload(music.play_url, `tiktok_audio_@${authorHandle}_${cleanName}.mp3`);
  });

  return section;
}

// ------------------------------------------------------------------
// Lightbox Implementation
// ------------------------------------------------------------------
function openLightbox(index) {
  const images = state.result?.media?.images || [];
  if (!images[index] || !lightboxModal) return;

  state.lightboxIndex = index;
  renderLightboxContent();
  lightboxModal.classList.remove('hidden');
}

function closeLightbox() {
  state.lightboxIndex = null;
  if (lightboxModal) lightboxModal.classList.add('hidden');
}

function navigateLightbox(step) {
  const images = state.result?.media?.images || [];
  if (!images.length || state.lightboxIndex === null) return;

  let next = state.lightboxIndex + step;
  if (next < 0) next = images.length - 1;
  if (next >= images.length) next = 0;

  state.lightboxIndex = next;
  renderLightboxContent();
}

function renderLightboxContent() {
  if (!lightboxModal || state.lightboxIndex === null) return;
  const images = state.result?.media?.images || [];
  const currentUrl = images[state.lightboxIndex];
  const authorHandle = state.result?.author?.unique_id || 'creator';
  const postId = state.result?.id || 'post';

  lightboxModal.innerHTML = `
    <div class="lightbox-overlay">
      <div class="flex items-center justify-between z-10 w-full max-w-7xl mx-auto">
        <span class="text-sm font-bold text-white bg-zinc-850 px-3 py-1 rounded-lg border border-zinc-700">
          Ảnh ${state.lightboxIndex + 1} / ${images.length}
        </span>

        <div class="flex items-center gap-2">
          <button id="lb-download-btn" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#fe2c55] hover:bg-[#e01440] rounded-lg transition-colors cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Tải ảnh</span>
          </button>
          <button id="lb-close-btn" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <div class="relative flex-1 flex items-center justify-center p-2 my-2 overflow-hidden">
        <img src="${currentUrl}" alt="Ảnh ${state.lightboxIndex + 1}" class="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl transition-all" referrerpolicy="no-referrer">

        ${images.length > 1 ? `
          <button id="lb-prev-btn" class="absolute left-2 sm:left-4 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 shadow-xl cursor-pointer">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <button id="lb-next-btn" class="absolute right-2 sm:right-4 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 shadow-xl cursor-pointer">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        ` : ''}
      </div>

      <div class="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-3xl mx-auto scrollbar-thin">
        ${images.map((url, i) => `
          <button class="lb-thumb-btn shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${state.lightboxIndex === i ? 'border-[#fe2c55] scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'} cursor-pointer" data-thumb-index="${i}">
            <img src="${url}" alt="Thumb ${i + 1}" class="w-full h-full object-cover" referrerpolicy="no-referrer">
          </button>
        `).join('')}
      </div>
    </div>
  `;

  lightboxModal.querySelector('#lb-close-btn')?.addEventListener('click', closeLightbox);
  lightboxModal.querySelector('#lb-prev-btn')?.addEventListener('click', () => navigateLightbox(-1));
  lightboxModal.querySelector('#lb-next-btn')?.addEventListener('click', () => navigateLightbox(1));
  lightboxModal.querySelector('#lb-download-btn')?.addEventListener('click', () => {
    triggerFileDownload(currentUrl, `tiktok_@${authorHandle}_${postId}_photo_${state.lightboxIndex + 1}.jpg`);
  });

  lightboxModal.querySelectorAll('.lb-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lightboxIndex = Number(btn.getAttribute('data-thumb-index'));
      renderLightboxContent();
    });
  });
}

// ------------------------------------------------------------------
// Utility Functions
// ------------------------------------------------------------------
async function triggerFileDownload(url, filename) {
  if (!url) return;
  showToast(`Đang chuẩn bị tải ${filename}...`, 'info');

  // Layer 1: Proxy streaming with blob verification
  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      if (!blob.type.includes('text/html') && blob.size > 500) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        showToast(`Đã tải xong ${filename}!`, 'success');
        return;
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy download failed, attempting device direct fetch...', proxyErr);
  }

  // Layer 2: Client device direct fetch (bypasses server geo-blocks)
  try {
    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      if (!blob.type.includes('text/html') && blob.size > 500) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        showToast(`Đã tải xong ${filename}!`, 'success');
        return;
      }
    }
  } catch (directErr) {
    console.warn('Device fetch blocked, opening clean tab...', directErr);
  }

  // Layer 3: Clean stream opening
  window.open(url, '_blank');
  showToast('Đang mở luồng video/ảnh trực tiếp trong tab mới.', 'info');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-notice');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notice';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function formatCaption(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/(#[a-zA-Z0-9_]+)/g, '<span class="text-[#25f4ee]">$1</span>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
