import React, { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, Globe2, Languages, LayoutDashboard, LogOut, Menu, UserPlus, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import logoImage from "../logoews.png";

function MitraNavigation({ onNavigate }) {
  const { t } = useLang();
  const items = [
    { to: "/mitra", end: true, label: t.mitra.dashboard, icon: LayoutDashboard },
    { to: "/mitra/onboarding", label: t.mitra.onboarding, icon: UserPlus },
  ];
  return (
    <aside className="h-full w-[min(88vw,272px)] bg-tobaDeep text-cream flex flex-col" aria-label={t.mitra.navigation}>
      <Link to="/mitra" onClick={onNavigate} className="h-16 px-4 flex items-center gap-3 border-b border-white/10">
        <span className="w-9 h-9 rounded-lg bg-cream text-toba flex items-center justify-center overflow-hidden"><img src={logoImage} alt="Logo" className="w-full h-full object-cover" /></span>
        <span><span className="block font-display">Explore Sumut</span><span className="block text-[9px] uppercase tracking-[0.18em] text-cream/50">{t.mitra.workspace}</span></span>
      </Link>
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `min-h-[44px] px-3 rounded-lg flex items-center gap-3 text-[13px] ${isActive ? "bg-cream text-toba font-semibold" : "text-cream/70 hover:bg-white/10 hover:text-cream"}`}>
            <Icon className="w-[18px] h-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <Link to="/" onClick={onNavigate} className="m-3 min-h-[44px] px-3 rounded-lg flex items-center gap-3 text-[12px] text-cream/70 hover:bg-white/10"><Globe2 className="w-[18px] h-[18px]" /> {t.mitra.backToWebsite}</Link>
    </aside>
  );
}

export default function MitraLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, lang, toggle } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector("a")?.focus();
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [mobileOpen]);

  const signOut = async () => { await logout(); navigate("/", { replace: true }); };
  return (
    <div className="min-h-screen bg-cream" data-testid="mitra-layout">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40 w-[272px]"><MitraNavigation /></div>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 w-full h-full bg-black/50" onClick={() => setMobileOpen(false)} aria-label={t.mitra.closeNavigation} /><div ref={panelRef} className="relative h-full w-fit"><MitraNavigation onNavigate={() => setMobileOpen(false)} /><button type="button" onClick={() => setMobileOpen(false)} className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-cream" aria-label={t.mitra.closeNavigation}><X className="w-5 h-5" /></button></div></div>}
      <div className="min-h-screen lg:pl-[272px]">
        <header className="sticky top-0 z-30 h-16 border-b border-line bg-cream/95 backdrop-blur px-4 sm:px-6 flex items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden w-11 h-11 rounded-lg border border-line bg-surface flex items-center justify-center" aria-label={t.mitra.openNavigation}><Menu className="w-5 h-5" /></button>
          <BriefcaseBusiness className="hidden sm:block w-5 h-5 text-toba" />
          <div className="flex-1 min-w-0"><div className="text-[11px] text-inkSoft">{t.mitra.workspace}</div><div className="text-[13px] font-semibold truncate">{user?.name}</div></div>
          <button type="button" onClick={toggle} className="min-h-[44px] px-3 rounded-lg border border-line bg-surface inline-flex items-center gap-2 text-[12px] font-semibold"><Languages className="w-4 h-4" /> {lang.toUpperCase()}</button>
          <NotificationBell />
          <button type="button" onClick={signOut} className="w-11 h-11 rounded-lg border border-line bg-surface flex items-center justify-center text-inkSoft hover:text-red-700" aria-label={t.nav.logout}><LogOut className="w-4 h-4" /></button>
        </header>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
