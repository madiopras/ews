import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import { api, formatError } from "../lib/api.js";
import { Heart, Sparkles, Shield, LogOut, User, ChevronRight, Handshake, Download, Trash2, Save, MailWarning } from "lucide-react";
import { toast } from "sonner";
import GoogleButton from "../components/GoogleButton.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { CATEGORY_KEYS } from "../lib/i18n.js";
import Seo from "../components/Seo.jsx";
import { localizedAuthError } from "../lib/authNavigation.js";

function Row({ to, icon: Icon, label }) {
  return <Link to={to} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-cream"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-cream text-toba"><Icon className="h-4 w-4" /></span><span className="flex-1 text-left text-[15px]">{label}</span><ChevronRight className="h-4 w-4 shrink-0 text-inkSoft" /></Link>;
}

export default function Profile() {
  const { user, logout, ready, setUser } = useAuth();
  const { t, lang, setLanguage } = useLang();
  const navigate = useNavigate();
  const isAuth = user && typeof user === "object";
  const [form, setForm] = useState({ name: "", preferred_language: lang, interests: [], home_city: "" });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", password: "" });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuth) return;
    setForm({ name: user.name || "", preferred_language: user.preferred_language || lang, interests: user.interests || [], home_city: user.home_city || "" });
  }, [isAuth, lang, user]);

  if (!ready) return <div className="p-8 text-[13px] text-inkSoft">{t.common.loading}</div>;
  if (!isAuth) return <div className="app-gutter mx-auto mt-8 max-w-md sm:mt-10 md:pb-16" data-testid="profile-page"><Seo title={t.profile.title} description={t.profile.guestSubtitle} noIndex /><div className="card-flat p-5 text-center sm:p-6"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-cream text-toba"><User className="h-6 w-6" /></span><h1 className="mb-2 font-display text-[24px]">{t.profile.guestTitle}</h1><p className="mb-6 text-[13px] text-inkSoft">{t.profile.guestSubtitle}</p><div className="space-y-3"><GoogleButton testId="google-profile-btn" /><Link to="/login" className="btn-primary w-full">{t.nav.login}</Link><Link to="/register" className="btn-outline w-full">{t.nav.register}</Link></div></div></div>;

  const toggleInterest = (interest) => setForm((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/profile", form);
      setUser(data);
      setLanguage(data.preferred_language);
      toast.success(t.profile.saved);
    } catch (error) {
      toast.error(localizedAuthError(formatError(error.response?.data?.detail), t.auth.errors));
    } finally {
      setSaving(false);
    }
  };
  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/account/export", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "explore-wisata-sumut-account.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(localizedAuthError(formatError(error.response?.data?.detail), t.auth.errors));
    } finally {
      setExporting(false);
    }
  };
  const deleteAccount = async (event) => {
    event.preventDefault();
    setDeleting(true);
    try {
      await api.delete("/account", { data: deleteForm });
      await logout();
      toast.success(t.profile.deleted);
      navigate("/");
    } catch (error) {
      toast.error(localizedAuthError(formatError(error.response?.data?.detail), t.auth.errors));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="app-gutter mx-auto mt-5 max-w-2xl sm:mt-6 md:pb-16" data-testid="profile-page">
      <Seo title={t.profile.title} description={t.profile.manageDescription} noIndex />
      <div className="card-flat mb-4 flex items-center gap-4 p-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-toba font-display text-2xl text-cream">{(user.name || user.email).charAt(0).toUpperCase()}</span><div className="min-w-0"><h1 className="truncate font-display text-[22px] leading-tight">{user.name}</h1><div className="truncate text-[13px] text-inkSoft">{user.email}</div></div></div>
      {!user.email_verified && <div className="mb-4 flex items-center gap-3 rounded-xl border border-brick/25 bg-brick/5 p-4"><MailWarning className="h-5 w-5 shrink-0 text-brick" /><p className="flex-1 text-sm text-inkSoft">{t.profile.emailUnverified}</p><Link to="/verify-email" className="text-sm font-semibold text-toba hover:underline">{t.profile.verifyNow}</Link></div>}
      <form onSubmit={save} className="card-flat space-y-5 p-5 sm:p-6">
        <div><h2 className="font-display text-2xl">{t.profile.personalInfo}</h2><p className="mt-1 text-sm text-inkSoft">{t.profile.manageDescription}</p></div>
        <label className="block"><span className="text-[13px] text-inkSoft">{t.auth.name}</span><input required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="input-flat mt-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-[13px] text-inkSoft">{t.profile.homeCity}</span><input maxLength={120} value={form.home_city} onChange={(event) => setForm((current) => ({ ...current, home_city: event.target.value }))} className="input-flat mt-2" /></label><label className="block"><span className="text-[13px] text-inkSoft">{t.profile.language}</span><select value={form.preferred_language} onChange={(event) => setForm((current) => ({ ...current, preferred_language: event.target.value }))} className="input-flat mt-2"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label></div>
        <fieldset><legend className="text-[13px] text-inkSoft">{t.profile.interests}</legend><div className="mt-2 flex flex-wrap gap-2">{CATEGORY_KEYS.map((interest) => <button key={interest} type="button" onClick={() => toggleInterest(interest)} aria-pressed={form.interests.includes(interest)} className={`chip ${form.interests.includes(interest) ? "chip-active" : ""}`}>{t.categories[interest]}</button>)}</div></fieldset>
        <button disabled={saving} className="btn-primary w-full sm:w-auto"><Save className="h-4 w-4" /> {saving ? t.common.loading : t.profile.save}</button>
      </form>
      <div className="card-flat mt-4 overflow-hidden"><Row to="/wishlist" icon={Heart} label={t.savedTrips.destTab} /><Row to="/wishlist?tab=trips" icon={Sparkles} label={t.savedTrips.tab} /><Row to="/partners/register" icon={Handshake} label={t.partners.register} />{user.role === "admin" && <Row to="/admin" icon={Shield} label={t.nav.admin} />}</div>
      <section className="card-flat mt-4 p-5"><h2 className="font-display text-xl">{t.profile.accountData}</h2><p className="mt-1 text-sm text-inkSoft">{t.profile.accountDataHint}</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><button onClick={exportData} disabled={exporting} className="btn-outline"><Download className="h-4 w-4" /> {exporting ? t.common.loading : t.profile.exportData}</button>{user.role !== "admin" && <button onClick={() => setDeleteOpen((current) => !current)} className="btn-outline text-brick"><Trash2 className="h-4 w-4" /> {t.profile.deleteAccount}</button>}</div>{deleteOpen && <form onSubmit={deleteAccount} className="mt-5 space-y-4 border-t border-line pt-5"><p className="text-sm text-brick">{t.profile.deleteWarning}</p><label className="block"><span className="text-[13px] text-inkSoft">{t.profile.typeDelete}</span><input required value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} placeholder="DELETE" className="input-flat mt-2" /></label>{user.auth_provider !== "google" && <PasswordField label={t.auth.password} value={deleteForm.password} onChange={(event) => setDeleteForm((current) => ({ ...current, password: event.target.value }))} showPasswordLabel={t.auth.showPassword} hidePasswordLabel={t.auth.hidePassword} />}<button disabled={deleting || deleteForm.confirmation !== "DELETE"} className="btn-primary bg-brick">{deleting ? t.common.loading : t.profile.confirmDelete}</button></form>}</section>
      <button onClick={async () => { await logout(); navigate("/"); }} className="btn-outline mt-4 w-full text-brick"><LogOut className="h-4 w-4" /> {t.nav.logout}</button>
    </main>
  );
}
