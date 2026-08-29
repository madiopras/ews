import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LogOut, Languages } from "lucide-react";
import logoImage from "../logoews.png";
import NotificationBell from "./NotificationBell.jsx";

export default function Navbar() {
  const { lang, toggle, t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAuth = user && typeof user === "object";
  const isAdmin = isAuth && user.role === "admin";
  const isPartner = isAuth && user.role === "partner";

  const navItem = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
      isActive ? "text-toba font-semibold bg-line/40" : "text-inkSoft hover:text-toba"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav
        className="app-gutter mx-auto flex h-14 max-w-7xl min-w-0 items-center justify-between gap-2 md:h-16 md:gap-3"
        data-testid="main-navbar"
      >
        <Link to="/" className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 md:flex-none" data-testid="nav-logo">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-toba">
            <img src={logoImage} alt="Logo" className="w-full h-full object-cover" />
          </span>
          <span className="min-w-0 truncate font-display text-sm leading-none text-ink min-[360px]:text-base md:text-lg">
            <span className="italic text-toba">Explore Wisata Sumut</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={navItem} data-testid="nav-home">
            {t.nav.home}
          </NavLink>
          <NavLink to="/explore" className={navItem} data-testid="nav-explore">
            {t.nav.destinations}
          </NavLink>
          <NavLink to="/planner" className={navItem} data-testid="nav-planner">
            {t.nav.planner}
          </NavLink>
          <Link to="/docs" className="px-3 py-2 rounded-lg text-sm transition-colors duration-200 text-inkSoft hover:text-toba font-medium">
            {t.nav.docs}
          </Link>
          <NavLink to="/partners" className={navItem} data-testid="nav-partners">
            {t.nav.partners}
          </NavLink>
          {isAuth && (
            <NavLink to="/wishlist" className={navItem} data-testid="nav-wishlist">
              {t.nav.wishlist}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navItem} data-testid="nav-admin">
              {t.nav.admin}
            </NavLink>
          )}
          {isPartner && (
            <NavLink to="/mitra" className={navItem} data-testid="nav-mitra">
              {t.nav.mitra}
            </NavLink>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isAuth && <NotificationBell />}
          {/* Mobile: just language toggle */}
          <button
            onClick={toggle}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] font-semibold text-inkSoft transition-colors hover:text-toba sm:gap-1.5 sm:px-3 sm:text-[13px]"
            data-testid="lang-toggle"
            aria-label={t.common.toggleLanguage}
          >
            <Languages className="w-4 h-4" />
            <span>{lang.toUpperCase()}</span>
          </button>

          {isAuth ? (
            <button
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              className="hidden md:inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-line text-sm text-inkSoft hover:text-toba transition-colors"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              {t.nav.logout}
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center min-h-[44px] px-4 rounded-lg border border-line text-sm font-semibold text-ink hover:border-toba transition-colors"
              data-testid="nav-login"
            >
              {t.nav.login}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
