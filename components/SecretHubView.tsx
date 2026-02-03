
import React from 'react';

interface SecretHubViewProps {
  onExit: () => void;
}

const SECRET_LINKS = [
  { id: 'google', name: 'Neural_Search', label: 'Google.com', icon: 'fa-search', url: 'https://www.google.com', color: 'from-blue-600/20' },
  { id: 'instagram', name: 'Vocal_Relay', label: 'Instagram', icon: 'fa-camera-retro', url: 'https://www.instagram.com', color: 'from-pink-600/20' },
  { id: 'twitter', name: 'Pulse_Stream', label: 'X Twitter', icon: 'fa-brands fa-x-twitter', url: 'https://twitter.com', color: 'from-slate-600/20' },
  { id: 'incognito', name: 'Shadow_Link', label: 'Incognito Tab', icon: 'fa-user-secret', url: 'https://duckduckgo.com', color: 'from-purple-600/20' },
];

const SecretHubView: React.FC<SecretHubViewProps> = ({ onExit }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden font-hacker">
      {/* Immersive Background */}
      <div className="absolute inset-0 scanlines opacity-10 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse opacity-20"></div>
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-red-600/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-5xl w-full z-10 flex flex-col items-center gap-12">
        <header className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
           <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                 <i className="fas fa-biohazard text-xl"></i>
              </div>
           </div>
           <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
             SYSTEM_OVERRIDE
           </h2>
           <p className="text-red-500 uppercase tracking-[0.8em] text-[10px] font-black animate-pulse">Root Access Verified • Link Unlocked</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
           {SECRET_LINKS.map((link, i) => (
             <a 
               key={link.id}
               href={link.url}
               target="_blank"
               rel="noopener noreferrer"
               className={`group glass-dark p-8 rounded-[3rem] border-white/5 hover:border-white/20 transition-all duration-700 flex flex-col items-center text-center gap-6 relative overflow-hidden bg-gradient-to-b ${link.color} to-transparent animate-in fade-in zoom-in-95`}
               style={{ animationDelay: `${i * 100}ms` }}
             >
                <div className="absolute inset-0 bg-white/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-white/5 relative z-10">
                   <i className={`fas ${link.icon} text-2xl opacity-60 group-hover:opacity-100 transition-opacity`}></i>
                </div>
                <div className="space-y-1 relative z-10">
                   <h3 className="text-sm font-black uppercase tracking-widest">{link.name}</h3>
                   <p className="text-[10px] opacity-30 font-bold uppercase group-hover:opacity-60 transition-opacity">{link.label}</p>
                </div>
             </a>
           ))}
        </div>

        <div className="flex flex-col items-center gap-4 w-full pt-8">
           <button 
             onClick={onExit} 
             className="w-full max-w-xs py-5 rounded-[2rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.4em] hover:scale-105 transition-all shadow-2xl active:scale-95"
           >
             Halt Protocol
           </button>
           <p className="text-[8px] opacity-20 uppercase tracking-[0.3em]">StoryScape Virtual Tunnel v1.0.4</p>
        </div>
      </div>
    </div>
  );
};

export default SecretHubView;
