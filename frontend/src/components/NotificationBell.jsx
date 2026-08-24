import React, { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";

export default function NotificationBell() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef(null);
  const copy = lang === "en" ? { label: "Notifications", empty: "No notifications.", read: "Mark as read" } : { label: "Notifikasi", empty: "Belum ada notifikasi.", read: "Tandai dibaca" };
  useEffect(() => { const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const toggle = async () => { const next = !open; setOpen(next); if (next && !loaded) { try { const { data } = await api.get("/notifications"); setItems(data); } catch { setItems([]); } setLoaded(true); } };
  const markRead = async item => { try { await api.patch(`/notifications/${item.id}/read`); setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)); } catch { /* notification remains unread */ } };
  const unread = items.filter(item => !item.read_at).length;
  return <div className="relative" ref={rootRef}><button type="button" onClick={toggle} className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-inkSoft" aria-label={copy.label} aria-expanded={open}><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600" />}</button>{open && <div className="absolute right-0 top-12 z-[80] w-[min(90vw,360px)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"><div className="border-b border-line px-4 py-3 text-sm font-semibold">{copy.label}</div><div className="max-h-96 overflow-y-auto">{!loaded ? <div className="p-4 text-xs text-inkSoft">{t.common.loading}</div> : items.length === 0 ? <div className="p-4 text-xs text-inkSoft">{copy.empty}</div> : items.map(item => <article key={item.id} className={`border-b border-line p-4 last:border-0 ${item.read_at ? "opacity-65" : ""}`}><div className="text-xs font-semibold">{item.title}</div><p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-inkSoft">{item.body}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-inkSoft">{new Date(item.created_at).toLocaleString()}</span>{!item.read_at && <button type="button" onClick={() => markRead(item)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-toba"><Check className="h-3 w-3" />{copy.read}</button>}</div></article>)}</div></div>}</div>;
}
