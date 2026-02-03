
import React, { useState, useRef } from 'react';

interface SecretHubViewProps {
  onExit: () => void;
}

const SECRET_LINKS = [
  { id: 'google', name: 'Google', label: 'Google Search', icon: 'fa-search', url: 'https://www.google.com/search?q=&igu=1&safe=off', color: 'from-blue-600/20' },
  { id: 'instagram', name: 'Instagram', label: 'Instagram Portal', icon: 'fa-camera-retro', url: 'https://www.google.com/search?q=instagram+login&igu=1&safe=off', color: 'from-pink-600/20' },
  { id: 'twitter', name: 'X Twitter', label: 'X Pulse Stream', icon: 'fa-brands fa-x-twitter', url: 'https://www.google.com/search?q=twitter+trending&igu=1&safe=off', color: 'from-slate-600/20' },
  { id: 'incognito', name: 'Incognito', label: 'Private Search', icon: 'fa-user-secret', url: 'https://www.google.com/search?q=private+search&igu=1&safe=off', color: 'from-purple-600/20' },
];

const SecretHubView: React.FC<SecretHubViewProps> = ({ onExit }) => {
  const [activeUrl, setActiveUrl] = useState(SECRET_LINKS[0].url);
  const [activeId, setActiveId] = useState(SECRET_LINKS[0].id);
  const [customQuery, setCustomQuery] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    
    // Convert text to a working Google search URL which bypasses iframe blocks and turns off SafeSearch
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(customQuery)}&igu=1&safe=off`;
    setActiveUrl(searchUrl);
    setActiveId('search');
    setCustomQuery('');
  };

  const openDirect = () => {
    // Determine the actual intended URL based on the active search
    let target = activeUrl;
    if (activeId === 'instagram') target = 'https://www.instagram.com';
    if (activeId === 'twitter') target = 'https://twitter.com';
    if (activeId === 'incognito') target = 'https://duckduckgo.com';
    
    window.open(target, '_blank');
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050505] text-white flex flex-col z-[1000] overflow-hidden font-hacker">
      {/* STEALTH HEADER */}
      <header className="h-16 w-full glass-dark border-b border-white/10 flex items-center justify-between px-4 md:px-6 z-[110] shrink-0">
        <div className="flex items-center gap-4 shrink-0">
           <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <i className="fas fa-biohazard text-sm animate-pulse"></i>
           </div>
           <div className="hidden lg:block">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-500 leading-none">SYSTEM_OVERRIDE</p>
              <p className="text-[7px] font-bold text-white/20 uppercase tracking-widest mt-1">Uplink: Active • Tunneling: Enabled</p>
           </div>
        </div>

        {/* URL / SEARCH BAR */}
        <div className="flex-1 max-w-xl mx-4 md:mx-8">
           <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20">
                 <i className="fas fa-terminal text-[10px]"></i>
              </div>
              <input 
                type="text" 
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="EXEC_QUERY_STRING_OR_URL..."
                className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-12 outline-none focus:border-red-500/40 focus:bg-white/[0.08] transition-all text-xs placeholder:text-white/10 tracking-widest font-bold"
              />
              <button type="submit" className="absolute right-1 top-1 bottom-1 px-4 rounded-full bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-tighter transition-colors">
                GO
              </button>
           </form>
        </div>

        <div className="flex items-center gap-2 shrink-0">
           <button 
             onClick={onExit} 
             className="px-5 py-2.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
           >
             Halt
           </button>
        </div>
      </header>

      {/* QUICK LINKS RIBBON */}
      <div className="h-12 w-full bg-black/40 border-b border-white/5 flex items-center px-4 md:px-8 gap-2 overflow-x-auto no-scrollbar shrink-0">
         {SECRET_LINKS.map((link) => (
           <button 
             key={link.id}
             onClick={() => {
               setActiveUrl(link.url);
               setActiveId(link.id);
             }}
             className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 border ${
               activeId === link.id 
                 ? 'bg-white text-black border-white shadow-lg' 
                 : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/80'
             }`}
           >
              <i className={`fas ${link.icon} text-[10px]`}></i>
              <span>{link.name}</span>
           </button>
         ))}
      </div>

      {/* MAIN TUNNEL VIEW */}
      <main className="flex-1 w-full bg-black relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 scanlines opacity-5 pointer-events-none z-10"></div>
        
        <div className="w-full h-full relative">
          <iframe 
            ref={iframeRef}
            src={activeUrl}
            className="absolute top-0 left-0 w-full h-full border-none outline-none bg-black"
            title="Secure Link Hub"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          />
          
          {/* CONTROL OVERLAY - Always visible at bottom */}
          <div className="absolute bottom-6 left-0 right-0 pointer-events-none flex justify-center z-50">
             <div className="flex flex-col items-center gap-3 glass-dark px-8 py-4 rounded-[2.5rem] border border-white/10 shadow-2xl pointer-events-auto backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
                        Stealth Engine: {activeId.toUpperCase()}
                      </span>
                   </div>
                   <div className="h-4 w-px bg-white/10"></div>
                   <button 
                     onClick={openDirect}
                     className="flex items-center gap-2 group"
                   >
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest group-hover:text-red-400 transition-colors">Launch Direct Uplink</span>
                      <i className="fas fa-external-link-alt text-[9px] text-red-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"></i>
                   </button>
                </div>
                <p className="text-[7px] text-white/20 uppercase tracking-[0.3em] font-bold text-center">
                  Notice: Most social sites block embedding. Use 'Direct Uplink' to bypass X-Frame security.
                </p>
             </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .glass-dark { background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); }
      ` }} />
    </div>
  );
};

export default SecretHubView;
