import React from 'react';
import { 
  LayoutDashboard, Map, Handshake, Shield, FileText, Info, Mail,
  ChevronRight, UserPlus, BadgeCheck, PanelsTopLeft, PackageOpen,
  CircleHelp,
} from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext.jsx';

const menuGroups = [
  {
    id: 'general',
    title: 'Informasi Umum',
    items: [
      { id: 'home', title: 'Home', icon: 'LayoutDashboard' },
      { id: 'eksplorasi', title: 'Eksplorasi', icon: 'Map' },
      { id: 'tentang', title: 'Tentang', icon: 'Info' },
    ],
  },
  {
    id: 'partners',
    title: 'Untuk Mitra',
    items: [
      { id: 'kerjasama', title: 'Program Mitra', icon: 'Handshake' },
      { id: 'mitra-pendaftaran', title: 'Cara Mendaftar', icon: 'UserPlus' },
      { id: 'mitra-verifikasi', title: 'Verifikasi & Persetujuan', icon: 'BadgeCheck' },
      { id: 'mitra-workspace', title: 'Workspace Mitra', icon: 'PanelsTopLeft' },
      { id: 'mitra-produk-jasa', title: 'Jasa & Produk', icon: 'PackageOpen' },
      { id: 'mitra-faq', title: 'FAQ Mitra', icon: 'CircleHelp' },
    ],
  },
  {
    id: 'support',
    title: 'Bantuan & Legal',
    items: [
      { id: 'kontak', title: 'Kontak', icon: 'Mail' },
      { id: 'kebijakan', title: 'Kebijakan', icon: 'Shield' },
      { id: 'syarat-ketentuan', title: 'Syarat & Ketentuan', icon: 'FileText' },
    ],
  },
];

const Icons = {
  LayoutDashboard, Map, Handshake, Shield,
  FileText, Info, Mail, ChevronRight, UserPlus,
  BadgeCheck, PanelsTopLeft, PackageOpen, CircleHelp,
};

const DocsSidebar = ({ activeMenu, onMenuChange }) => {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      {menuGroups.map((group) => (
        <section key={group.id} aria-labelledby={`docs-group-${group.id}`}>
          <h3
            id={`docs-group-${group.id}`}
            className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400"
          >
            {t.docs.groups?.[group.id] || group.title}
          </h3>
          <div className="space-y-1">
            {group.items.map((item) => {
              const IconComponent = Icons[item.icon];
              const isActive = activeMenu === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMenuChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? 'bg-toba/10 text-toba'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  {IconComponent && <IconComponent size={18} className="shrink-0" />}
                  <span>{t.docs.menu[item.id] || item.title}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DocsSidebar;
