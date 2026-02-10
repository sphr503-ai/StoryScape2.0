
import React, { useState } from 'react';

interface SecretHubViewProps {
  onExit: () => void;
}

interface SecretLink {
  id: string;
  name: string;
  icon: string;
  url: string;
  color: string;
}

const SECRET_LINKS: SecretLink[] = [
  { 
    id: 'google', 
    name: 'Google', 
    icon: 'fa-search', 
    url: 'https://www.google.com/search?igu=1&safe=off', 
    color: 'from-blue-600/20' 
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: 'fa-camera-retro', 
    url: 'https://www.instagram.com', 
    color: 'from-pink-600/20' 
  },
  { 
    id: 'twitter', 
    name: 'X Twitter', 
    icon: 'fa-brands fa-x-twitter', 
    url: 'https://twitter.com', 
    color: 'from-slate-600/20' 
  },
  { 
    id: 'incognito', 
    name: 'Incognito', 
    icon: 'fa-user-secret', 
    url: 'https://duckduckgo.com', 
    color: 'from-purple-600/20' 
  },
];

const SecretHubView: React.FC<SecretHubViewProps> = ({ onExit }) => {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const handleLaunch = (url: string) => {
    setActiveUrl(url);
  };

  const handleBackToMenu = () => {
    setActiveUrl(null);
  };

  if (activeUrl) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black z-[2000] overflow-hidden">
        {/* Navigation / Control */}
        <div className="absolute top-4 right-4 z-[2100] flex gap-3">
           <button 
             onClick={handleBackToMenu}
             className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-2xl"
             title="Launcher Menu"
           >
             <i className="fas fa-th-large"></i>
           </button>
           <button 
             onClick={onExit}
             className="w-12 h-12 rounded-full bg-red-600/80 backdrop-blur-xl border border-red-500/40 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)]"
             title="Exit Hub"
           >
             <i className="fas fa-power-off"></i>
           </button>
        </div>

        {/* 100% Height & Width System Iframe */}
        <iframe 
          src={activeUrl}
          className="w-full h-full border-none outline-none bg-black"
          title="Neural Tunnel"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        />
        
        {/* Anti-Block Notification (Visible briefly) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none animate-out fade-out fill-mode-forwards duration-1000 delay-[3000ms]">
           <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">Uplink Stable • Width: 100% • Height: 100%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-6 md:p-12 z-[1000] font-hacker overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 scanlines opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/[0.03] blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-red-600/[0.03] blur-[150px] rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="max-w-6xl w-full z-10 flex flex-col items-center gap-16 md:gap-24">
        <header className="text-center space-y-4 animate-in fade-in slide-in-from-top-8 duration-1000">
           <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-6 mx-auto shadow-inner">
              <i className="fas fa-shield-halved text-xl"></i>
           </div>
           <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter text-white leading-none">
             SYSTEM_LAUNCHER
           </h2>
           <p className="text-[9px] md:text-xs font-black uppercase tracking-[0.8em] text-white/10">Access Portal • Unrestricted Mode</p>
        </header>

        {/* Launcher Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 w-full max-w-5xl">
           {SECRET_LINKS.map((link, i) => (
             <button 
               key={link.id}
               onClick={() => handleLaunch(link.url)}
               className={`group relative aspect-square glass-dark rounded-[3rem] md:rounded-[4rem] border border-white/5 hover:border-white/20 transition-all duration-700 flex flex-col items-center justify-center gap-6 md:gap-8 bg-gradient-to-br ${link.color} to-transparent animate-in fade-in zoom-in-95`}
               style={{ animationDelay: `${i * 150}ms` }}
             >
                <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem] md:rounded-[4rem]"></div>
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-[2rem] md:rounded-[3rem] bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/10 transition-all duration-700 shadow-2xl">
                   <i className={`fas ${link.icon} text-2xl md:text-4xl text-white/20 group-hover:text-white transition-colors`}></i>
                </div>
                <div className="text-center px-4">
                   <h3 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white transition-colors">
                     {link.name}
                   </h3>
                </div>
             </button>
           ))}
        </div>

        <div className="flex flex-col items-center gap-8 pt-12">
           <button 
             onClick={onExit} 
             className="px-16 py-5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.5em] text-white/30 hover:bg-red-600/20 hover:border-red-500/30 hover:text-red-400 transition-all active:scale-95 shadow-xl"
           >
             Halt Connection
           </button>
        </div>
      </div>
      
      {/* Completed the missing style and export */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-dark { background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(50px); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; }
      ` }} />
    </div>
  );
};

export default SecretHubView;
