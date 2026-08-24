import React from "react";
import { NavLink } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext.jsx";
import { Home, Sparkles, Map, Handshake, User } from "lucide-react";

const ITEMS = [
  { to: "/", icon: Home, key: "home", testId: "bottomnav-home", end: true, label: t => t.nav.home },
  { to: "/planner", icon: Sparkles, key: "aiPlanner", testId: "bottomnav-planner", label: () => "AI Planner" },
  { to: "/explore", icon: Map, key: "destinations", testId: "bottomnav-destinations", label: t => t.nav.destinations },
  { to: "/partners", icon: Handshake, key: "partners", testId: "bottomnav-partners", label: t => t.nav.partners },
  { to: "/profile", icon: User, key: "profile", testId: "bottomnav-profile", label: t => t.nav.profile },
];

export default function BottomNav() {
  const { t } = useLang();

  return (
    <nav className="md:hidden fixed z-50 mx-2" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", left: "max(0.5rem, env(safe-area-inset-left))", right: "max(0.5rem, env(safe-area-inset-right))" }} data-testid="bottom-nav" aria-label={t.nav.mobileNavigation || t.nav.home}>
      <div className="rounded-2xl bg-white/50 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-5 py-2 px-4">
          {ITEMS.map(({ to, icon: Icon, key, testId, label }) => (
            <NavLink
              key={key}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 min-h-[48px] text-[11px] font-semibold transition-all duration-200 ${
                  isActive ? "text-toba" : "text-inkSoft/70 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 transition-all duration-200 ${
                      isActive ? "scale-110" : "scale-100"
                    }`}
                    strokeWidth={isActive ? 2.5 : 1.7}
                  />
                  <span className="leading-tight">{label(t)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
