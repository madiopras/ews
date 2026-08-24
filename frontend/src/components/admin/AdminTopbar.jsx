import React from "react";
import { Languages, LogOut, Menu, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useLang } from "../../contexts/LanguageContext.jsx";
import AdminBreadcrumbs from "./AdminBreadcrumbs.jsx";

export default function AdminTopbar({ onOpenNavigation, navigationButtonRef }) {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useLang();
  const navigate = useNavigate();
  const copy = t.admin.shell;

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-line bg-cream/95 backdrop-blur">
      <div className="h-full px-4 sm:px-6 xl:px-8 flex items-center gap-3 sm:gap-5">
        <button
          ref={navigationButtonRef}
          type="button"
          onClick={onOpenNavigation}
          className="lg:hidden w-11 h-11 -ml-1 rounded-lg border border-line bg-surface flex items-center justify-center text-inkSoft hover:text-toba"
          aria-label={copy.openMenu}
          aria-controls="admin-mobile-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <AdminBreadcrumbs />
        </div>

        <button
          type="button"
          onClick={toggle}
          className="min-h-[44px] px-3 rounded-lg border border-line bg-surface inline-flex items-center gap-2 text-[12px] font-semibold text-inkSoft hover:text-toba"
          aria-label={copy.changeLanguage}
        >
          <Languages className="w-4 h-4" />
          {lang.toUpperCase()}
        </button>

        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-full bg-toba text-cream flex items-center justify-center shrink-0">
            <UserRound className="w-4 h-4" />
          </span>
          <div className="hidden xl:block min-w-0 max-w-48">
            <div className="text-[12px] font-semibold truncate">{user?.name || "Admin"}</div>
            <div className="text-[10px] text-inkSoft truncate">{user?.email || ""}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-11 h-11 rounded-lg border border-line bg-surface flex items-center justify-center text-inkSoft hover:text-red-700"
          aria-label={t.nav.logout}
          title={t.nav.logout}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
