import React, { useEffect, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { useLang } from '../../contexts/LanguageContext.jsx';

const DocsContent = ({ title, activeMenu }) => {
  const { t } = useLang();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Map menu ID to markdown file name
        const fileNameMap = {
          home: 'home.md',
          eksplorasi: 'eksplorasi.md',
          kerjasama: 'kerjasama.md',
          faq: 'faq.md',
          kebijakan: 'kebijakan.md',
          'syarat-ketentuan': 'syarat-ketentuan.md',
          legalitas: 'legalitas.md',
          tentang: 'tentang.md',
          kontak: 'kontak.md'
        };
        
        const fileName = fileNameMap[activeMenu] || 'home.md';
        const response = await fetch(`/docs/${fileName}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load ${fileName}: ${response.status} ${response.statusText}`);
        }
        
        const mdContent = await response.text();
        setContent(mdContent);
      } catch (err) {
        setError(err.message);
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [activeMenu]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 w-24 rounded"></div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 w-24 rounded"></div>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">Gagal memuat konten: {error}</p>
          <p className="text-red-600 text-sm mt-2">{t.docs.fileHint} <code className="font-mono">public/docs/{activeMenu}.md</code>.</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 w-24 rounded"></div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">{t.docs.contentNotFound} <code className="font-mono">public/docs/{activeMenu}.md</code>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 w-24 rounded"></div>
      </div>

      {/* Content - Render Markdown */}
      <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed">
        {renderMarkdown(content)}
      </div>
    </div>
  );
};

export default DocsContent;
