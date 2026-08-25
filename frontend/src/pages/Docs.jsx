import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DocsLayout from '../components/Docs/DocsLayout.jsx';
import DocsSidebar from '../components/Docs/DocsSidebar.jsx';
import DocsContent from '../components/Docs/DocsContent.jsx';
import { docsContent } from '../data/docs-content.js';
import { BookOpen } from 'lucide-react';
import UlosPattern from '../components/UlosPattern.jsx';
import { useLang } from '../contexts/LanguageContext.jsx';

const Docs = () => {
  const [params, setParams] = useSearchParams();
  const { t } = useLang();
  const [activeMenu, setActiveMenu] = useState(() => params.get('section') || 'home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setActiveMenu(params.get('section') || 'home');
  }, [params]);

  // Get current content
  const currentContent = docsContent[activeMenu];
  const changeMenu = (menu) => {
    setActiveMenu(menu);
    setSidebarOpen(false);
    const next = new URLSearchParams(params);
    if (menu === 'home') next.delete('section');
    else next.set('section', menu);
    setParams(next, { replace: true });
  };

  return (
    <div data-testid="docs-page">
      {/* Header - Following Partners style */}
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> {t.docs.eyebrow}
          </div>
          <h1 className="mt-3 font-display text-[26px] sm:text-4xl lg:text-5xl leading-tight text-cream">
            Explore Wisata Sumut
          </h1>
          <p className="mt-3 text-[14px] sm:text-base text-cream/80 max-w-2xl leading-relaxed">
            {t.docs.subtitle}
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16">
        {/* Main Layout */}
        <DocsLayout 
          sidebarChildren={<DocsSidebar activeMenu={activeMenu} onMenuChange={changeMenu} />}
          mainChildren={
            <div className="min-w-0">
              <DocsContent 
                title={t.docs.menu[activeMenu] || currentContent?.title || t.docs.eyebrow}
                activeMenu={activeMenu}
              />
            </div>
          }
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    </div>
  );
};

export default Docs;
