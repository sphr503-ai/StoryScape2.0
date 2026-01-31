
import React, { useState, useEffect } from 'react';
import { Genre, ViewMode, AdventureConfig, NarratorMode, GeminiVoice } from './types';
import AdventureView from './components/AdventureView';
import StoryFilesView from './components/StoryFilesView';
import FeedbackView from './components/FeedbackView';
import PodcastView from './components/PodcastView';
import MovieExplainerView from './components/MovieExplainerView';
import LanguageTutorView from './components/LanguageTutorView';

const LANGUAGES = [
  "Hindi", "English", "Spanish", "French", "German", "Japanese", "Arabic", "Russian", "Portuguese", "Italian", "Korean", "Chinese", "Bengali", "Turkish", "Vietnamese", "Urdu", "Marathi", "Telugu", "Tamil"
];

const VOICES: Array<{ id: GeminiVoice; name: string; description: string }> = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Deep & Commanding' },
  { id: 'Puck', name: 'Puck', description: 'Energetic & Witty' },
  { id: 'Charon', name: 'Charon', description: 'Stoic & Wise' },
  { id: 'Kore', name: 'Kore', description: 'Calm & Graceful' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Gravelly & Intense' },
];

const THEMES = {
  adventures: {
    bg: 'bg-[#010409]',
    glow1: 'bg-cyan-600/20',
    glow2: 'bg-blue-600/10',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/20',
    tabActive: 'bg-cyan-500 text-black shadow-[0_0_20px_#22d3ee]',
    heroTitle: 'NEURAL_SAGA',
    heroSub: 'INTERACTIVE DESTINY ARCHITECT',
    font: 'font-scifi',
    icon: 'fa-wand-magic-sparkles',
    card: 'glass border-cyan-500/10 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]',
    tag: 'SYSTEM: ACTIVE'
  },
  files: {
    bg: 'bg-[#080303]',
    glow1: 'bg-red-900/20',
    glow2: 'bg-orange-950/10',
    accent: 'text-red-500',
    border: 'border-red-900/30',
    tabActive: 'bg-red-900 text-white border-red-500 shadow-[0_0_25px_#ef4444]',
    heroTitle: 'THE_VAULT',
    heroSub: 'DEEP SLEEP & ANCIENT CHRONICLES',
    font: 'font-fantasy',
    icon: 'fa-moon',
    card: 'bg-black/40 border-red-900/30 hover:border-red-500/40 hover:shadow-[0_0_40px_rgba(239,68,68,0.05)]',
    tag: 'STATUS: TRANQUIL'
  },
  broadcast: {
    bg: 'bg-[#050512]',
    glow1: 'bg-violet-600/20',
    glow2: 'bg-indigo-900/15',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    tabActive: 'bg-violet-600 text-white shadow-[0_0_25px_#8b5cf6]',
    heroTitle: 'ON_AIR',
    heroSub: 'MYSTERY, KNOWLEDGE & TRUE CRIME',
    font: 'font-sans',
    icon: 'fa-microphone-lines',
    card: 'glass border-violet-500/10 hover:border-violet-400/50 hover:shadow-[0_0_35px_rgba(139,92,246,0.15)]',
    tag: 'MODE: INVESTIGATIVE'
  },
  explainer: {
    bg: 'bg-[#020d0a]',
    glow1: 'bg-emerald-600/20',
    glow2: 'bg-teal-900/15',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    tabActive: 'bg-emerald-600 text-white shadow-[0_0_25px_#10b981]',
    heroTitle: 'NEURAL_CINE',
    heroSub: 'THE ULTIMATE MOVIE DECODER',
    font: 'font-sans',
    icon: 'fa-film',
    card: 'glass border-emerald-500/10 hover:border-emerald-400/50 hover:shadow-[0_0_35px_rgba(16,185,129,0.15)]',
    tag: 'MODE: EXPLAINER'
  },
  tutor: {
    bg: 'bg-[#020202]',
    glow1: 'bg-[#00ff41]/5',
    glow2: 'bg-[#00ff41]/2',
    accent: 'text-[#00ff41]',
    border: 'border-[#00ff41]/30',
    tabActive: 'bg-[#00ff41] text-black shadow-[0_0_20px_#00ff41]',
    heroTitle: 'NEURAL_TUTOR',
    heroSub: 'CORE_SYLLABUS_OVERRIDE_V4',
    font: 'font-hacker',
    icon: 'fa-terminal',
    card: 'bg-black border-[#00ff41]/20 hover:border-[#00ff41]/60 hover:shadow-[0_0_30px_rgba(0,255,65,0.1)]',
    tag: 'STATUS: ROOT_ACCESS'
  }
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);
  const [activeTab, setActiveTab] = useState<'adventures' | 'files' | 'broadcast' | 'explainer' | 'tutor'>('adventures');
  const [sessionOrigin, setSessionOrigin] = useState<'adventures' | 'files' | 'broadcast' | 'explainer' | 'tutor' | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [setupConfig, setSetupConfig] = useState<AdventureConfig | null>(null);
  const [audioState, setAudioState] = useState<'suspended' | 'running' | 'closed'>('suspended');
  const [initialHistory, setInitialHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
  const [savedSession, setSavedSession] = useState<{config: AdventureConfig, transcriptions: any[]} | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState<Genre | null>(null);

  const theme = THEMES[activeTab as keyof typeof THEMES];

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
  }, [viewMode]);

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
    if (savedSession) {
      setShowDraftPrompt(genre);
    } else {
      setSelectedGenre(genre);
      setSessionOrigin(activeTab);
      setViewMode(ViewMode.SETUP);
    }
  };

  const finalizeSetup = (config: AdventureConfig) => {
    let finalTopic = config.topic.trim();
    if (!finalTopic && activeTab !== 'explainer' && activeTab !== 'tutor') {
      const randomTopics: Record<string, string[]> = {
        [Genre.FANTASY]: ["The Floating Citadel", "A Whisper in the Iron Woods", "The Alchemist's Mistake"],
        [Genre.SCIFI]: ["Glitched Orbit 44", "The Last Signal from Europa", "Neon Rain Over Sector 7"],
        [Genre.MYSTERY]: ["The Shadow in the Library", "Protocol 09: Broken Ground", "The Unseen Witness"],
        [Genre.HORROR]: ["The Crawling Mist", "Mirror to the Void", "Silence in the Ward"],
        [Genre.THRILLER]: ["The Midnight Cipher", "Double Agent's Gamble", "The Concrete Labyrinth"],
        [Genre.DOCUMENTARY]: ["The Truth Behind Project Stargate", "Hidden Depth", "The Great Library Conspiracy"]
      };
      const genreTopics = randomTopics[config.genre as string] || ["A Narrative Anomaly"];
      finalTopic = genreTopics[Math.floor(Math.random() * genreTopics.length)];
    } else if (activeTab === 'explainer' && !finalTopic) {
        finalTopic = config.isOriginalScript ? "The Shadow Protocol" : "Inception";
    } else if (activeTab === 'tutor' && !finalTopic) {
        finalTopic = "Daily Conversation";
    }

    setSetupConfig({ ...config, topic: finalTopic });
    setViewMode(ViewMode.ADVENTURE);
  };

  const resumeSession = () => {
    if (savedSession) {
      setSetupConfig(savedSession.config);
      setInitialHistory(savedSession.transcriptions);
      
      let origin: 'adventures' | 'files' | 'broadcast' | 'explainer' | 'tutor' = 'adventures';
      if (savedSession.config.durationMinutes) {
          if (activeTab === 'broadcast') origin = 'broadcast';
          else if (activeTab === 'explainer') origin = 'explainer';
          else if (activeTab === 'tutor') origin = 'tutor';
          else origin = 'files';
      }
      
      setSessionOrigin(origin);
      setViewMode(ViewMode.ADVENTURE);
      setSavedSession(null);
      setShowDraftPrompt(null);
    }
  };

  const startNewSession = (genre: Genre) => {
    localStorage.removeItem('storyscape_saved_session');
    setSavedSession(null);
    setShowDraftPrompt(null);
    setSelectedGenre(genre);
    setSessionOrigin(activeTab);
    setViewMode(ViewMode.SETUP);
  };

  const discardSavedSession = () => {
    localStorage.removeItem('storyscape_saved_session');
    setSavedSession(null);
    setShowDraftPrompt(null);
  };

  const renderHome = () => (
    <div className={`min-h-screen ${theme.bg} ${theme.font} transition-all duration-1000 flex flex-col items-center overflow-x-hidden relative`}>
      {activeTab === 'tutor' && <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] scanlines"></div>}
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-20%] left-[-5%] w-[80%] h-[80%] ${theme.glow1} blur-[250px] rounded-full animate-float transition-colors duration-1000`}></div>
        <div className={`absolute bottom-[-15%] right-[-5%] w-[70%] h-[70%] ${theme.glow2} blur-[250px] rounded-full animate-float transition-colors duration-1000`} style={{animationDelay: '-6s'}}></div>
      </div>

      <nav className={`sticky top-6 z-50 w-[95%] max-w-4xl glass-dark border ${theme.border} rounded-full transition-colors duration-700 backdrop-blur-3xl shadow-2xl`}>
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 ${theme.accent}`}>
               <i className={`fas ${theme.icon} text-sm animate-pulse`}></i>
            </div>
            <h1 className="text-sm font-black tracking-tighter hidden lg:block uppercase opacity-90">StoryScape 2.0</h1>
          </div>
          
          <div className="flex bg-white/5 rounded-full p-1 border border-white/5 scale-90 sm:scale-100">
            <TabItem active={activeTab === 'adventures'} onClick={() => setActiveTab('adventures')} label="SAGA" icon="fa-rocket" activeClass={THEMES.adventures.tabActive} />
            <TabItem active={activeTab === 'files'} onClick={() => setActiveTab('files')} label="VAULT" icon="fa-moon" activeClass={THEMES.files.tabActive} />
            <TabItem active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} label="CAST" icon="fa-microphone-lines" activeClass={THEMES.broadcast.tabActive} />
            <TabItem active={activeTab === 'explainer'} onClick={() => setActiveTab('explainer')} label="CINE" icon="fa-film" activeClass={THEMES.explainer.tabActive} />
            <TabItem active={activeTab === 'tutor'} onClick={() => setActiveTab('tutor')} label="TUTOR" icon="fa-terminal" activeClass={THEMES.tutor.tabActive} />
          </div>

          <button onClick={handleFixAudio} className="w-8 h-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all border-white/5">
             <i className={`fas fa-bolt text-[10px] ${audioState === 'running' ? 'text-yellow-500' : 'text-white/20'}`}></i>
          </button>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl px-6 pt-24 pb-16 flex flex-col items-center">
        <header className="w-full text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
           <div className="flex items-center justify-center gap-3 mb-6">
              <span className={`px-4 py-1.5 rounded-full glass border ${theme.border} text-[8px] font-black uppercase tracking-[0.4em] ${theme.accent}`}>
                {theme.tag}
              </span>
           </div>
           <h2 className={`text-7xl md:text-[9rem] font-black tracking-tighter mb-4 text-glow bg-clip-text text-transparent bg-gradient-to-b ${activeTab === 'tutor' ? 'from-[#00ff41] to-[#004d13]' : 'from-white to-white/40'} uppercase leading-[0.85] py-2`}>
              {theme.heroTitle}
           </h2>
           <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.6em] ${theme.accent} opacity-90 mt-4 max-w-2xl mx-auto leading-relaxed`}>
              {theme.heroSub}
           </p>
        </header>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {activeTab === 'adventures' ? (
            <>
              <PortalCard genre={Genre.FANTASY} icon="fa-dragon" theme={theme} onStart={() => handleStartSetup(Genre.FANTASY)} />
              <PortalCard genre={Genre.SCIFI} icon="fa-user-astronaut" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <PortalCard genre={Genre.MYSTERY} icon="fa-magnifying-glass" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <PortalCard genre={Genre.HORROR} icon="fa-ghost" theme={theme} onStart={() => handleStartSetup(Genre.HORROR)} />
            </>
          ) : activeTab === 'files' ? (
            <>
              <PortalCard genre={Genre.FANTASY} icon="fa-hat-wizard" label="Deep Sleep" theme={theme} onStart={() => handleStartSetup(Genre.FANTASY)} />
              <PortalCard genre={Genre.SCIFI} icon="fa-shuttle-space" label="Void Log" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <PortalCard genre={Genre.MYSTERY} icon="fa-mask" label="Noir Deep" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <PortalCard genre={Genre.HORROR} icon="fa-book-skull" label="Grimoire" theme={theme} onStart={() => handleStartSetup(Genre.HORROR)} />
            </>
          ) : activeTab === 'broadcast' ? (
            <>
              <PortalCard genre={Genre.MYSTERY} icon="fa-user-secret" label="Investigate" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <PortalCard genre={Genre.THRILLER} icon="fa-fingerprint" label="True Crime" theme={theme} onStart={() => handleStartSetup(Genre.THRILLER)} />
              <PortalCard genre={Genre.DOCUMENTARY} icon="fa-earth-americas" label="Deep Dive" theme={theme} onStart={() => handleStartSetup(Genre.DOCUMENTARY)} />
              <PortalCard genre={Genre.SCIFI} icon="fa-atom" label="Discovery" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
            </>
          ) : activeTab === 'explainer' ? (
            <>
              <PortalCard genre={Genre.HORROR} icon="fa-skull" label="Horror Recap" theme={theme} onStart={() => handleStartSetup(Genre.HORROR)} />
              <PortalCard genre={Genre.SCIFI} icon="fa-rocket" label="Action Decoder" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <PortalCard genre={Genre.MYSTERY} icon="fa-mask" label="Crime Explainer" theme={theme} onStart={() => handleStartSetup(Genre.MYSTERY)} />
              <PortalCard genre={Genre.THRILLER} icon="fa-bolt" label="War Decoder" theme={theme} onStart={() => handleStartSetup(Genre.THRILLER)} />
            </>
          ) : (
            <>
              <PortalCard genre={Genre.DOCUMENTARY} icon="fa-keyboard" label="Terminal A" theme={theme} onStart={() => handleStartSetup(Genre.DOCUMENTARY)} />
              <PortalCard genre={Genre.SCIFI} icon="fa-code" label="Terminal B" theme={theme} onStart={() => handleStartSetup(Genre.SCIFI)} />
              <PortalCard genre={Genre.FANTASY} icon="fa-bug" label="Terminal C" theme={theme} onStart={() => handleStartSetup(Genre.FANTASY)} />
              <PortalCard genre={Genre.THRILLER} icon="fa-shield-halved" label="Terminal D" theme={theme} onStart={() => handleStartSetup(Genre.THRILLER)} />
            </>
          )}
        </div>
      </main>
    </div>
  );

  const renderSetup = () => {
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
      if (sessionOrigin === 'explainer') {
        return <MovieExplainerView config={setupConfig} initialHistory={initialHistory} onExit={() => { setViewMode(ViewMode.HOME); setSetupConfig(null); setSessionOrigin(null); setInitialHistory([]); }} />;
      }
      if (sessionOrigin === 'tutor') {
        return <LanguageTutorView config={setupConfig} initialHistory={initialHistory} onExit={() => { setViewMode(ViewMode.HOME); setSetupConfig(null); setSessionOrigin(null); setInitialHistory([]); }} />;
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
    className={`px-4 sm:px-5 py-2.5 rounded-full flex items-center gap-3 transition-all duration-500 border border-transparent ${
      active 
        ? `${activeClass} scale-[1.05] z-10 font-black` 
        : 'text-white/30 hover:text-white/60 hover:bg-white/5 font-bold'
    }`}
  >
    <i className={`fas ${icon} text-[10px]`}></i>
    <span className="text-[9px] tracking-[0.2em] hidden xs:block">{label}</span>
  </button>
);

interface PortalCardProps {
  genre: Genre;
  icon: string;
  theme: any;
  label?: string;
  onStart: () => void;
}

const PortalCard: React.FC<PortalCardProps> = ({ genre, icon, theme, label = "Link", onStart }) => (
  <button 
    onClick={onStart}
    className={`group relative p-12 rounded-[4rem] border transition-all duration-700 hover:scale-[1.05] active:scale-95 flex flex-col items-center text-center overflow-hidden h-[340px] justify-center ${theme.card}`}
  >
    <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>
    <div className={`w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ${theme.accent} border border-white/5 shadow-inner`}>
       <i className={`fas ${icon} text-3xl`}></i>
    </div>
    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 group-hover:tracking-[0.1em] transition-all duration-700 leading-none">
        {label === "Link" ? genre : label}
    </h3>
    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-80 group-hover:text-white transition-all">Link Protocol</span>
  </button>
);

interface SetupViewProps {
  genre: Genre;
  origin: 'adventures' | 'files' | 'broadcast' | 'explainer' | 'tutor';
  onBack: () => void;
  onConfirm: (config: AdventureConfig) => void;
}

const SetupView: React.FC<SetupViewProps> = ({ genre, origin, onBack, onConfirm }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState<GeminiVoice>('Zephyr');
  const [mode, setMode] = useState<NarratorMode>(NarratorMode.SINGLE);
  const [duration, setDuration] = useState(25);
  const [isOriginal, setIsOriginal] = useState(false);

  const currentTheme = THEMES[origin as keyof typeof THEMES] || THEMES.adventures;

  // Dedicated Terminal Setup UI for Tutor mode
  if (origin === 'tutor') {
    return (
      <div className="min-h-screen bg-black text-[#00ff41] font-hacker flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] scanlines"></div>
        <div className="max-w-2xl w-full border border-[#00ff41]/30 bg-black p-8 md:p-12 space-y-8 animate-in fade-in zoom-in-95 duration-500 relative">
          <div className="border-b border-[#00ff41]/30 pb-4 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold tracking-tighter uppercase">CONFIG_INIT: TUTOR_PROTOCOL</h2>
              <p className="text-[10px] opacity-60">SYSTEM_TIME: {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] block opacity-40">PORT: 8080</span>
              <span className="text-[10px] block opacity-40">ENCRYPTION: AES-256</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase block opacity-40">{">"} ENTER_SESSION_TOPIC_STRING:</label>
              <input 
                type="text" 
                value={topic} 
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. DAILY_ROUTINE"
                className="w-full bg-transparent border-b border-[#00ff41]/20 py-2 outline-none focus:border-[#00ff41] text-[#00ff41] placeholder-[#00ff41]/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase block opacity-40">{">"} SELECT_LANGUAGE:</label>
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-black border border-[#00ff41]/20 p-2 outline-none focus:border-[#00ff41] text-xs uppercase"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase block opacity-40">{">"} SELECT_SENSEI_VOICE:</label>
                <select 
                  value={voice} 
                  onChange={e => setVoice(e.target.value as GeminiVoice)}
                  className="w-full bg-black border border-[#00ff41]/20 p-2 outline-none focus:border-[#00ff41] text-xs uppercase"
                >
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-40 uppercase font-bold">{">"} DURATION_LIMIT:</span>
                <span className="font-bold">{duration}m</span>
              </div>
              <input 
                type="range" min="5" max="60" step="5" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-[#00ff41]/10 rounded-lg appearance-none cursor-pointer accent-[#00ff41]"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button onClick={onBack} className="flex-1 py-3 border border-[#00ff41]/30 text-xs font-bold uppercase hover:bg-[#00ff41]/10 transition-all">
              [ESC] ABORT
            </button>
            <button 
              onClick={() => onConfirm({ genre, topic, language, voice, mode, isOriginalScript: isOriginal, durationMinutes: duration })} 
              className="flex-[2] py-3 bg-[#00ff41] text-black text-xs font-bold uppercase hover:bg-[#00ff41]/80 transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)]"
            >
              [ENTER] START_IMMERSION
            </button>
          </div>
          <div className="pt-4 text-[8px] opacity-20 text-center uppercase tracking-widest animate-pulse">
            Warning: Protocol bypass active. Monitoring neural pathways...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${currentTheme.bg} ${currentTheme.font} relative overflow-hidden`}>
      <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] ${currentTheme.glow1} blur-[200px] rounded-full`}></div>
      
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar glass-dark p-12 md:p-20 rounded-[5rem] border ${currentTheme.border} space-y-12 z-10 animate-in fade-in zoom-in-95 duration-500 shadow-2xl`}>
        <div className="text-center space-y-4">
          <p className={`${currentTheme.accent} uppercase tracking-[0.6em] text-[10px] font-black`}>Link Verification</p>
          <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            {origin === 'broadcast' ? 'Initiate Cast' : origin === 'files' ? 'Seal Vault' : origin === 'explainer' ? 'Initiate Decoder' : 'Forge Saga'}
          </h2>
        </div>

        <div className="space-y-10">
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">
                {origin === 'explainer' ? (isOriginal ? 'Original Movie Title' : 'Existing Movie Name') : 'Chronicle Seed (Optional)'}
            </label>
            <input 
              type="text" 
              value={topic} 
              onChange={e => setTopic(e.target.value)}
              placeholder={origin === 'explainer' ? "e.g. Inception..." : "Leave empty for AI choice..."}
              className="w-full bg-white/5 border border-white/10 rounded-[3rem] px-10 py-8 outline-none focus:border-white/30 transition-all text-2xl font-light placeholder:opacity-10 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Narrator Language</label>
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
              <label className="text-[10px] uppercase font-black opacity-30 ml-6 tracking-[0.4em]">Persona</label>
              <div className="relative">
                <select 
                  value={voice} 
                  onChange={e => setVoice(e.target.value as GeminiVoice)}
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-10 py-6 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  {VOICES.map(v => <option key={v.id} value={v.id} className="bg-black">{v.name} ({v.description})</option>)}
                </select>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 pt-8">
          <button onClick={onBack} className="flex-1 py-8 rounded-[3rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.5em] hover:bg-white/10 transition-all active:scale-95">Abort Link</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, isOriginalScript: isOriginal, durationMinutes: duration })} 
            className="flex-[2] py-8 rounded-[3rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.5em] hover:scale-[1.03] transition-all shadow-2xl active:scale-95"
          >
            {origin === 'explainer' ? 'Start Recap' : `Launch Protocol`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
