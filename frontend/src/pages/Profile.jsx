import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Heart, Sparkles, Shield, LogOut, Languages, User, ChevronRight, Handshake } from "lucide-react";
import GoogleButton from "@/components/GoogleButton";

function Row({ to, onClick, icon: Icon, label, value, testId }) {
  const inner = (
    <>
      <span className="w-9 h-9 rounded-lg bg-cream border border-line flex items-center justify-center text-toba shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 text-left text-[15px]">{label}</span>
      {value && <span className="text-[13px] text-inkSoft">{value}</span>}
      <ChevronRight className="w-4 h-4 text-inkSoft shrink-0" />
    </>
  );
  const cls =
    "w-full flex items-center gap-3 min-h-[56px] px-4 border-b border-line last:border-b-0 hover:bg-cream transition-colors";
  return to ? (
    <Link to={to} className={cls} data-testid={testId}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls} data-testid={testId}>
      {inner}
    </button>
  );
}

export default function Profile() {
  const { user, logout, ready } = useAuth();
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();
  const isAuth = user && typeof user === "object";

  if (!ready) return <div className="p-8 text-inkSoft text-[13px]">{t.common.loading}</div>;

  if (!isAuth) {
    return (
      <div className="max-w-md mx-auto px-4 mt-10 pb-16" data-testid="profile-page">
        <div className="card-flat p-6 text-center">
          <span className="w-14 h-14 mx-auto rounded-full bg-cream border border-line flex items-center justify-center text-toba mb-4">
            <User className="w-6 h-6" />
          </span>
          <h1 className="font-display text-[24px] mb-2">{t.profile.guestTitle}</h1>
          <p className="text-[13px] text-inkSoft mb-6">{t.profile.guestSubtitle}</p>
          <div className="space-y-3">
            <GoogleButton testId="google-profile-btn" />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-inkSoft">{t.auth.or}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Link to="/login" className="btn-primary w-full" data-testid="profile-login-btn">
              {t.nav.login}
            </Link>
            <Link to="/register" className="btn-outline w-full" data-testid="profile-register-btn">
              {t.nav.register}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 mt-6 pb-16" data-testid="profile-page">
      <div className="card-flat p-5 flex items-center gap-4 mb-4">
        <span className="w-14 h-14 rounded-full bg-toba text-cream flex items-center justify-center font-display text-2xl shrink-0">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="font-display text-[22px] leading-tight truncate" data-testid="profile-name">
            {user.name}
          </div>
          <div className="text-[13px] text-inkSoft truncate">{user.email}</div>
          {user.role === "admin" && <span className="badge-moss mt-1.5">admin</span>}
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <Row to="/wishlist" icon={Heart} label={t.savedTrips.destTab} testId="profile-link-wishlist" />
        <Row to="/wishlist?tab=trips" icon={Sparkles} label={t.savedTrips.tab} testId="profile-link-trips" />
        <Row to="/partners/register" icon={Handshake} label={t.partners.register} testId="profile-link-partner" />
        {user.role === "admin" && (
          <Row to="/admin" icon={Shield} label={t.nav.admin} testId="profile-link-admin" />
        )}
        <Row
          onClick={toggle}
          icon={Languages}
          label={t.profile.language}
          value={lang.toUpperCase()}
          testId="profile-lang-toggle"
        />
      </div>

      <button
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        className="btn-outline w-full mt-4 text-brick"
        data-testid="profile-logout-btn"
      >
        <LogOut className="w-4 h-4" /> {t.nav.logout}
      </button>
    </div>
  );
}
