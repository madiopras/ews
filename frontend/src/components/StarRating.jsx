import React from "react";
import { Star } from "lucide-react";
import { useLang } from "../contexts/LanguageContext.jsx";

// Displays interactive or static star rating (1-5)
export default function StarRating({ value = 0, onChange, size = 20, testId = "star-rating" }) {
  const { t } = useLang();
  const readonly = !onChange;
  return (
    <div className="flex items-center gap-1" data-testid={testId}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return readonly ? (
          <Star
            key={n}
            className={filled ? "fill-toba text-toba" : "text-line"}
            style={{ width: size, height: size }}
          />
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            data-testid={`${testId}-${n}`}
            className="p-1.5 transition-transform hover:scale-110"
            aria-label={t.reviews.rateValue.replace("{value}", n)}
          >
            <Star
              className={filled ? "fill-toba text-toba" : "text-line hover:text-toba"}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}
