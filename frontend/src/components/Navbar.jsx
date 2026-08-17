import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, LogOut, Shield, Palmtree, Languages } from "lucide-react";

export default function Navbar() {
  const { lang, toggle, t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAuth = user && typeof user === "object";
  const isAdmin = isAuth && user.role === "admin";

  const navItem = ({ isActive }) =>
    `px-4 py-2 rounded-full text-sm tracking-wide transition-all duration-300 ${
      isActive
        ? "text-sunset font-semibold shadow-neu-pressed"
        : "text-ink/80 hover:text-sunset"
    }`;

  return (
    <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8">
      <nav
        className="max-w-7xl mx-auto neu-raised rounded-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3"
        data-testid="main-navbar"
      >
        <Link
          to="/"
          className="flex items-center gap-2 pr-2 pl-2"
          data-testid="nav-logo"
        >
          <span className="w-9 h-9 rounded-full neu-inset flex items-center justify-center">
            <Palmtree className="w-5 h-5 text-sunset" strokeWidth={1.8} />
          </span>
          <span className="hidden sm:block font-display text-lg leading-none text-ink">
            Explore <span className="text-sunset italic">Sumut</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink to="/" end className={navItem} data-testid="nav-home">
            {t.nav.home}
          </NavLink>
          <NavLink to="/explore" className={navItem} data-testid="nav-explore">
            {t.nav.explore}
          </NavLink>
          <NavLink to="/planner" className={navItem} data-testid="nav-planner">
            <span className="hidden sm:inline">{t.nav.planner}</span>
            <span className="sm:hidden">AI</span>
          </NavLink>
          <NavLink to="/partners" className={navItem} data-testid="nav-partners">
            <span className="hidden md:inline">{t.nav.partners}</span>
            <span className="md:hidden">Mitra</span>
          </NavLink>
          {isAuth && (
            <NavLink to="/wishlist" className={navItem} data-testid="nav-wishlist">
              <span className="hidden sm:inline">{t.nav.wishlist}</span>
              <Heart className="w-4 h-4 sm:hidden" />
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navItem} data-testid="nav-admin">
              <span className="hidden sm:inline">{t.nav.admin}</span>
              <Shield className="w-4 h-4 sm:hidden" />
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-3 py-2 rounded-full text-xs font-semibold tracking-wider shadow-neu-sm hover:text-sunset transition-all flex items-center gap-1.5"
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
              className="px-4 py-2 rounded-full text-sm shadow-neu-sm hover:text-sunset transition-all flex items-center gap-2"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.logout}</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-full text-sm font-semibold shadow-neu-sm hover:text-sunset transition-all"
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
