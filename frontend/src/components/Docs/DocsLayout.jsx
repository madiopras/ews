import React from 'react';
import { Menu, X } from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext.jsx';

const DocsLayout = ({ sidebarChildren, mainChildren, sidebarOpen, setSidebarOpen }) => {
  const { t } = useLang();
  return (
    <div className="flex min-w-0 overflow-x-clip rounded-2xl border border-line bg-gray-50 shadow-sm">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t.docs.closeNavigation}
          className="fixed inset-0 z-20 h-full w-full bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <button
        type="button"
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-toba px-4 text-sm font-semibold text-cream shadow-lg shadow-toba/25 transition hover:bg-toba/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toba lg:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-controls="docs-sidebar"
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-4 w-4" /> {t.docs.openNavigation}
      </button>

      {/* Sidebar */}
      <aside 
        id="docs-sidebar"
        className={`
          fixed inset-y-0 left-0 z-30 w-[min(19rem,calc(100vw-2.5rem))] bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:w-72 lg:translate-x-0 lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between border-b border-line bg-toba px-4 py-4 text-cream">
          <h2 className="font-display text-lg">Explore Wisata Sumut</h2>
          <button 
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-cream/75 transition hover:bg-cream/10 hover:text-cream lg:hidden"
            aria-label={t.docs.closeNavigation}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="h-[calc(100vh-4.5rem)] space-y-1 overflow-y-auto p-3 lg:h-auto lg:min-h-full">
          {sidebarChildren}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {mainChildren}
        </div>
      </main>
    </div>
  );
};

export default DocsLayout;
