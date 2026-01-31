
import React, { useState, useEffect } from 'react';
import { Genre, ViewMode, AdventureConfig, NarratorMode, GeminiVoice } from './types';
import AdventureView from './components/AdventureView';
import StoryFilesView from './components/StoryFilesView';
import VoiceGuruView from './components/VoiceGuruView';
import FeedbackView from './components/FeedbackView';
import PodcastView from './components/PodcastView';

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Hindi", "Japanese", "Chinese", "Arabic"
];

const VOICES: Array<{ id: GeminiVoice; name: string; description: string }> = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Deep & Commanding' },
  { id: 'Puck', name: 'Puck', description: 'Youthful & Energetic' },
  { id: 'Charon', name: 'Charon', description: 'Stoic & Wise' },
  { id: 'Kore', name: 'Kore', description: 'Calm & Graceful' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Gravelly & Intense' },
];

const THEMES = {
  adventures: { // Futuristic & Sci-Fi
    bg: 'bg-[#010409]',
    glow1: 'bg-cyan-600/20',
    glow2: 'bg-blue-600/10',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/20',
    tabActive: 'bg-cyan-500 text-black shadow-[0_0_20px_#22d3ee]',
    heroTitle: 'NEURAL_SAGA',
    heroSub: 'SYSTEM: ACTIVE // REAL-TIME GENERATION',
    font: 'font-scifi',
    icon: 'fa-wand-magic-sparkles',
    card: 'glass border-cyan-500/10 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]',
    container: ''
  },
  files: { // Dark & Moody (Sleep/Vault)
    bg: 'bg-[#0a0505]',
    glow1: 'bg-orange-950/20',
    glow2: 'bg-red-950/10',
    accent: 'text-orange-500',
    border: 'border-orange-900/40',
    tabActive: 'bg-orange-800 text-white border-orange-500 shadow-[0_0_25px_#9a3412]',
    heroTitle: 'THE_VAULT',
    heroSub: 'DEEP SLEEP & ARCHIVAL CHRONICLES',
    font: 'font-fantasy',
    icon: 'fa-moon',
    card: 'bg-black/40 border-orange-900/30 hover:border-orange-500/40 hover:shadow-[0_0_40px_rgba(234,88,12,0.05)]',
    container: ''
  },
  broadcast: { // Immersive Podcast / Documentary (Knowledgeable & Entertaining)
    bg: 'bg-[#08081a]',
    glow1: 'bg-violet-600/20',
    glow2: 'bg-fuchsia-900/15',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    tabActive: 'bg-violet-600 text-white shadow-[0_0_25px_#8b5cf6]',
    heroTitle: 'ON_AIR',
    heroSub: 'MYSTERY, KNOWLEDGE & CRIME THRILLERS',
    font: 'font-sans',
    icon: 'fa-broadcast-tower',
    card: 'glass border-violet-500/10 hover:border-violet-400/50 hover:shadow-[0_0_35px_rgba(139,92,246,0.15)]',
    container: ''
  },
  custom: { // Hacker / Studio
    bg: 'bg-[#000a00]',
    glow1: 'bg-green-950/30',
    glow2: 'bg-emerald-950/10',
    accent: 'text-green-500',
    border: 'border-green-500/20',
    tabActive: 'bg-green-600 text-black border-green-400 shadow-[0_0_15px_#16a34a]',
    heroTitle: 'DIRECTOR_MODE',
    heroSub: '> INITIALIZING_CUSTOM_DIRECTIVE',
    font: 'font-hacker',
    icon: 'fa-terminal',
    card: 'bg-black border-green-500/20 hover:border-green-400/80 hover:bg-green-500/[0.02]',
    container: 'scanlines'
  }
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);
  const [activeTab, setActiveTab] = useState<'adventures' | 'files' | 'broadcast' | 'custom'>('adventures');
  const [sessionOrigin, setSessionOrigin] = useState<'adventures' | 'files' | 'broadcast' | 'custom' | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [setupConfig, setSetupConfig] = useState<AdventureConfig | null>(null);
  const [audioState, setAudioState] = useState<'suspended' | 'running' | 'closed'>('suspended');
  const [initialHistory, setInitialHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
  const [savedSession, setSavedSession] = useState<{config: AdventureConfig, transcriptions: any[]} | null>(null);

  const theme = THEMES[activeTab];

  useEffect(() => {
    const checkAudio = () => {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const tempCtx = new AudioCtx();
        setAudioState(tempCtx.state);
        tempCtx.onstatechange = () => setAudioState(tempCtx.state);
        setTimeout(() => tempCtx.close(), 1000);
      }
    };
    checkAudio();

    const saved = localStorage.getItem('storyscape_saved_session');
    if (saved) {
      try {
        setSavedSession(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
  }, []);

  const handleFixAudio = async () => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const tempCtx = new AudioCtx();
      await tempCtx.resume();
      setAudioState(tempCtx.state);
      await tempCtx.close();
    }
  };

  const handleStartSetup = (genre: Genre) => {
    setSelectedGenre(genre);
    setSessionOrigin(activeTab);
    setViewMode(ViewMode.SETUP);
  };

  const finalizeSetup = (config: AdventureConfig) => {
    let finalTopic = config.topic.trim();
    if (!finalTopic) {
      const randomTopics: Record<string, string[]> = {
        [Genre.FANTASY]: ["The Crystal Kingdom", "A Curse of Ancient Oaks", "The Sword of Shadows"],
        [Genre.SCIFI]: ["Project Stargate Secrets", "Mars Colony Alpha", "The Quantum Heist"],
        [Genre.MYSTERY]: ["Project Blue Book", "The Case of the Missing Heiress", "Zodiac Re-investigated"],
        [Genre.HORROR]: ["The Winchester House", "Entity from the 4th Dimension", "The Silent Asylum"],
        [Genre.THRILLER]: ["Undercover at the CIA", "The Silk Road Kingpin", "Cold War Sabotage"],
        [Genre.DOCUMENTARY]: ["How project Stargate actually worked", "The physics of Time Travel", "Hidden Civilizations in Antarctica"]
      };
      const genreTopics = randomTopics[config.genre as string] || ["The Unknown Truth"];
      finalTopic = genreTopics[Math.floor(Math.random() * genreTopics.length)];
    }
    setSetupConfig({ ...config, topic: finalTopic });
    setViewMode(ViewMode.ADVENTURE);
  };

  const resumeSession = () => {
    if (savedSession) {
      setSetupConfig(savedSession.config);
      setInitialHistory(savedSession.transcriptions);
      setSessionOrigin(savedSession.config.durationMinutes ? (activeTab === 'broadcast' ? 'broadcast' : 'files') : 'adventures');
      setViewMode(ViewMode.ADVENTURE);
      setSavedSession(null);
    }
  };

  const discardSavedSession = () => {
    localStorage.removeItem('storyscape_saved_session');
    setSavedSession(null);
  };

  const renderHome = () => (
    <div className={`min-h-screen ${theme.bg} ${theme.font} transition-all duration-1000 flex flex-col items-center overflow-x-hidden relative ${theme.container}`}>
      {/* Background Volumetric Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-20%] left-[-10%] w-[80%] h-[80%] ${theme.glow1} blur-[250px] rounded-full animate-float transition-colors duration-1000`}></div>
        <div className={`absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] ${theme.glow2} blur-[250px] rounded-full animate-float transition-colors duration-1000`} style={{animationDelay: '-6s'}}></div>
      </div>

      {/* Primary Navigation */}
      <nav className={`sticky top-0 z-50 w-full glass-dark border-b ${theme.border} transition-colors duration-700 backdrop-blur-xl`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 ${theme.accent}`}>
               <i className={`fas ${theme.icon} animate-pulse`}></i>
            </div>
            <h1 className="text-lg font-black tracking-tighter hidden sm:block uppercase opacity-90">StoryScape</h1>
          </div>
          
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10 scale-90 md:scale-100">
            <TabItem active={activeTab === 'adventures'} onClick={() => setActiveTab('adventures')} label="SAGA" icon="fa-rocket" activeClass={theme.tabActive} />
            <TabItem active={activeTab === 'files'} onClick={() => setActiveTab('files')} label="VAULT" icon="fa-moon" activeClass={theme.tabActive} />
            <TabItem active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} label="CAST" icon="fa-microphone-lines" activeClass={theme.tabActive} />
            <TabItem active={activeTab === 'custom'} onClick={() => setActiveTab('custom')} label="STUDIO" icon="fa-terminal" activeClass={theme.tabActive} />
          </div>

          <div className="flex items-center gap-3">
             <button onClick={handleFixAudio} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all border-white/5">
                <i className={`fas fa-bolt text-sm ${audioState === 'running' ? 'text-yellow-500' : 'text-white/20'}`}></i>
             </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl px-6 py-16 md:py-24 flex flex-col items-center">
        {/* Dynamic Hero Header */}
        <header className="w-full text-center mb-20 animate-in fade-in slide-in-from-top-4 duration-1000">
           <h2 className="text-6xl md:text-9xl font-black tracking-tighter mb-4 text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30 uppercase leading-none">
              {theme.heroTitle}
           </h2>
           <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.6em] ${theme.accent} opacity-90 mt-4 max-w-2xl mx-auto`}>
              {theme.heroSub}
           </p>
        </header>

        {/* Resumption Area */}
        {savedSession && (
          <div className="w-full max-w-4xl mb-20 animate-in fade-in zoom-in-95 duration-700">
            <div className={`p-10 rounded-[4rem] border ${theme.border} bg-white/[0.03] flex flex-col sm:flex-row items-center gap-10 backdrop-blur-md shadow-2xl`}>
              <div className={`w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center ${theme.accent} text-3xl border border-white/5`}>
                <i className="fas fa-history"></i>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">Resume Link</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{savedSession.config.genre} — {savedSession.config.topic}</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={resumeSession} className="flex-1 sm:flex-none px-10 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-xl">Link</button>
                <button onClick={discardSavedSession} className="flex-1 sm:flex-none px-10 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">Abort</button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {activeTab === 'adventures' ? (
            <>
              <HomeCard genre={Genre.FANTASY} icon="fa-dragon" theme={theme} onStart={() => handleStartSetup(Genre.FANTASY)} />
              <HomeCard genre={Genre.SCIFI} icon="fa-user-astronaut" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <HomeCard genre={Genre.MYSTERY} icon="fa-magnifying-glass" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <HomeCard genre={Genre.HORROR} icon="fa-ghost" theme={theme} onStart={() => handleStartSetup(Genre.HORROR)} />
            </>
          ) : activeTab === 'files' ? (
            <>
              <HomeCard genre={Genre.FANTASY} icon="fa-hat-wizard" label="Sleep Tale" theme={theme} onStart={() => handleStartSetup(Genre.FANTASY)} />
              <HomeCard genre={Genre.SCIFI} icon="fa-shuttle-space" label="Void Log" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <HomeCard genre={Genre.MYSTERY} icon="fa-mask" label="Noir Deep" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <HomeCard genre={Genre.HORROR} icon="fa-book-skull" label="Grimoire" theme={theme} onStart={() => handleStartSetup(Genre.HORROR)} />
            </>
          ) : activeTab === 'broadcast' ? (
            <>
              <HomeCard genre={Genre.MYSTERY} icon="fa-user-secret" label="Investigate" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <HomeCard genre={Genre.THRILLER} icon="fa-fingerprint" label="True Crime" theme={theme} onStart={() => handleStartSetup(Genre.THRILLER)} />
              <HomeCard genre={Genre.DOCUMENTARY} icon="fa-earth-americas" label="Documentary" theme={theme} onStart={() => handleStartSetup(Genre.DOCUMENTARY)} />
              <HomeCard genre={Genre.SCIFI} icon="fa-atom" label="Lore" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
            </>
          ) : (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full mx-auto">
               <StudioActionCard title="VOICE_GURU" icon="fa-microphone-lines" desc="ORCHESTRATE MULTI-CHARACTER PRODUCTIONS WITH PRECISION DIALOGUE." theme={theme} onStart={() => setViewMode(ViewMode.SETUP)} />
               <StudioActionCard title="SCRIPT_FORGE" icon="fa-feather-pointed" desc="ARCHITECT LONG-FORM MASTERED AUDIO SCRIPTING AND SOUNDSCAPES." theme={theme} onStart={() => setViewMode(ViewMode.SETUP)} />
            </div>
          )}
        </div>

        {/* Global Footer */}
        <footer className="w-full max-w-3xl flex items-center justify-between border-t border-white/5 pt-12 opacity-30">
           <button onClick={() => setViewMode(ViewMode.FEEDBACK)} className="text-[10px] font-black uppercase tracking-[0.5em] hover:opacity-100 transition-opacity">Protocol Feedback</button>
           <div className="flex gap-6 items-center">
              <i className="fab fa-github hover:opacity-100 cursor-pointer"></i>
              <i className="fab fa-discord hover:opacity-100 cursor-pointer"></i>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] ml-4">v2.1.2_STABLE</span>
           </div>
        </footer>
      </main>
    </div>
  );

  const renderSetup = () => {
    if (activeTab === 'custom') {
      return <VoiceGuruView onExit={() => setViewMode(ViewMode.HOME)} />;
    }
    if (!selectedGenre) return null;
    return <SetupView genre={selectedGenre} origin={sessionOrigin || 'adventures'} onBack={() => setViewMode(ViewMode.HOME)} onConfirm={finalizeSetup} />;
  };

  const renderContent = () => {
    if (viewMode === ViewMode.ADVENTURE && setupConfig) {
      if (sessionOrigin === 'files') {
        return <StoryFilesView config={setupConfig} initialHistory={initialHistory} onExit={() => { setViewMode(ViewMode.HOME); setSetupConfig(null); setSessionOrigin(null); setInitialHistory([]); }} />;
      }
      if (sessionOrigin === 'broadcast') {
        return <PodcastView config={setupConfig} initialHistory={initialHistory} onExit={() => { setViewMode(ViewMode.HOME); setSetupConfig(null); setSessionOrigin(null); setInitialHistory([]); }} />;
      }
      return <AdventureView config={setupConfig} initialHistory={initialHistory} onExit={() => { setViewMode(ViewMode.HOME); setSetupConfig(null); setSessionOrigin(null); setInitialHistory([]); }} />;
    }
    if (viewMode === ViewMode.SETUP) return renderSetup();
    if (viewMode === ViewMode.FEEDBACK) return <FeedbackView onBack={() => setViewMode(ViewMode.HOME)} />;
    return renderHome();
  };

  return <div className="min-h-screen bg-black">{renderContent()}</div>;
};

interface TabItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  activeClass: string;
}

const TabItem: React.FC<TabItemProps> = ({ active, onClick, label, icon, activeClass }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 rounded-full flex items-center gap-3 transition-all duration-500 border border-transparent ${
      active 
        ? `${activeClass} scale-[1.05] z-10` 
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'
    }`}
  >
    <i className={`fas ${icon} text-xs`}></i>
    <span className="text-[10px] font-black tracking-[0.2em] hidden xs:block">{label}</span>
  </button>
);

interface HomeCardProps {
  genre: Genre;
  icon: string;
  theme: any;
  label?: string;
  onStart: () => void;
}

const HomeCard: React.FC<HomeCardProps> = ({ genre, icon, theme, label = "Initialize", onStart }) => (
  <button 
    onClick={onStart}
    className={`group relative p-12 rounded-[4rem] border transition-all duration-700 hover:scale-[1.05] active:scale-95 flex flex-col items-center text-center overflow-hidden h-[340px] justify-center ${theme.card}`}
  >
    <div className={`w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-700 ${theme.accent} border border-white/5 shadow-inner`}>
       <i className={`fas ${icon} text-3xl`}></i>
    </div>
    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 group-hover:tracking-[0.1em] transition-all duration-700 leading-none">{genre}</h3>
    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-70 group-hover:text-white transition-all">{label} Protocol</span>
  </button>
);

interface StudioActionCardProps {
  title: string;
  icon: string;
  desc: string;
  theme: any;
  onStart: () => void;
}

const StudioActionCard: React.FC<StudioActionCardProps> = ({ title, icon, desc, theme, onStart }) => (
  <button 
    onClick={onStart}
    className={`group p-12 rounded-[4.5rem] border transition-all duration-700 hover:scale-[1.02] flex items-center gap-12 text-left ${theme.card}`}
  >
    <div className={`w-24 h-24 rounded-[3rem] bg-white/5 flex items-center justify-center shrink-0 ${theme.accent} border border-white/5 group-hover:rotate-12 transition-transform duration-700 shadow-2xl`}>
       <i className={`fas ${icon} text-4xl`}></i>
    </div>
    <div className="flex-1">
       <h3 className="text-4xl font-black uppercase tracking-tighter mb-3 leading-none">{title}</h3>
       <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 leading-relaxed max-w-md">{desc}</p>
    </div>
    <div className="w-14 h-14 rounded-full glass border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 transition-transform duration-500">
       <i className="fas fa-arrow-right"></i>
    </div>
  </button>
);

interface SetupViewProps {
  genre: Genre;
  origin: 'adventures' | 'files' | 'broadcast' | 'custom';
  onBack: () => void;
  onConfirm: (config: AdventureConfig) => void;
}

const SetupView: React.FC<SetupViewProps> = ({ genre, origin, onBack, onConfirm }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState<GeminiVoice>('Zephyr');
  const [mode, setMode] = useState<NarratorMode>(NarratorMode.SINGLE);
  const [duration, setDuration] = useState(15);

  const currentTheme = THEMES[origin as keyof typeof THEMES] || THEMES.adventures;

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${currentTheme.bg} ${currentTheme.font} relative overflow-hidden`}>
      {/* Background Volumetric Glows for Setup */}
      <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] ${currentTheme.glow1} blur-[200px] rounded-full`}></div>
      
      <div className={`max-w-4xl w-full glass-dark p-12 md:p-20 rounded-[5rem] border ${currentTheme.border} space-y-12 z-10 animate-in fade-in zoom-in-95 duration-500`}>
        <div className="text-center space-y-4">
          <p className={`${currentTheme.accent} uppercase tracking-[0.6em] text-[10px] font-black`}>{genre} Realm Mapping</p>
          <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            {origin === 'broadcast' ? 'Launch Cast' : origin === 'files' ? 'Seal Archive' : 'Forge Reality'}
          </h2>
        </div>

        <div className="space-y-10">
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Chronicle Seed (Optional)</label>
            <input 
              type="text" 
              value={topic} 
              onChange={e => setTopic(e.target.value)}
              placeholder="Leave empty for the Oracle's choice..."
              className="w-full bg-white/5 border border-white/10 rounded-[3rem] px-10 py-8 outline-none focus:border-white/30 transition-all text-2xl font-light placeholder:opacity-10 shadow-inner"
            />
          </div>

          {(origin === 'files' || origin === 'broadcast') && (
            <div className="space-y-8 bg-white/[0.02] p-10 rounded-[4rem] border border-white/5 shadow-2xl">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] uppercase font-black opacity-30 ml-2 tracking-widest">{origin === 'broadcast' ? 'Broadcast Length' : 'Archive Length'}</label>
                <span className={`text-2xl font-black ${currentTheme.accent}`}>{duration} Minutes</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="60" 
                step="5"
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Dialect</label>
              <div className="relative">
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-10 py-6 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  {LANGUAGES.map(l => <option key={l} value={l} className="bg-black">{l}</option>)}
                </select>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Logic Mode</label>
              <div className="relative">
                <select 
                  value={mode} 
                  onChange={e => setMode(e.target.value as NarratorMode)}
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-10 py-6 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  <option value={NarratorMode.SINGLE} className="bg-black">SOLO GUIDE</option>
                  <option value={NarratorMode.MULTI} className="bg-black">ENSEMBLE CAST</option>
                </select>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Select Neural Personality</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col items-center gap-2 p-6 rounded-[2.5rem] border transition-all duration-300 ${voice === v.id ? 'bg-white text-black border-white shadow-2xl scale-110' : 'bg-white/5 border-white/10 opacity-30 hover:opacity-100 hover:scale-105'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 pt-8">
          <button onClick={onBack} className="flex-1 py-8 rounded-[3rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.5em] hover:bg-white/10 transition-all active:scale-95">Abort Link</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, durationMinutes: (origin === 'files' || origin === 'broadcast') ? duration : undefined })} 
            className="flex-[2] py-8 rounded-[3rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.5em] hover:scale-[1.03] transition-all shadow-2xl active:scale-95"
          >
            {origin === 'broadcast' ? 'Initiate CAST' : origin === 'files' ? 'Seal Vault' : `Launch Saga`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
