import React from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Star } from "lucide-react";

// Displays interactive or static star rating (1-5)
export default function StarRating({ value = 0, onChange, size = 20, testId = "star-rating" }) {
  const readonly = !onChange;
  return (
    <div className="flex items-center gap-1" data-testid={testId}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return readonly ? (
          <Star
            key={n}
            className={filled ? "fill-sunset text-sunset" : "text-sandDark"}
            style={{ width: size, height: size }}
          />
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            data-testid={`${testId}-${n}`}
            className="transition-transform hover:scale-110"
            aria-label={`Rate ${n}`}
          >
            <Star
              className={filled ? "fill-sunset text-sunset" : "text-sandDark hover:text-sunset"}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}
