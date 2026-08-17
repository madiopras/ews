import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import StarRating from "@/components/StarRating";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Reviews({ destinationId }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const isAuth = user && typeof user === "object";
  const [data, setData] = useState({ reviews: [], average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ rating: 5, comment: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/destinations/${destinationId}/reviews`)
      .then(({ data }) => setData(data))
      .catch(() => setData({ reviews: [], average: 0, count: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [destinationId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/destinations/${destinationId}/reviews`, form);
      toast.success(t.reviews.submit);
      setForm({ rating: 5, comment: "" });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-12 sm:mt-16" data-testid="reviews-section">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="section-title">{t.reviews.title}</h2>
          {data.count > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <StarRating value={data.average} size={16} testId="avg-star-display" />
              <span className="text-[13px] text-inkSoft" data-testid="avg-rating-label">
                <span className="text-ink font-semibold">{data.average.toFixed(1)}</span>
                {" · "}
                {data.count} {t.reviews.count}
              </span>
            </div>
          )}
        </div>

        {isAuth ? (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="btn-outline w-full sm:w-auto"
            data-testid="write-review-btn"
          >
            {t.reviews.writeCta}
          </button>
        ) : (
          <Link to="/login" className="btn-outline w-full sm:w-auto" data-testid="login-to-review-link">
            {t.reviews.loginToReview}
          </Link>
        )}
      </div>

      {showForm && isAuth && (
        <form
          onSubmit={submit}
          className="card-flat p-4 sm:p-6 mb-6 space-y-4"
          data-testid="review-form"
        >
          <div>
            <div className="text-[13px] text-inkSoft mb-2">{t.reviews.yourRating}</div>
            <StarRating
              value={form.rating}
              onChange={(v) => setForm((p) => ({ ...p, rating: v }))}
              size={26}
              testId="rating-input"
            />
          </div>
          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.reviews.comment}</span>
            <textarea
              required
              rows={4}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              placeholder={t.reviews.commentPlaceholder}
              className="input-flat mt-2 resize-none"
              data-testid="review-comment-input"
              maxLength={1000}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full sm:w-auto"
            data-testid="review-submit-btn"
          >
            {submitting ? t.common.loading : t.reviews.submit}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
      ) : data.reviews.length === 0 ? (
        <div className="text-inkSoft text-[13px] py-6" data-testid="reviews-empty">
          {t.reviews.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.reviews.map((r) => (
            <article
              key={r.id}
              className="card-flat p-4 sm:p-5"
              data-testid={`review-item-${r.id}`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-toba text-cream flex items-center justify-center font-display text-lg">
                    {r.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{r.user_name}</div>
                    <div className="text-[12px] text-inkSoft">
                      {new Date(r.created_at).toLocaleDateString(
                        lang === "en" ? "en-US" : "id-ID",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </div>
                  </div>
                </div>
                <StarRating value={r.rating} size={14} testId={`review-stars-${r.id}`} />
              </div>
              <p className="text-[13px] text-inkSoft leading-relaxed">{r.comment}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
