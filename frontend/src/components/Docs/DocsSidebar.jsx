import React from 'react';
import { 
  LayoutDashboard, Map, Handshake, Shield, 
  FileText, Info, Mail, ChevronRight 
} from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext.jsx';

const menuItems = [
  { id: 'home', title: 'Home', icon: 'LayoutDashboard' },
  { id: 'eksplorasi', title: 'Eksplorasi', icon: 'Map' },
  { id: 'kerjasama', title: 'Kerjasama', icon: 'Handshake' },
  { id: 'kebijakan', title: 'Kebijakan', icon: 'Shield' },
  { id: 'syarat-ketentuan', title: 'Syarat & Ketentuan', icon: 'FileText' },
  { id: 'tentang', title: 'Tentang', icon: 'Info' },
  { id: 'kontak', title: 'Kontak', icon: 'Mail' }
];

const Icons = {
  LayoutDashboard, Map, Handshake, Shield,
  FileText, Info, Mail, ChevronRight
};

const DocsSidebar = ({ activeMenu, onMenuChange }) => {
  const { t } = useLang();
  return (
    <div className="space-y-1">
      {menuItems.map((item) => {
        const IconComponent = Icons[item.icon];
        const isActive = activeMenu === item.id;
        
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onMenuChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors
              ${isActive 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            {IconComponent && <IconComponent size={18} />}
            <span>{t.docs.menu[item.id] || item.title}</span>
            {isActive && <ChevronRight size={16} className="ml-auto" />}
          </button>
        );
      })}
    </div>
  );
};

export default DocsSidebar;
