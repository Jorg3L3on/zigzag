'use client';

import { useState } from 'react';
import type { GuideVideo } from '@/components/ayuda/guide-registry';

/** Privacy-enhanced host: no YouTube cookies until the person plays the video. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

export const youtubeEmbedSrc = (id: string) =>
  `${YOUTUBE_EMBED_ORIGIN}/embed/${id}?autoplay=1&rel=0&playsinline=1`;

export const youtubeThumbnailSrc = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const youtubeWatchHref = (id: string) => `https://youtu.be/${id}`;

const PlayIcon = () => (
  <svg viewBox="0 0 68 48" width="68" height="48" aria-hidden className="drop-shadow-md">
    <path
      d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z"
      fill="var(--pt-ink)"
      fillOpacity="0.86"
    />
    <path d="M45 24 27 14v20z" fill="var(--pt-ground)" />
  </svg>
);

/**
 * One tutorial: the thumbnail with a play button until it is tapped, then the
 * player in place (ZIG-40). Nothing loads from YouTube's player before that.
 */
const VideoCard = ({ video }: { video: GuideVideo }) => {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="m-0 flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-[rgba(23,20,15,0.14)] bg-[var(--pt-ink)]">
        {playing ? (
          <iframe
            src={youtubeEmbedSrc(video.youtubeId)}
            title={video.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Ver video: ${video.title}`}
            className="group absolute inset-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, not worth next/image config */}
            <img
              src={youtubeThumbnailSrc(video.youtubeId)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="relative transition-transform duration-200 group-hover:scale-110">
              <PlayIcon />
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">{video.label}</span>
        <a
          href={youtubeWatchHref(video.youtubeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--pt-muted)] underline-offset-4 hover:text-[var(--pt-accent)]"
        >
          Abrir en YouTube
        </a>
      </figcaption>
    </figure>
  );
};

/** «Míralo en video» block under the guide intro. */
export const GuideVideos = ({ videos }: { videos: GuideVideo[] }) => (
  <section aria-labelledby="ayuda-videos-h" className="flex flex-col gap-4" data-testid="ayuda-videos">
    <h2
      id="ayuda-videos-h"
      className="m-0 font-[family-name:var(--font-marketing-mono)] text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-accent)]"
    >
      Míralo en video
    </h2>
    <div className="flex flex-wrap gap-x-5 gap-y-6">
      {videos.map((video) => (
        <VideoCard key={video.youtubeId} video={video} />
      ))}
    </div>
  </section>
);
