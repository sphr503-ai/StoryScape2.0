
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
    url: 'https://www.google.com/search?q=&igu=1&safe=off', 
    color: 'from-blue-600/20' 
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: 'fa-camera-retro', 
    url: 'https://www.google.com/search?q=instagram+login&igu=1&safe=off', 
    color: 'from-pink-600/20' 
  },
  { 
    id: 'twitter', 
    name: 'X Twitter', 
    icon: 'fa-brands fa-x-twitter', 
    url: 'https://www.google.com/search?q=twitter+trending&igu=1&safe=off', 
    color: 'from-slate-600/20' 
  },
  { 
    id: 'incognito', 
    name: 'Incognito', 
    icon: 'fa-user-secret', 
    url: 'https://www.google.com/search?q=private+search&igu=1&safe=off', 
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
        {/* Minimal Control Overlay */}
        <div className="absolute top-4 right-4 z-[2100] flex gap-2">
           <button 
             onClick={handleBackToMenu}
             className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
             title="Back to Launcher"
           >
             <i className="fas fa-grid-2"></i>
           </button>
           <button 
             onClick={onExit}
             className="w-10 h-10 rounded-full bg-red-600/80 backdrop-blur-md border border-red-500/40 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]"
             title="Exit System"
           >
             <i className="fas fa-power-off"></i>
           </button>
        </div>

        {/* 100% Full System Iframe */}
        <iframe 
          src={activeUrl}
          className="w-full h-full border-none outline-none bg-black"
          title="Secure Link Hub"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-6 md:p-12 z-[1000] font-hacker overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 scanlines opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 blur-[150px] rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="max-w-5xl w-full z-10 flex flex-col items-center gap-12">
        <header className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-1000">
           <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-4 mx-auto">
              <i className="fas fa-shield-halved text-sm"></i>
           </div>
           <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
             System_Access
           </h2>
           <p className="text-[9px] font-black uppercase tracking-[0.6em] text-white/20">Uplink Protocols Established</p>
        </header>

        {/* 4 Box Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl">
           {SECRET_LINKS.map((link, i) => (
             <button 
               key={link.id}
               onClick={() => handleLaunch(link.url)}
               className={`group relative aspect-square glass-dark rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all duration-500 flex flex-col items-center justify-center gap-4 md:gap-6 bg-gradient-to-b ${link.color} to-transparent animate-in fade-in zoom-in-95`}
               style={{ animationDelay: `${i * 100}ms` }}
             >
                <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]"></div>
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                   <i className={`fas ${link.icon} text-xl md:text-2xl text-white/40 group-hover:text-white transition-colors`}></i>
                </div>
                <div className="text-center">
                   <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">
                     {link.name}
                   </h3>
                </div>
             </button>
           ))}
        </div>

        <div className="flex flex-col items-center gap-6 pt-8">
           <button 
             onClick={onExit} 
             className="px-12 py-4 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.4em] text-white/40 hover:bg-red-600/10 hover:border-red-500/20 hover:text-red-400 transition-all active:scale-95"
           >
             Halt System
           </button>
           <p className="text-[7px] text-white/10 uppercase tracking-widest">Link Tunnel v2.0.8 • Secure Session</p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-dark { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(40px); }
        @keyframes scanlines { from { background-position: 0 0; } to { background-position: 0 100%; } }
      ` }} />
    </div>
  );
};

export default SecretHubView;
