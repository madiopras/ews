import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Handshake, MapPin, Route, Sparkles, Users } from "lucide-react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="card-flat p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.12em] text-inkSoft">{label}</div>
          <div className="font-display text-3xl mt-2">{value}</div>
          <div className="text-[12px] text-inkSoft mt-1">{detail}</div>
        </div>
        <span className="w-10 h-10 rounded-xl bg-toba/10 text-toba flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { lang, t } = useLang();
  const copy = t.admin.dashboard;
  const { data, error, isPending } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get("/admin/dashboard").then((response) => response.data),
    staleTime: 45_000,
  });

  if (error) return <div className="card-flat p-5 text-red-700" data-testid="admin-dashboard">{error.response?.data?.detail || copy.loadError}</div>;
  if (isPending || !data) return <div className="text-inkSoft text-[13px]" data-testid="admin-dashboard">{t.common.loading}</div>;

  const metrics = [
    { icon: MapPin, label: copy.destinations, value: data.destinations.active, detail: `${data.destinations.total} ${copy.total}` },
    { icon: Handshake, label: copy.partners, value: data.partners.active, detail: `${data.partners.pending} ${copy.pending}` },
    { icon: Users, label: copy.users, value: data.users.active, detail: `${data.users.new_30d} ${copy.newUsers}` },
    { icon: Route, label: copy.itineraries, value: data.itineraries.total, detail: copy.savedPlans },
    { icon: Sparkles, label: copy.aiRequests, value: data.planner.requests_30d, detail: copy.last30Days },
    { icon: AlertTriangle, label: copy.aiErrors, value: data.planner.errors_30d, detail: copy.last30Days },
  ];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <section className="card-flat overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-line flex items-center gap-2">
          <Activity className="w-4 h-4 text-toba" />
          <h2 className="font-display text-xl">{copy.recentActivity}</h2>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="p-6 text-[13px] text-inkSoft text-center">{copy.noActivity}</div>
        ) : (
          <div className="divide-y divide-line">
            {data.recent_activity.map((item) => (
              <div key={item.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-[12px] font-semibold text-toba uppercase min-w-24">{item.action}</span>
                <div className="flex-1 text-sm">
                  <span className="font-medium">{item.entity_type}</span>
                  <span className="text-inkSoft"> · {item.admin_email}</span>
                </div>
                <time className="text-[11px] text-inkSoft">
                  {item.created_at ? new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)) : "-"}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
