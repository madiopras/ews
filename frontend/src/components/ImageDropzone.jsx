import React, { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { UploadCloud, X, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const MAX_EDGE = 1600;
export const MAX_IMAGES = 5;

// Downscale + convert to WebP in the browser so mobile visitors load lighter images.
async function compressImage(file) {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.82));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}

export default function ImageDropzone({ value = [], onChange, maxImages = MAX_IMAGES }) {
  const { t } = useLang();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return `${BACKEND_URL}${data.url}`;
  };

  const handleFiles = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    const remaining = maxImages - (value?.length || 0);
    if (remaining <= 0) {
      toast.error(t.upload.maxImages);
      return;
    }
    const toProcess = list.slice(0, remaining);
    if (list.length > remaining) {
      toast.warning(
        `${t.upload.maxImagesReached} ${t.upload.maxImages}: ${maxImages}`
      );
    }
    setUploading(true);
    const uploaded = [];
    for (const f of toProcess) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: ${t.upload.onlyImages}`);
        continue;
      }
      try {
        let payload = f;
        try {
          payload = await compressImage(f);
        } catch {
          payload = f;
        }
        const url = await uploadFile(payload);
        uploaded.push(url);
      } catch (e) {
        toast.error(`${f.name}: ${e.response?.data?.detail || t.upload.failed}`);
      }
    }
    setUploading(false);
    if (uploaded.length) onChange([...(value || []), ...uploaded]);
  };

  const addByLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if ((value?.length || 0) >= maxImages) {
      toast.error(t.upload.maxImages);
      return;
    }
    // Basic URL sanity check
    try {
      new URL(url);
    } catch {
      toast.error(t.upload.invalidUrl);
      return;
    }
    onChange([...(value || []), url]);
    setLinkInput("");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const remove = (idx) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const openPicker = () => {
    if ((value?.length || 0) >= maxImages) {
      toast.error(t.upload.maxImages);
      return;
    }
    inputRef.current?.click();
  };

  return (
    <div className="space-y-3" data-testid="image-dropzone">
      <div className="text-[12px] text-inkSoft">
        {t.upload.count}: {value?.length || 0}/{maxImages}
      </div>

      {/* Add by link */}
      <div className="flex gap-2" data-testid="image-link-input">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkSoft" />
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addByLink();
              }
            }}
            placeholder={t.upload.linkPlaceholder}
            disabled={(value?.length || 0) >= maxImages}
            className="input-flat pl-9"
            data-testid="image-link-input-field"
          />
        </div>
        <button
          type="button"
          onClick={addByLink}
          disabled={(value?.length || 0) >= maxImages}
          className="btn-outline shrink-0"
          data-testid="image-link-add"
        >
          {t.upload.add}
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={(value?.length || 0) >= maxImages}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-lg border border-dashed px-6 py-8 text-center transition-colors ${
          (value?.length || 0) >= maxImages
            ? "border-line/40 text-inkSoft/50 cursor-not-allowed"
            : dragging
            ? "border-toba text-toba bg-toba/5"
            : "border-line text-inkSoft hover:border-toba"
        }`}
        data-testid="dropzone-area"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="dropzone-input"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-[13px]">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t.upload.uploading}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="w-7 h-7" />
            <div className="text-[13px]">
              {(value?.length || 0) >= maxImages ? t.upload.maxImages : t.upload.dragDrop}
            </div>
          </div>
        )}
      </div>

      {value && value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {value.map((url, i) => (
            <div
              key={i}
              className="relative group aspect-square rounded-lg overflow-hidden border border-line"
              data-testid={`uploaded-thumb-${i}`}
            >
              <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-ink/70 text-cream flex items-center justify-center"
                data-testid={`remove-thumb-${i}`}
                aria-label={t.upload.remove}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
