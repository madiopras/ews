import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, LogOut, Shield, Mountain, Languages, Sparkles } from "lucide-react";

export default function Navbar() {
  const { lang, toggle, t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAuth = user && typeof user === "object";
  const isAdmin = isAuth && user.role === "admin";

  const navItem = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
      isActive ? "text-toba font-semibold bg-line/40" : "text-inkSoft hover:text-toba"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3"
        data-testid="main-navbar"
      >
        <Link to="/" className="flex items-center gap-2 min-h-[44px]" data-testid="nav-logo">
          <span className="w-8 h-8 rounded-lg bg-toba flex items-center justify-center">
            <Mountain className="w-4 h-4 text-cream" strokeWidth={2} />
          </span>
          <span className="font-display text-base md:text-lg leading-none text-ink">
            Explore <span className="italic text-toba">Sumut</span>
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
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile: quick access to AI planner */}
          <Link
            to="/planner"
            className="md:hidden inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-line text-[13px] font-semibold text-toba"
            data-testid="nav-planner-mobile"
          >
            <Sparkles className="w-4 h-4" /> AI
          </Link>

          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-line text-[13px] font-semibold text-inkSoft hover:text-toba transition-colors"
            data-testid="lang-toggle"
            aria-label="Toggle language"
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
