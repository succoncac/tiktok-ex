export type ContentType = 'video' | 'images' | 'live_photo' | 'profile';

export interface Author {
  id: string;
  unique_id: string;
  nickname: string;
  avatar: string;
  avatar_hd?: string;
  signature?: string;
  verified?: boolean;
}

export interface Stats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  downloads: number;
}

export interface MusicInfo {
  id: string;
  title: string;
  author: string;
  play_url: string;
  cover: string;
  duration?: number;
}

export interface VideoData {
  no_watermark: string;
  hd: string;
  watermarked: string;
  size: number;
  hd_size: number;
  duration: number;
  cover: string;
  dynamic_cover?: string;
}

export interface LivePhotoItem {
  index: number;
  image_url: string;
  motion_preview: string;
}

export interface MediaPayload {
  video: VideoData;
  images: string[];
  live_photos: LivePhotoItem[];
  music: MusicInfo;
}

export interface ProfileVideoItem {
  id: string;
  title: string;
  cover: string;
  duration: number;
  play: string;
  hdplay?: string;
  wmplay?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  created_at: string;
  images?: string[];
}

export interface UserProfileData {
  followers: number;
  following: number;
  hearts: number;
  video_count: number;
  signature?: string;
}

export interface ExtractionResult {
  success: boolean;
  content_type: ContentType;
  id: string;
  title: string;
  images_count?: number;
  created_at: string;
  canonical_url: string;
  author: Author;
  stats: Stats;
  media?: MediaPayload;
  profile?: UserProfileData;
  profile_videos?: ProfileVideoItem[];
  error?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  content_type: ContentType;
  author: string;
  avatar: string;
  cover: string;
  canonical_url: string;
  extracted_at: number;
  result: ExtractionResult;
}
