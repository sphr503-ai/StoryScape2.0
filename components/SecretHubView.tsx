
import React, { useState } from 'react';

interface SecretHubViewProps {
  onExit: () => void;
}

const SECRET_LINKS = [
  { id: 'google', name: 'Google', label: 'Google.com', icon: 'fa-search', url: 'https://www.google.com/search?igu=1', color: 'from-blue-600/20' },
  { id: 'instagram', name: 'Instagram', label: 'Instagram', icon: 'fa-camera-retro', url: 'https://www.instagram.com', color: 'from-pink-600/20' },
  { id: 'twitter', name: 'X Twitter', label: 'X (Twitter)', icon: 'fa-brands fa-x-twitter', url: 'https://twitter.com', color: 'from-slate-600/20' },
  { id: 'incognito', name: 'Incognito', label: 'Incognito Tab', icon: 'fa-user-secret', url: 'https://duckduckgo.com', color: 'from-purple-600/20' },
];

const SecretHubView: React.FC<SecretHubViewProps> = ({ onExit }) => {
  const [activeUrl, setActiveUrl] = useState(SECRET_LINKS[0].url);
  const [activeId, setActiveId] = useState(SECRET_LINKS[0].id);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black text-white flex flex-col z-[1000] overflow-hidden font-hacker">
      {/* STEALTH NAV BAR */}
      <nav className="h-16 w-full glass-dark border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[110] shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <i className="fas fa-biohazard text-xs animate-pulse"></i>
           </div>
           <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">SYSTEM_OVERRIDE</p>
           </div>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5 overflow-x-auto no-scrollbar max-w-[60%] sm:max-w-none">
           {SECRET_LINKS.map((link) => (
             <button 
               key={link.id}
               onClick={() => {
                 setActiveUrl(link.url);
                 setActiveId(link.id);
               }}
               className={`px-3 md:px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${
                 activeId === link.id 
                   ? 'bg-white text-black shadow-lg scale-[1.02]' 
                   : 'text-white/40 hover:text-white/80 hover:bg-white/5'
               }`}
             >
                <i className={`fas ${link.icon}`}></i>
                <span className="hidden sm:inline">{link.name}</span>
             </button>
           ))}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
           <a 
             href={activeUrl} 
             target="_blank" 
             rel="noopener noreferrer" 
             className="w-10 h-10 rounded-full glass flex items-center justify-center border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
             title="Open Direct"
           >
              <i className="fas fa-external-link-alt text-xs"></i>
           </a>
           <button 
             onClick={onExit} 
             className="px-4 md:px-6 py-2.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
           >
             Halt
           </button>
        </div>
      </nav>

      {/* IFRAME CONTAINER - 100% WIDTH AND HEIGHT MINUS NAV */}
      <main className="flex-1 w-full bg-black relative flex flex-col items-center justify-center">
        <div className="absolute inset-0 scanlines opacity-5 pointer-events-none z-10"></div>
        
        {/* Auto-adjusting Iframe for Android/Desktop */}
        <div className="w-full h-full relative overflow-hidden">
          <iframe 
            src={activeUrl}
            className="absolute top-0 left-0 w-full h-full border-none outline-none"
            title="Secure Link Hub"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          />
          
          {/* Fallback Overlay for frame-blocked sites */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-12 z-20">
             <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-center animate-in fade-in duration-1000">
                <p className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-[0.4em]">
                  Tunneling: {activeId.toUpperCase()} • System width 100% • System height 100%
                </p>
                <p className="text-[7px] text-red-500/50 mt-1 uppercase font-black">If content is blocked, use direct link button in top right</p>
             </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ` }} />
    </div>
  );
};

export default SecretHubView;
