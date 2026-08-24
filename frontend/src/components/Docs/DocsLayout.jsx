import React from 'react';
import { useLang } from '../../contexts/LanguageContext.jsx';

const DocsLayout = ({ sidebarChildren, mainChildren, sidebarOpen, setSidebarOpen }) => {
  const { t } = useLang();
  return (
    <div className="flex bg-gray-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t.docs.closeNavigation}
          className="fixed inset-0 w-full h-full bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-blue-700">Explore Wisata Sumut</h2>
          <button 
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label={t.docs.closeNavigation}
          >
            ✕
          </button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto h-full">
          {sidebarChildren}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {mainChildren}
        </div>
      </main>
    </div>
  );
};

export default DocsLayout;
