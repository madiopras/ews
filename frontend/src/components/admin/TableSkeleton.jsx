import React from "react";

function Pulse({ className = "" }) {
  return <span className={`block rounded bg-line/60 animate-pulse ${className}`} />;
}

export default function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading" data-testid="data-table-skeleton">
      <div className="hidden md:block overflow-hidden">
        <div className="grid gap-4 px-4 py-3 bg-line/20 border-b border-line" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, index) => <Pulse key={index} className="h-3 w-20 max-w-full" />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid gap-4 px-4 py-4 border-b border-line last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, column) => <Pulse key={column} className={`h-4 ${column === 0 ? "w-28" : "w-20"} max-w-full`} />)}
          </div>
        ))}
      </div>
      <div className="md:hidden divide-y divide-line">
        {Array.from({ length: Math.min(rows, 4) }, (_, row) => (
          <div key={row} className="p-4 space-y-3">
            <Pulse className="h-4 w-2/3" />
            <Pulse className="h-3 w-full" />
            <Pulse className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading data</span>
    </div>
  );
}
