import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Backend URL for building absolute image src
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ImageDropzone({ value = [], onChange }) {
  const { t } = useLang();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    const uploaded = [];
    for (const f of list) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: only image files allowed`);
        continue;
      }
      try {
        const url = await uploadFile(f);
        uploaded.push(url);
      } catch (e) {
        toast.error(`${f.name}: ${e.response?.data?.detail || "upload failed"}`);
      }
    }
    setUploading(false);
    if (uploaded.length) onChange([...(value || []), ...uploaded]);
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

  return (
    <div className="space-y-3" data-testid="image-dropzone">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl px-6 py-10 text-center transition-all ${
          dragging
            ? "shadow-neu-pressed text-sunset"
            : "shadow-neu-inset text-muted2 hover:text-sunset"
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
          <div className="flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t.upload.uploading}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="w-8 h-8" />
            <div className="text-sm">{t.upload.dragDrop}</div>
          </div>
        )}
      </div>

      {value && value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {value.map((url, i) => (
            <div
              key={i}
              className="relative group aspect-square rounded-xl overflow-hidden shadow-neu-sm"
              data-testid={`uploaded-thumb-${i}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-ink/70 text-sand flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`remove-thumb-${i}`}
                aria-label="remove"
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
