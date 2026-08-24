import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar.jsx";
import AdminTopbar from "../components/admin/AdminTopbar.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const mobilePanelRef = useRef(null);
  const navigationButtonRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("admin_sidebar_collapsed") === "true");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = navigationButtonRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      mobilePanelRef.current?.querySelector("button, a")?.focus();
    });
    const handleKeyboard = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobilePanelRef.current) return;
      const focusable = Array.from(mobilePanelRef.current.querySelectorAll("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyboard);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyboard);
      trigger?.focus();
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-cream" data-testid="admin-layout">
      <div className={`hidden lg:block fixed inset-y-0 left-0 z-40 transition-[width] duration-200 ${collapsed ? "w-20" : "w-72"}`}>
        <AdminSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="presentation">
          <div
            className="absolute inset-0 w-full h-full bg-black/50 backdrop-blur-[1px] sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div ref={mobilePanelRef} className="absolute inset-y-0 left-0 sidebar-slide" role="dialog" aria-modal="true" aria-label={t.admin.shell.adminNavigation}>
            <AdminSidebar
              mobile
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className={`min-h-screen min-w-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <AdminTopbar onOpenNavigation={() => setMobileOpen(true)} navigationButtonRef={navigationButtonRef} />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
