import React from "react";
import { NavLink } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext.jsx";
import { BookOpen, Handshake, Home, Map, User } from "lucide-react";

const ITEMS = [
  { to: "/", icon: Home, key: "home", testId: "bottomnav-home", end: true, label: t => t.nav.home },
  { to: "/explore", icon: Map, key: "destinations", testId: "bottomnav-destinations", label: t => t.nav.destinations },
  { to: "/docs", icon: BookOpen, key: "docs", testId: "bottomnav-docs", label: t => t.nav.docs },
  { to: "/partners", icon: Handshake, key: "partners", testId: "bottomnav-partners", label: t => t.nav.partners },
  { to: "/profile", icon: User, key: "profile", testId: "bottomnav-profile", label: t => t.nav.profile },
];

export default function BottomNav() {
  const { t } = useLang();

  return (
    <nav className="fixed z-50 md:hidden" style={{ bottom: "max(0.625rem, env(safe-area-inset-bottom))", left: "max(0.625rem, env(safe-area-inset-left))", right: "max(0.625rem, env(safe-area-inset-right))" }} data-testid="bottom-nav" aria-label={t.nav.mobileNavigation || t.nav.home}>
      <div className="overflow-hidden rounded-2xl border border-line/70 bg-white/90 shadow-[0_12px_34px_rgba(15,61,62,0.20)] backdrop-blur-xl">
        <div className="grid grid-cols-5 px-1 py-1.5 min-[360px]:px-2 min-[360px]:py-2">
          {ITEMS.map(({ to, icon: Icon, key, testId, label }) => (
            <NavLink
              key={key}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                `flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-semibold transition-colors duration-200 min-[360px]:text-[11px] ${
                  isActive ? "text-toba" : "text-inkSoft/70 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isActive ? "scale-110" : "scale-100"
                    }`}
                    strokeWidth={isActive ? 2.5 : 1.7}
                  />
                  <span className="w-full truncate text-center leading-tight">{label(t)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
