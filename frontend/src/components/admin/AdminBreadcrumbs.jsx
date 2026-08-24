import React from "react";
import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function AdminBreadcrumbs() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const copy = t.admin.shell;
  const labels = {
    dashboard: copy.dashboard,
    destinations: copy.destinations,
    partners: copy.partners,
    plans: copy.plans,
    users: copy.users,
    settings: copy.settings,
    general: copy.general,
    integrations: copy.integrations,
    llm: copy.llm,
    "email-templates": copy.emailTemplates,
    backups: copy.backups,
    logs: copy.logs,
    audit: copy.auditTrail,
    "ai-planner": copy.aiPlanner,
    system: copy.systemLogs,
    new: copy.newItem,
    edit: copy.editItem,
  };
  const segments = pathname.split("/").filter(Boolean).slice(1);

  return (
    <nav aria-label={copy.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1 text-[12px] sm:text-[13px] min-w-0">
        <li className="shrink-0">
          <Link to="/admin/dashboard" className="text-inkSoft hover:text-toba transition-colors">
            Admin
          </Link>
        </li>
        {segments.map((segment, index) => {
          const to = `/admin/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const isIdentifier = /^[a-f\d]{24}$/i.test(segment);
          const label = isIdentifier ? copy.item : (labels[segment] || segment);
          return (
            <React.Fragment key={to}>
              <li aria-hidden="true" className="text-inkSoft/50 shrink-0">
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li className="min-w-0">
                {isLast ? (
                  <span className="font-semibold text-ink block truncate" aria-current="page">
                    {label}
                  </span>
                ) : (
                  <Link to={to} className="text-inkSoft hover:text-toba transition-colors block truncate">
                    {label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
