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
    <section className="mt-16" data-testid="reviews-section">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">{t.reviews.title}</h2>
          {data.count > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <StarRating value={data.average} size={18} testId="avg-star-display" />
              <span className="text-sm text-muted2" data-testid="avg-rating-label">
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
            className="px-5 py-3 rounded-full shadow-neu-raised hover:text-sunset text-sm font-semibold transition-all"
            data-testid="write-review-btn"
          >
            {t.reviews.writeCta}
          </button>
        ) : (
          <Link
            to="/login"
            className="px-5 py-3 rounded-full shadow-neu-sm hover:text-sunset text-sm transition-all"
            data-testid="login-to-review-link"
          >
            {t.reviews.loginToReview}
          </Link>
        )}
      </div>

      {showForm && isAuth && (
        <form
          onSubmit={submit}
          className="neu-raised rounded-3xl p-6 sm:p-8 mb-8 space-y-5"
          data-testid="review-form"
        >
          <div>
            <div className="text-xs text-muted2 pl-1 mb-2">{t.reviews.yourRating}</div>
            <StarRating
              value={form.rating}
              onChange={(v) => setForm((p) => ({ ...p, rating: v }))}
              size={28}
              testId="rating-input"
            />
          </div>
          <label className="block">
            <span className="text-xs text-muted2 pl-1">{t.reviews.comment}</span>
            <textarea
              required
              rows={4}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              placeholder={t.reviews.commentPlaceholder}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none resize-none"
              data-testid="review-comment-input"
              maxLength={1000}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm disabled:opacity-50"
            data-testid="review-submit-btn"
          >
            {submitting ? t.common.loading : t.reviews.submit}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : data.reviews.length === 0 ? (
        <div className="text-muted2 text-sm py-8" data-testid="reviews-empty">
          {t.reviews.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.reviews.map((r) => (
            <article
              key={r.id}
              className="rounded-3xl p-6 shadow-neu-raised bg-sand"
              data-testid={`review-item-${r.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full shadow-neu-inset flex items-center justify-center font-display text-lg text-sunset">
                    {r.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{r.user_name}</div>
                    <div className="text-xs text-muted2">
                      {new Date(r.created_at).toLocaleDateString(
                        lang === "en" ? "en-US" : "id-ID",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </div>
                  </div>
                </div>
                <StarRating value={r.rating} size={16} testId={`review-stars-${r.id}`} />
              </div>
              <p className="text-sm text-ink/85 leading-relaxed">{r.comment}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
