import React from "react";
import { NavLink } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { Home, Map, Handshake, User } from "lucide-react";

const ITEMS = [
  { to: "/", icon: Home, key: "home", testId: "bottomnav-home", end: true },
  { to: "/explore", icon: Map, key: "destinations", testId: "bottomnav-explore" },
  { to: "/partners", icon: Handshake, key: "partners", testId: "bottomnav-partners" },
  { to: "/profile", icon: User, key: "profile", testId: "bottomnav-profile" },
];

export default function BottomNav() {
  const { t } = useLang();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-4">
        {ITEMS.map(({ to, icon: Icon, key, testId, end }) => (
          <NavLink
            key={key}
            to={to}
            end={end}
            data-testid={testId}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[11px] font-semibold transition-colors ${
                isActive ? "text-toba" : "text-inkSoft"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.7} />
                <span>{t.nav[key]}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
