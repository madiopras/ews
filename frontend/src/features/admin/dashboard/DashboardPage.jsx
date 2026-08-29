import React from "react";
import AdminDashboard from "../../../components/AdminDashboard.jsx";
import { useLang } from "../../../contexts/LanguageContext.jsx";

export default function DashboardPage() {
  const { t } = useLang();

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="admin-page">
      <header className="mb-5">
        <div className="eyebrow">Admin</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">
          {t.admin.sectionTitles.dashboard}
        </h1>
      </header>
      <AdminDashboard />
    </div>
  );
}
