import React from "react";

// Minimal markdown renderer for AI itinerary output (headings, bold, lists, blockquotes).
export function renderMarkdown(md, compact = false) {
  if (!md) return null;
  const body = compact ? "text-[13px]" : "text-[14px]";
  const lines = md.split("\n");
  const out = [];
  let listBuf = [];

  const bold = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-ink'>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  const flush = () => {
    if (listBuf.length) {
      out.push(
        <ul
          key={`ul-${out.length}`}
          className={`list-disc pl-5 my-2 space-y-1 ${body} text-inkSoft`}
        >
          {listBuf.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      out.push(
        <h3
          key={i}
          className={`font-display ${compact ? "text-[19px] mt-4" : "text-[22px] sm:text-2xl mt-7"} mb-2 text-toba`}
        >
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("### ")) {
      flush();
      out.push(
        <h4 key={i} className={`font-display ${compact ? "text-[15px] mt-3" : "text-[18px] mt-5"} mb-1.5`}>
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("> ")) {
      flush();
      out.push(
        <blockquote
          key={i}
          className="my-3 pl-3.5 border-l-2 border-moss bg-moss/10 rounded-r-lg py-2.5 pr-3 text-[13px] text-ink"
          dangerouslySetInnerHTML={{ __html: bold(line.slice(2)) }}
        />
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(bold(line.slice(2)));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(
        <p
          key={i}
          className={`${body} text-inkSoft leading-relaxed my-2`}
          dangerouslySetInnerHTML={{ __html: bold(line) }}
        />
      );
    }
  });
  flush();
  return out;
}
