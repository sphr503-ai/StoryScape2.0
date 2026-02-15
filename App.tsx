import React, { useState, useEffect } from 'react';
import { Genre, ViewMode, AdventureConfig, NarratorMode, GeminiVoice } from './types';
import AdventureView from './components/AdventureView';
import StoryFilesView from './components/StoryFilesView';
import FeedbackView from './components/FeedbackView';
import PodcastView from './components/PodcastView';
import MovieExplainerView from './components/MovieExplainerView';
import LanguageTutorView from './components/LanguageTutorView';
import SecretHubView from './components/SecretHubView';
import { StoryScapeService } from './services/geminiLiveService';

const LANGUAGES = [
  "Hindi", "English", "Spanish", "French", "German", "Japanese", "Arabic", "Russian", "Portuguese", "Italian", "Korean", "Chinese", "Bengali", "Turkish", "Vietnamese", "Urdu", "Marathi", "Telugu", "Tamil"
];

const VOICES: Array<{ id: GeminiVoice; name: string; description: string; gender: 'Male' | 'Female' | 'Neutral'; icon: string }> = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Deep & Commanding', gender: 'Male', icon: 'fa-person' },
  { id: 'Kore', name: 'Kore', description: 'Calm & Graceful', gender: 'Female', icon: 'fa-person-dress' },
  { id: 'Puck', name: 'Puck', description: 'Energetic & Witty', gender: 'Neutral', icon: 'fa-bolt-lightning' },
  { id: 'Charon', name: 'Charon', description: 'Stoic & Wise', gender: 'Male', icon: 'fa-feather-pointed' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Gravelly & Intense', gender: 'Male', icon: 'fa-wolf-pack-battalion' },
];

const THEMES = {
  adventures: {
    bg: 'bg-[#010409]',
    glow1: 'bg-cyan-600/20',
    glow2: 'bg-blue-600/10',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
    border: 'border-cyan-500/20',
    tabActive: 'bg-cyan-500 text-black shadow-[0_0_20px_#22d3ee]',
    heroTitle: 'Adventures',
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
    accentBg: 'bg-red-600',
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
    accentBg: 'bg-violet-500',
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
    accentBg: 'bg-emerald-500',
    border: 'border-emerald-500/20',
    tabActive: 'bg-emerald-600 text-white shadow-[0_0_25px_#10b981]',
    heroTitle: 'Ai Cinema',
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
    accentBg: 'bg-[#00ff41]',
    border: 'border-[#00ff41]/30',
    tabActive: 'bg-[#00ff41] text-black shadow-[0_0_20px_#00ff41]',
    heroTitle: 'Ai Tutor',
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
  const [initialHistory, setInitialHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
  const [savedSession, setSavedSession] = useState<{config: AdventureConfig, transcriptions: any[]} | null>(null);

  const theme = THEMES[activeTab as keyof typeof THEMES];

  useEffect(() => {
    const saved = localStorage.getItem('storyscape_saved_session');
    if (saved) {
      try {
        setSavedSession(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
  }, [viewMode]);

  const handleStartSetup = (genre: Genre) => {
    setSelectedGenre(genre);
    setSessionOrigin(activeTab);
    setViewMode(ViewMode.SETUP);
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
        const moviePool = ["Inception", "Interstellar", "The Matrix", "Pulp Fiction", "The Prestige"];
        finalTopic = config.isOriginalScript ? "The Shadow Protocol" : moviePool[Math.floor(Math.random() * moviePool.length)];
    } else if (activeTab === 'tutor' && !finalTopic) {
        finalTopic = "Daily Conversation";
    }

    setSetupConfig({ ...config, topic: finalTopic });
    setViewMode(ViewMode.ADVENTURE);
  };

  const handleClearEverything = () => {
    setViewMode(ViewMode.HOME);
    setSetupConfig(null);
    setSessionOrigin(null);
    setInitialHistory([]);
  };

  const handleBackToSetup = () => {
    setViewMode(ViewMode.SETUP);
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
          
          <div className="flex bg-white/5 rounded-full p-1 border border-white/5 scale-90 sm:scale-100 overflow-x-auto no-scrollbar">
            <TabItem active={activeTab === 'adventures'} onClick={() => setActiveTab('adventures'} label="ADVENTURE" icon="fa-rocket" activeClass={THEMES.adventures.tabActive} />
            <TabItem active={activeTab === 'files'} onClick={() => setActiveTab('files')} label="VAULT" icon="fa-moon" activeClass={THEMES.files.tabActive} />
            <TabItem active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} label="CAST" icon="fa-microphone-lines" activeClass={THEMES.broadcast.tabActive} />
            <TabItem active={activeTab === 'explainer'} onClick={() => setActiveTab('explainer')} label="CINE" icon="fa-film" activeClass={THEMES.explainer.tabActive} />
            <TabItem active={activeTab === 'tutor'} onClick={() => setActiveTab('tutor')} label="TUTOR" icon="fa-terminal" activeClass={THEMES.tutor.tabActive} />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode(ViewMode.FEEDBACK)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all border-white/5"
              title="Transmissions"
            >
               <i className="fas fa-comment-dots text-xs opacity-60"></i>
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl px-6 pt-24 pb-16 flex flex-col items-center">
        <header className="w-full text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
           <div className="flex items-center justify-center gap-3 mb-6">
              <span className={`px-4 py-1.5 rounded-full glass border ${theme.border} text-[8px] font-black uppercase tracking-[0.4em] ${theme.accent}`}>
                {theme.tag}
              </span>
           </div>
           <h2 className={`text-5xl md:text-[9rem] font-black tracking-tighter mb-4 text-glow bg-clip-text text-transparent bg-gradient-to-b ${activeTab === 'tutor' ? 'from-[#00ff41] to-[#004d13]' : 'from-white to-white/40'} uppercase leading-[0.85] py-2`}>
              {theme.heroTitle}
           </h2>
           <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.6em] ${theme.accent} opacity-90 mt-4 max-w-2xl mx-auto leading-relaxed`}>
              {theme.heroSub}
           </p>
        </header>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-24">
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
        return <StoryFilesView config={setupConfig} initialHistory={initialHistory} onBack={handleBackToSetup} onExit={handleClearEverything} />;
      }
      if (sessionOrigin === 'broadcast') {
        return <PodcastView config={setupConfig} initialHistory={initialHistory} onBack={handleBackToSetup} onExit={handleClearEverything} />;
      }
      if (sessionOrigin === 'explainer') {
        return <MovieExplainerView config={setupConfig} initialHistory={initialHistory} onBack={handleBackToSetup} onExit={handleClearEverything} />;
      }
      if (sessionOrigin === 'tutor') {
        return <LanguageTutorView config={setupConfig} initialHistory={initialHistory} onBack={handleBackToSetup} onExit={handleClearEverything} />;
      }
      return <AdventureView config={setupConfig} initialHistory={initialHistory} onBack={handleBackToSetup} onExit={handleClearEverything} />;
    }
    if (viewMode === ViewMode.SETUP) return renderSetup();
    if (viewMode === ViewMode.FEEDBACK) return <FeedbackView onBack={() => setViewMode(ViewMode.HOME)} onSecretAccess={() => setViewMode(ViewMode.SECRET_HUB)} />;
    if (viewMode === ViewMode.SECRET_HUB) return <SecretHubView onExit={() => setViewMode(ViewMode.HOME)} />;
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
    className={`px-3 sm:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-500 border border-transparent shrink-0 ${
      active 
        ? `${activeClass} scale-[1.05] z-10 font-black` 
        : 'text-white/30 hover:text-white/60 hover:bg-white/5 font-bold'
    }`}
  >
    <i className={`fas ${icon} text-[10px]`}></i>
    <span className="text-[9px] tracking-[0.2em]">{label}</span>
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
    className={`group relative p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border transition-all duration-700 hover:scale-[1.03] active:scale-95 flex flex-col items-center text-center overflow-hidden h-[280px] md:h-[340px] justify-center ${theme.card}`}
  >
    <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>
    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[2rem] md:rounded-[2.5rem] bg-white/5 flex items-center justify-center mb-6 md:mb-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ${theme.accent} border border-white/5 shadow-inner`}>
       <i className={`fas ${icon} text-2xl md:text-3xl`}></i>
    </div>
    <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-2 group-hover:tracking-[0.1em] transition-all duration-700 leading-none">
        {label === "Link" ? genre : label}
    </h3>
    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-80 group-hover:text-white transition-all">Link Protocol</span>
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
  const [isRandomizing, setIsRandomizing] = useState(false);

  const currentTheme = THEMES[origin as keyof typeof THEMES] || THEMES.adventures;

  const handleRandomize = async () => {
    setIsRandomizing(true);
    try {
      const service = new StoryScapeService();
      const trending = await service.fetchTrendingTopic(genre, origin);
      setTopic(trending);
    } catch (err) {
      console.error("Failed to randomize topic", err);
    } finally {
      setIsRandomizing(false);
    }
  };

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
              <label className="text-xs font-bold uppercase block opacity-40">{" > "} ENTER_SESSION_TOPIC_STRING:</label>
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
                <label className="text-xs font-bold uppercase block opacity-40">{" > "} SELECT_LANGUAGE:</label>
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-black border border-[#00ff41]/20 p-2 outline-none focus:border-[#00ff41] text-xs uppercase"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase block opacity-40">{" > "} SELECT_SENSEI_GENDER:</label>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setVoice('Zephyr')} 
                     className={`flex-1 py-2 border text-[10px] font-bold uppercase transition-all ${VOICES.find(v => v.id === voice)?.gender === 'Male' ? 'bg-[#00ff41] text-black border-[#00ff41]' : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/5'}`}
                   >
                     MALE
                   </button>
                   <button 
                     onClick={() => setVoice('Kore')} 
                     className={`flex-1 py-2 border text-[10px] font-bold uppercase transition-all ${VOICES.find(v => v.id === voice)?.gender === 'Female' ? 'bg-[#00ff41] text-black border-[#00ff41]' : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/5'}`}
                   >
                     FEMALE
                   </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold uppercase block opacity-40">{" > "} SELECT_SENSEI_VOICE:</label>
                <select 
                  value={voice} 
                  onChange={e => setVoice(e.target.value as GeminiVoice)}
                  className="w-full bg-black border border-[#00ff41]/20 p-2 outline-none focus:border-[#00ff41] text-xs uppercase"
                >
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} ({v.gender}) - {v.description}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-40 uppercase font-bold">{" > "} DURATION_LIMIT:</span>
                <span className="font-bold">{duration}m</span>
              </div>
              <input 
                type="range" min="5" max="60" step="5" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-[#00ff41]/10 rounded-lg appearance-none cursor-pointer accent-[#00ff41]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-6">
            <button 
              onClick={() => onConfirm({ genre, topic, language, voice, mode, isOriginalScript: isOriginal, durationMinutes: duration })} 
              className="w-full py-3 bg-[#00ff41] text-black text-xs font-bold uppercase hover:bg-[#00ff41]/80 transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)]"
            >
              [ENTER] START_IMMERSION
            </button>
            <button onClick={onBack} className="w-full py-3 border border-[#00ff41]/30 text-xs font-bold uppercase hover:bg-[#00ff41]/10 transition-all">
              [ESC] ABORT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 md:p-8 ${currentTheme.bg} ${currentTheme.font} relative overflow-hidden`}>
      {/* Dynamic Themed Glows */}
      <div className={`absolute top-[-10%] right-[-10%] w-[60%] h-[60%] ${currentTheme.glow1} blur-[150px] md:blur-[200px] rounded-full`}></div>
      <div className={`absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] ${currentTheme.glow2} blur-[150px] md:blur-[200px] rounded-full`}></div>
      
      {/* Cinematic Scanner Beam */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="w-full h-[2px] bg-white/10 absolute top-0 animate-[scan_8s_ease-in-out_infinite]"></div>
      </div>

      <div className={`max-w-4xl w-full glass-dark p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] border ${currentTheme.border} space-y-8 md:space-y-12 z-10 animate-in fade-in zoom-in-95 duration-500 shadow-2xl relative overflow-hidden`}>
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <p className={`${currentTheme.accent} uppercase tracking-[0.4em] md:tracking-[0.6em] text-[9px] md:text-[10px] font-black animate-pulse`}>Link Verification Protocol</p>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white">
            {origin === 'broadcast' ? 'Initiate Cast' : origin === 'files' ? 'Seal Vault' : origin === 'explainer' ? 'Initiate Decoder' : 'Forge Adventure'}
          </h2>
        </div>

        <div className="space-y-8">
          {/* Chronicle Seed Input */}
          <div className="space-y-3">
            <div className="flex justify-between items-end ml-4">
              <label className="text-[9px] md:text-[10px] uppercase font-black opacity-40 tracking-[0.3em]">
                  {origin === 'explainer' ? (isOriginal ? 'Original Movie Title' : 'Existing Movie Name') : 'Chronicle Seed (Optional)'}
              </label>
              <button 
                onClick={handleRandomize} 
                disabled={isRandomizing}
                className={`text-[8px] font-black uppercase tracking-widest ${currentTheme.accent} opacity-60 hover:opacity-100 flex items-center gap-2 transition-opacity`}
              >
                <i className={`fas fa-wand-magic-sparkles ${isRandomizing ? 'fa-spin' : ''}`}></i>
                {isRandomizing ? 'Searching Web...' : 'Surprise Me'}
              </button>
            </div>
            <div className="relative group">
               <input 
                type="text" 
                value={topic} 
                onChange={e => setTopic(e.target.value)}
                placeholder={origin === 'explainer' ? "e.g. Inception..." : "Leave empty for AI choice..."}
                className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] md:rounded-[2rem] px-6 md:px-8 py-5 md:py-6 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all text-lg md:text-xl font-light placeholder:opacity-20 shadow-inner group-hover:border-white/20"
              />
              <div className={`absolute bottom-0 left-8 right-8 h-[1px] ${currentTheme.accentBg} opacity-0 group-focus-within:opacity-100 transition-opacity blur-[2px]`}></div>
            </div>
          </div>

          {/* Language Selection (Scrollable Pills) */}
          <div className="space-y-3">
            <label className="text-[9px] md:text-[10px] uppercase font-black opacity-40 ml-4 tracking-[0.3em]">Narrator Language</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
               {LANGUAGES.map(lang => (
                 <button 
                   key={lang}
                   onClick={() => setLanguage(lang)}
                   className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border ${language === lang ? `${currentTheme.accentBg} text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.2)]` : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                 >
                   {lang}
                 </button>
               ))}
            </div>
          </div>

          {/* Persona Grid Selection */}
          <div className="space-y-3">
            <label className="text-[9px] md:text-[10px] uppercase font-black opacity-40 ml-4 tracking-[0.3em]">Persona Deck</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
               {VOICES.map(v => (
                 <button 
                   key={v.id}
                   onClick={() => setVoice(v.id)}
                   className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-4 ${voice === v.id ? `bg-white text-black border-transparent shadow-xl scale-[1.02]` : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'}`}
                 >
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${voice === v.id ? 'bg-black text-white' : 'bg-white/5 text-white/60'}`}>
                      <i className={`fas ${v.icon} text-sm`}></i>
                   </div>
                   <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest truncate">{v.name}</div>
                      <div className="text-[8px] font-bold opacity-60 truncate mt-1">{v.description}</div>
                   </div>
                 </button>
               ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 pt-4">
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, isOriginalScript: isOriginal, durationMinutes: duration })} 
            className={`w-full py-5 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] ${currentTheme.accentBg} text-black text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] transition-all shadow-2xl active:scale-95 relative group overflow-hidden`}
          >
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <span className="relative z-10">{origin === 'explainer' ? 'Start Recap' : `Launch Protocol`}</span>
          </button>
          <button 
            onClick={onBack} 
            className="w-full py-5 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all active:scale-95 text-white/60"
          >
            Abort Link
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ` }} />
    </div>
  );
};

export default App;