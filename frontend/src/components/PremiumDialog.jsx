import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { loadSnap } from "@/lib/midtrans";
import { toast } from "sonner";
import { X, Crown, Loader2 } from "lucide-react";

export default function PremiumDialog({ partner, onClose, onActivated }) {
  const { t, lang } = useLang();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api
      .get("/premium/plans")
      .then(({ data }) => {
        setPlans(data);
        setSelected(data[0]?.code || null);
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const poll = async (orderId) => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const { data } = await api.get(`/payments/${orderId}/status`);
        if (data.payment_status === "paid") {
          setStatus(t.partners.premium.success);
          toast.success(t.partners.premium.success);
          onActivated?.();
          return;
        }
        if (data.payment_status === "failed") {
          setStatus(t.partners.premium.failed);
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    setStatus(t.partners.premium.processing);
  };

  const pay = async () => {
    if (!selected) return;
    setPaying(true);
    setStatus("");
    try {
      const { data } = await api.post("/payments/snap-token", {
        partner_id: partner.id,
        plan_code: selected,
      });
      const snap = await loadSnap(data.snap_js, data.client_key);
      snap.pay(data.token, {
        onSuccess: () => {
          setStatus(t.partners.premium.processing);
          poll(data.order_id);
        },
        onPending: () => {
          setStatus(t.partners.premium.pending);
          poll(data.order_id);
        },
        onError: () => setStatus(t.partners.premium.failed),
        onClose: () => setStatus(t.partners.premium.closed),
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    } finally {
      setPaying(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid="premium-dialog"
    >
      <div className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-line max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-line">
          <div>
            <div className="flex items-center gap-2 text-toba">
              <Crown className="w-4 h-4" />
              <span className="text-[12px] tracking-[0.18em] uppercase font-semibold">
                {t.partners.premium.badge}
              </span>
            </div>
            <h2 className="font-display text-[22px] mt-1.5 leading-tight">
              {t.partners.premium.dialogTitle}
            </h2>
            <p className="text-[13px] text-inkSoft mt-1.5">{t.partners.premium.dialogDesc}</p>
            <p className="text-[13px] mt-2 font-semibold">{partner.business_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 shrink-0 rounded-lg border border-line flex items-center justify-center text-inkSoft"
            data-testid="premium-dialog-close"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="text-[13px] text-inkSoft">{t.common.loading}</div>
          ) : plans.length === 0 ? (
            <div className="text-[13px] text-inkSoft">{t.partners.premium.noPlans}</div>
          ) : (
            plans.map((p) => (
              <button
                key={p.code}
                onClick={() => setSelected(p.code)}
                className={`w-full flex items-center justify-between gap-3 min-h-[64px] px-4 rounded-lg border text-left transition-colors ${
                  selected === p.code ? "border-toba bg-toba/5" : "border-line hover:border-toba"
                }`}
                data-testid={`premium-plan-${p.code}`}
              >
                <span>
                  <span className="block font-display text-[18px]">
                    {lang === "en" ? p.label_en : p.label_id}
                  </span>
                  <span className="block text-[12px] text-inkSoft">
                    {p.months} {lang === "en" ? "months" : "bulan"}
                  </span>
                </span>
                <span className="font-semibold text-[15px] shrink-0">Rp {fmt(p.price)}</span>
              </button>
            ))
          )}

          {status && (
            <div className="text-[13px] text-toba pt-1" data-testid="premium-status">
              {status}
            </div>
          )}

          <button
            onClick={pay}
            disabled={paying || !selected}
            className="btn-primary w-full mt-2"
            data-testid="premium-pay-btn"
          >
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            {t.partners.premium.pay}
          </button>
          <p className="text-[11px] text-inkSoft text-center">{t.partners.premium.secureNote}</p>
        </div>
      </div>
    </div>
  );
}
