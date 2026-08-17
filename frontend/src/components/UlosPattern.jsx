import React from "react";

// Subtle Batak Ulos-inspired geometric pattern for backdrops.
// Kept low-opacity so it enriches without competing with content.
export default function UlosPattern({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="ulos-motif"
          x="0"
          y="0"
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(0)"
        >
          {/* Diamond outline */}
          <path
            d="M40 6 L74 40 L40 74 L6 40 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          {/* Inner diamond */}
          <path
            d="M40 20 L60 40 L40 60 L20 40 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
          {/* Center dot */}
          <circle cx="40" cy="40" r="1.5" fill="currentColor" />
          {/* Zigzag top */}
          <path
            d="M0 8 L20 0 L40 8 L60 0 L80 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
          {/* Zigzag bottom */}
          <path
            d="M0 72 L20 80 L40 72 L60 80 L80 72"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ulos-motif)" />
    </svg>
  );
}
