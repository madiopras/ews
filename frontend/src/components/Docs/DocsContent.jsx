import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Handshake, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { useLang } from '../../contexts/LanguageContext.jsx';

const PARTNER_GUIDE_SEQUENCE = [
  'kerjasama',
  'mitra-pendaftaran',
  'mitra-verifikasi',
  'mitra-workspace',
  'mitra-produk-jasa',
  'mitra-faq',
];

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
          'mitra-pendaftaran': 'mitra-pendaftaran.md',
          'mitra-verifikasi': 'mitra-verifikasi.md',
          'mitra-workspace': 'mitra-workspace.md',
          'mitra-produk-jasa': 'mitra-produk-jasa.md',
          'mitra-faq': 'mitra-faq.md',
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

  const partnerGuideIndex = PARTNER_GUIDE_SEQUENCE.indexOf(activeMenu);
  const previousGuide = partnerGuideIndex > 0 ? PARTNER_GUIDE_SEQUENCE[partnerGuideIndex - 1] : null;
  const nextGuide = partnerGuideIndex >= 0 && partnerGuideIndex < PARTNER_GUIDE_SEQUENCE.length - 1
    ? PARTNER_GUIDE_SEQUENCE[partnerGuideIndex + 1]
    : null;

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

      {partnerGuideIndex >= 0 && (
        <footer className="mt-10 border-t border-line pt-6">
          <nav className="grid gap-3 sm:grid-cols-2" aria-label={t.docs.partnerGuideNavigation}>
            {previousGuide ? (
              <Link
                to={`/docs?section=${previousGuide}`}
                className="group flex min-h-16 items-center gap-3 rounded-xl border border-line bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-toba/30 hover:bg-toba/5 hover:text-toba"
              >
                <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                <span><small className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{t.docs.previous}</small>{t.docs.menu[previousGuide]}</span>
              </Link>
            ) : <span />}
            {nextGuide && (
              <Link
                to={`/docs?section=${nextGuide}`}
                className="group flex min-h-16 items-center justify-end gap-3 rounded-xl border border-line bg-gray-50 px-4 py-3 text-right text-sm font-semibold text-gray-700 transition hover:border-toba/30 hover:bg-toba/5 hover:text-toba"
              >
                <span><small className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{t.docs.next}</small>{t.docs.menu[nextGuide]}</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </nav>

          <div className="mt-5 flex flex-wrap gap-2 rounded-xl bg-toba/[0.06] p-4">
            <Link to="/partners/register" className="btn-primary"><Handshake className="h-4 w-4" />{t.docs.registerPartner}</Link>
            <Link to="/mitra" className="btn-outline"><LayoutDashboard className="h-4 w-4" />{t.docs.openWorkspace}</Link>
            <Link to="/docs?section=kontak" className="btn-outline"><LifeBuoy className="h-4 w-4" />{t.docs.needHelp}</Link>
          </div>
        </footer>
      )}
    </div>
  );
};

export default DocsContent;
