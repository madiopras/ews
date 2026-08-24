import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";

// Custom renderer components with enhanced styling
const components = {
  // Enhanced headings with cultural color palette
  h1: ({ node, ...props }) => (
    <h1
      {...props}
      className="text-3xl md:text-3.5xl font-display font-bold text-gray-900 mt-8 mb-4 border-b-2 border-toba/20 pb-2"
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      {...props}
      className="text-2xl md:text-2.25xl font-display font-semibold text-gray-800 mt-7 mb-3"
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      {...props}
      className="text-xl md:text-lg font-semibold text-gray-700 mt-6 mb-2.5 flex items-center gap-2"
    >
      <span className="w-1.5 h-6 bg-toba rounded-full inline-block" />
      {props.children}
    </h3>
  ),
  h4: ({ node, ...props }) => (
    <h4
      {...props}
      className="text-base md:text-lg font-medium text-gray-600 mt-5 mb-2 flex items-center gap-2"
    >
      <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
      {props.children}
    </h4>
  ),
  h5: ({ node, ...props }) => (
    <h5
      {...props}
      className="text-sm md:text-base font-medium text-gray-600 mt-4 mb-1.5"
    />
  ),
  h6: ({ node, ...props }) => (
    <h6
      {...props}
      className="text-xs md:text-sm font-semibold uppercase tracking-wide text-gray-500 mt-3 mb-1"
    />
  ),

  // Enhanced paragraphs with better line height
  p: ({ node, ...props }) => (
    <p
      {...props}
      className="text-[15px] md:text-base text-gray-700 leading-relaxed my-4 font-normal"
    />
  ),

  // Enhanced lists with cultural colors
  ul: ({ node, ...props }) => (
    <ul
      {...props}
      className="list-disc pl-6 my-4 space-y-2 text-[15px] text-gray-700"
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      {...props}
      className="list-decimal pl-6 my-4 space-y-2 text-[15px] text-gray-700"
    />
  ),
  li: ({ node, ...props }) => (
    <li
      {...props}
      className="leading-relaxed ml-2"
    />
  ),

  // Styled blockquotes with accent color (used for the "Mitra Lokal" partner block)
  blockquote: ({ node, children, ...props }) => (
    <blockquote
      {...props}
      className="my-5 pl-4 border-l-4 border-toba bg-gradient-to-r from-toba/5 to-transparent rounded-r-lg py-3 pr-4 text-[15px] text-gray-700"
    >
      {children}
    </blockquote>
  ),

  // Superb code blocks with syntax highlighting styling
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children).replace(/\n$/, "");

    if (!inline) {
      return (
        <div className="relative my-5 group">
          {/* Language tag */}
          {match && (
            <div className="absolute top-2 right-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
              {match[1]}
            </div>
          )}
          {/* Code container */}
          <pre
            {...props}
            className={`${className} bg-gray-900 text-gray-100 p-4 md:p-5 rounded-xl overflow-x-auto shadow-lg`}
            style={{
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
            }}
          >
            <code>{text}</code>
          </pre>
          {/* Copy hint */}
          <div className="hidden group-hover:flex absolute bottom-2 right-2 items-center gap-1 text-xs text-gray-400">
            <span>Paste anywhere</span>
          </div>
        </div>
      );
    }

    // Inline code styling
    return (
      <code
        {...props}
        className="bg-toba/10 text-toba px-2 py-1 rounded-md font-mono text-[14px] font-medium border border-toba/20"
      >
        {children}
      </code>
    );
  },

  // Professional tables with header styling
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-6 scroll-smooth rounded-lg border border-gray-200 shadow-sm">
      <table {...props} className="min-w-full bg-white" />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      {...props}
      className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 font-semibold text-left text-[14px] text-gray-800 uppercase tracking-wide"
    />
  ),
  td: ({ node, ...props }) => (
    <td
      {...props}
      className="px-4 py-3 border-b border-gray-200 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
    />
  ),

  // Styled links with icons
  a: ({ node, ...props }) => (
    <a
      {...props}
      className="text-toba hover:text-cyan-600 font-medium underline underline-offset-4 transition-colors inline-flex items-center gap-1"
    />
  ),

  // Elegant horizontal rules
  hr: () => (
    <hr
      className="my-8 border-t-2 border-dashed border-gray-300"
      style={{ borderTopWidth: '2px' }}
    />
  ),

  // Responsive images with shadow
  img: ({ node, ...props }) => (
    <div className="my-6">
      <img
        {...props}
        loading="lazy"
        decoding="async"
        className="max-w-full h-auto rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
        alt={props.alt || ""}
      />
      {props.title && (
        <p className="text-center text-sm text-gray-500 mt-2 italic">
          {props.title}
        </p>
      )}
    </div>
  ),

  // Interactive task lists
  MyCheckbox: ({ checked, disabled, ...rest }) => (
    <div className={`flex items-start gap-3 my-3 ${checked ? 'opacity-75' : ''}`}>
      <div className="mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly
          className={`w-5 h-5 rounded border-2 ${
            checked ? 'border-toba bg-toba' : 'border-gray-300'
          } accent-toba cursor-default`}
          {...rest}
        />
      </div>
      <span className={`flex-1 text-[15px] ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`} />
    </div>
  ),

  // Strong/bold text
  strong: ({ node, ...props }) => (
    <strong {...props} className="font-semibold text-gray-900" />
  ),

  // Italic text
  em: ({ node, ...props }) => (
    <em {...props} className="italic text-gray-600" />
  ),
};

// Enhanced markdown renderer for AI itinerary output
export function renderMarkdown(md, compact = false) {
  if (!md) return null;

  return (
    <div className={`markdown-renderer ${compact ? '' : 'max-w-3xl'} mx-auto`}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm, // GitHub Flavored Markdown (tables, strikethrough, task lists)
          remarkBreaks, // Force line breaks
          remarkFrontmatter, // YAML front matter support
          remarkDirective, // Directives support
          remarkMath, // Math equations
        ]}
        rehypePlugins={[
          rehypeSlug, // Add unique IDs to headings
          rehypeSanitize, // Sanitize HTML for security
        ]}
        components={components}
        disallowedElements={["script", "style"]}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
