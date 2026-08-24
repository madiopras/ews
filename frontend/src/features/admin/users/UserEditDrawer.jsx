import React, { useEffect, useState } from "react";
import { LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { AdminDrawer } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";

export default function UserEditDrawer({ user, currentUserId, open, onOpenChange, onSave, saving = false }) {
  const { t } = useLang();
  const copy = t.admin.userAdmin;
  const [role, setRole] = useState("user");
  const [active, setActive] = useState(true);
  const isSelf = user?.id === currentUserId;

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setActive(user.account_active !== false);
    }
  }, [user]);

  const changed = Boolean(user && (role !== user.role || active !== user.account_active));
  const close = () => {
    if (!changed || window.confirm(copy.unsaved)) onOpenChange(false);
  };
  return (
    <AdminDrawer
      open={open}
      onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}
      title={copy.editTitle}
      description={copy.editDescription}
      loading={saving}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={close} disabled={saving} className="btn-outline">{t.admin.cancel}</button>
          <button type="button" onClick={() => onSave({ role, account_active: active })} disabled={saving || !changed || isSelf} className="btn-primary disabled:opacity-50">
            {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {copy.save}
          </button>
        </div>
      }
    >
      {user && (
        <div className="space-y-6" data-testid="user-edit-drawer">
          <section className="rounded-xl border border-line p-4 bg-cream/40">
            <div className="font-semibold text-sm">{user.name || copy.unnamed}</div>
            <div className="text-[12px] text-inkSoft mt-1">{user.email}</div>
          </section>
          {isSelf && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-800"><ShieldAlert className="w-5 h-5 shrink-0" /><p className="text-[12px] leading-relaxed">{copy.selfHint}</p></div>}
          <label className="block" htmlFor="admin-user-role">
            <span className="text-[12px] font-semibold text-inkSoft">{copy.role}</span>
            <select id="admin-user-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={isSelf || saving} className="input-flat mt-2">
              <option value="user">User</option><option value="partner">Partner</option><option value="admin">Admin</option>
            </select>
            <span className="block mt-1.5 text-[11px] text-inkSoft">{copy.roleHint}</span>
          </label>
          <label htmlFor="admin-user-active" className="rounded-xl border border-line p-4 flex items-start gap-3 cursor-pointer">
            <span className="sr-only">Account active</span>
            <input id="admin-user-active" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={isSelf || saving} className="mt-0.5 w-5 h-5 accent-[#0F3D3E]" />
            <span><span className="block text-[13px] font-semibold">{copy.active}</span><span className="block mt-1 text-[11px] text-inkSoft">{copy.statusHint}</span></span>
          </label>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-[12px] text-blue-800">{copy.lastAdminHint}</div>
        </div>
      )}
    </AdminDrawer>
  );
}
