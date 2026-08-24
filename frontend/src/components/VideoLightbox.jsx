import React, { useEffect, useRef, useState } from "react";
import { Play, X, Loader } from "lucide-react";
import { useLang } from "../contexts/LanguageContext.jsx";

// Friendly, lightweight media player for vertical (9:16) destination videos.
// - Thumbnail uses the destination photo (poster), so no video bytes are
//   downloaded until the visitor actually presses play (preload="none").
// - The <video> element is only mounted once the lightbox is opened.
const VIDEO_ASPECT = "9 / 16";

export default function VideoLightbox({ videoUrl, poster, name }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  // Lock body scroll while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Stop playback + release resources whenever the lightbox closes.
  const close = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setOpen(false);
    setPlaying(false);
  };

  useEffect(() => {
    if (!open || !videoRef.current) return;
    const v = videoRef.current;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
    };
  }, [open]);

  return (
    <>
      {/* Thumbnail (poster from photo) — no video download until user clicks */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full overflow-hidden rounded-xl border border-line bg-ink/95 group"
        style={{ aspectRatio: VIDEO_ASPECT }}
        data-testid="video-launch"
        aria-label={name}
      >
        <img
          src={poster}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
        />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-cream">
          <span className="w-14 h-14 rounded-full bg-cream/90 text-ink flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-current translate-x-[1px]" />
          </span>
          <span className="text-[12px] tracking-wide uppercase font-semibold bg-ink/60 px-3 py-1 rounded-full backdrop-blur-sm">
            {t.media.playVideo}
          </span>
        </span>
      </button>

      {/* Lightbox / player */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 backdrop-blur-sm p-3"
          data-testid="video-lightbox"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={close}
            aria-label={t.media.close}
          />
          <div
            className="relative z-10 mx-auto"
            style={{
              // Fit 9:16 vertical video within the device viewport height.
              // width = (usable height) * 9/16, capped at 28rem on large screens.
              width: "min(100%, calc((100dvh - 7.5rem) * 9 / 16))",
              maxWidth: "28rem",
              aspectRatio: VIDEO_ASPECT,
            }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute -top-11 right-0 w-9 h-9 rounded-full bg-cream/90 text-ink flex items-center justify-center shadow"
              aria-label={t.media.close}
            >
              <X className="w-5 h-5" />
            </button>
            {!playing && (
              <Loader className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cream animate-spin" />
            )}
            <video
              ref={videoRef}
              src={videoUrl}
              poster={poster}
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="w-full h-full rounded-xl bg-black object-contain shadow-2xl"
              data-testid="video-player"
            />
          </div>
        </div>
      )}
    </>
  );
}
