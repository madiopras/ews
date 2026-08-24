import React, { useEffect, useState } from "react";
import {
  Bot,
  ChevronDown,
  CircleGauge,
  CreditCard,
  ExternalLink,
  FileClock,
  Handshake,
  LayoutDashboard,
  Mail,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  ScrollText,
  Scale,
  Settings2,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext.jsx";
import logoImage from "../../logoews.png";

function NavItem({ item, collapsed, onNavigate, nested = false }) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div
        className={`min-h-[44px] rounded-lg flex items-center gap-3 text-cream/40 cursor-not-allowed ${nested ? "pl-10 pr-3" : "px-3"} ${collapsed ? "justify-center px-0" : ""}`}
        title={collapsed ? item.label : undefined}
        aria-disabled="true"
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span className="text-[13px] flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cream/10">{item.badge}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `min-h-[44px] rounded-lg flex items-center gap-3 transition-colors ${nested ? "pl-10 pr-3" : "px-3"} ${collapsed ? "justify-center px-0" : ""} ${
          isActive
            ? "bg-cream text-toba font-semibold"
            : "text-cream/70 hover:text-cream hover:bg-cream/10"
        }`
      }
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {!collapsed && <span className="text-[13px] flex-1 truncate">{item.label}</span>}
    </NavLink>
  );
}

function NavGroup({ group, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = pathname.startsWith(group.prefix);
  const [open, setOpen] = useState(active);
  const Icon = group.icon;

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const handleGroupClick = () => {
    if (collapsed) {
      navigate(group.children.find((item) => !item.disabled)?.to || group.prefix);
      onNavigate?.();
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleGroupClick}
        className={`w-full min-h-[44px] px-3 rounded-lg flex items-center gap-3 transition-colors ${collapsed ? "justify-center px-0" : ""} ${active ? "bg-cream/15 text-cream" : "text-cream/70 hover:text-cream hover:bg-cream/10"}`}
        aria-expanded={!collapsed && open}
        title={collapsed ? group.label : undefined}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span className="text-[13px] font-medium flex-1 text-left">{group.label}</span>}
        {!collapsed && <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {!collapsed && open && (
        <div className="mt-1 space-y-1">
          {group.children.map((item) => <NavItem key={item.to || item.label} item={item} nested onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

export default function AdminSidebar({ mobile = false, collapsed = false, onClose, onNavigate, onToggleCollapsed }) {
  const { t } = useLang();
  const copy = t.admin.shell;
  const mainItems = [
    { to: "/admin/dashboard", label: copy.dashboard, icon: LayoutDashboard, end: true },
    { to: "/admin/destinations", label: copy.destinations, icon: MapPinned },
    { to: "/admin/partners", label: copy.partners, icon: Handshake },
    { to: "/admin/plans", label: copy.plans, icon: CreditCard },
    { to: "/admin/users", label: copy.users, icon: UsersRound },
    { to: "/admin/governance", label: copy.governance, icon: Scale },
  ];
  const groups = [
    {
      label: copy.settings,
      icon: Settings2,
      prefix: "/admin/settings",
      children: [
        { to: "/admin/settings/general", label: copy.general, icon: SlidersHorizontal },
        { to: "/admin/settings/integrations", label: copy.integrations, icon: PlugZap },
        { to: "/admin/settings/llm", label: copy.llm, icon: Bot },
        { to: "/admin/settings/email-templates", label: copy.emailTemplates, icon: Mail },
        { to: "/admin/settings/backups", label: copy.backups, icon: CircleGauge },
      ],
    },
    {
      label: copy.logs,
      icon: ScrollText,
      prefix: "/admin/logs",
      children: [
        { to: "/admin/logs/audit", label: copy.auditTrail, icon: FileClock },
        { to: "/admin/logs/ai-planner", label: copy.aiPlanner, icon: Bot },
        { to: "/admin/logs/system", label: copy.systemLogs, icon: ScrollText },
      ],
    },
  ];

  return (
    <aside
      id={mobile ? "admin-mobile-sidebar" : "admin-desktop-sidebar"}
      className={`h-full bg-tobaDeep text-cream border-r border-white/10 flex flex-col ${mobile ? "w-[min(88vw,288px)] shadow-2xl" : collapsed ? "w-20" : "w-72"}`}
      aria-label={copy.adminNavigation}
    >
      <div className={`h-16 border-b border-white/10 flex items-center ${collapsed && !mobile ? "justify-center px-2" : "px-4 gap-3"}`}>
        <Link to="/admin/dashboard" onClick={onNavigate} className="flex items-center gap-3 min-w-0 flex-1" title={copy.controlCenter}>
          <span className="w-9 h-9 rounded-lg bg-cream text-toba flex items-center justify-center shrink-0 overflow-hidden">
            <img src={logoImage} alt="Logo" className="w-full h-full object-cover" />
          </span>
          {(!collapsed || mobile) && (
            <span className="min-w-0">
              <span className="font-display text-[16px] block truncate">Explore Sumut</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-cream/50 block truncate">{copy.controlCenter}</span>
            </span>
          )}
        </Link>
        {mobile ? (
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-lg flex items-center justify-center text-cream/70 hover:text-cream hover:bg-white/10" aria-label={copy.closeMenu}>
            <X className="w-5 h-5" />
          </button>
        ) : !collapsed ? (
          <button type="button" onClick={onToggleCollapsed} className="w-10 h-10 rounded-lg flex items-center justify-center text-cream/60 hover:text-cream hover:bg-white/10" aria-label={copy.collapseMenu}>
            <PanelLeftClose className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {!collapsed && <div className="px-3 pb-2 text-[9px] uppercase tracking-[0.18em] text-cream/40">{copy.overview}</div>}
        {mainItems.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed && !mobile} onNavigate={onNavigate} />)}
        {!collapsed && <div className="px-3 pt-5 pb-2 text-[9px] uppercase tracking-[0.18em] text-cream/40">{copy.system}</div>}
        {groups.map((group) => <NavGroup key={group.prefix} group={group} collapsed={collapsed && !mobile} onNavigate={onNavigate} />)}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          to="/"
          onClick={onNavigate}
          className={`min-h-[44px] rounded-lg flex items-center gap-3 text-cream/70 hover:text-cream hover:bg-white/10 ${collapsed && !mobile ? "justify-center px-0" : "px-3"}`}
          title={collapsed && !mobile ? copy.backToSite : undefined}
        >
          <ExternalLink className="w-[18px] h-[18px] shrink-0" />
          {(!collapsed || mobile) && <span className="text-[12px]">{copy.backToSite}</span>}
        </Link>
        {!mobile && collapsed && (
          <button type="button" onClick={onToggleCollapsed} className="w-full min-h-[44px] rounded-lg flex items-center justify-center text-cream/70 hover:text-cream hover:bg-white/10" aria-label={copy.expandMenu}>
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>
    </aside>
  );
}
