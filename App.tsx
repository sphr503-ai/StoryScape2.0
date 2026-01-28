
import React, { useState, useEffect } from 'react';
import { Genre, ViewMode, AdventureConfig, NarratorMode, GeminiVoice } from './types';
import AdventureView from './components/AdventureView';
import StoryFilesView from './components/StoryFilesView';
import VoiceGuruView from './components/VoiceGuruView';
import FeedbackView from './components/FeedbackView';

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Hindi", "Japanese", "Chinese", "Arabic"
];

const VOICES: Array<{ id: GeminiVoice; name: string; description: string }> = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Warm & Encouraging' },
  { id: 'Puck', name: 'Puck', description: 'Youthful & Energetic' },
  { id: 'Charon', name: 'Charon', description: 'Stoic & Deep' },
  { id: 'Kore', name: 'Kore', description: 'Calm & Graceful' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Gravelly & Intense' },
];

const THEMES = {
  adventures: {
    bg: 'bg-[#020205]',
    glow1: 'bg-indigo-600/10',
    glow2: 'bg-purple-600/10',
    accent: 'text-indigo-400',
    tabActive: 'bg-indigo-600 text-white',
    cardBorder: 'hover:border-indigo-500/30',
    heroTitle: 'Live Saga Engine',
    heroDesc: 'Infinite interactive audio adventures. Your choices weave the reality.',
    font: 'font-sans'
  },
  files: {
    bg: 'bg-[#040502]',
    glow1: 'bg-emerald-900/10',
    glow2: 'bg-amber-900/10',
    accent: 'text-emerald-400',
    tabActive: 'bg-emerald-600 text-white',
    cardBorder: 'hover:border-emerald-500/30',
    heroTitle: 'The Story Vault',
    heroDesc: 'Archived chronicles and deep-sleep narratives. Cinematic focus sessions.',
    font: 'font-fantasy'
  },
  custom: {
    bg: 'bg-[#050505]',
    glow1: 'bg-cyan-900/10',
    glow2: 'bg-slate-900/10',
    accent: 'text-cyan-400',
    tabActive: 'bg-cyan-600 text-white',
    cardBorder: 'hover:border-cyan-500/30',
    heroTitle: 'Creative Studio',
    heroDesc: 'Architect your own productions. Multi-voice mapping and script direction.',
    font: 'font-scifi'
  }
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);
  const [activeTab, setActiveTab] = useState<'adventures' | 'files' | 'custom'>('adventures');
  const [sessionOrigin, setSessionOrigin] = useState<'adventures' | 'files' | 'custom' | null>(null);
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
      const randomTopics: Record<Genre, string[]> = {
        [Genre.FANTASY]: ["A lost dragon egg", "The whispering woods", "A thief stealing a god's crown"],
        [Genre.SCIFI]: ["First contact on a frozen moon", "A glitch in the simulation", "The last oxygen tank"],
        [Genre.MYSTERY]: ["The empty train car", "The painting that changes at night", "A message from 50 years ago"],
        [Genre.HORROR]: ["The sound behind the walls", "A mirror that reflects a different room", "The never-ending fog"]
      };
      const genreTopics = randomTopics[config.genre];
      finalTopic = genreTopics[Math.floor(Math.random() * genreTopics.length)];
    }
    setSetupConfig({ ...config, topic: finalTopic });
    setViewMode(ViewMode.ADVENTURE);
  };

  const resumeSession = () => {
    if (savedSession) {
      setSetupConfig(savedSession.config);
      setInitialHistory(savedSession.transcriptions);
      setSessionOrigin(savedSession.config.durationMinutes ? 'files' : 'adventures');
      setViewMode(ViewMode.ADVENTURE);
      setSavedSession(null);
    }
  };

  const discardSavedSession = () => {
    localStorage.removeItem('storyscape_saved_session');
    setSavedSession(null);
  };

  const renderHome = () => (
    <div className={`min-h-screen ${theme.bg} text-white transition-colors duration-1000 overflow-x-hidden relative ${theme.font}`}>
      {/* Immersive Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-5%] w-[60%] h-[60%] ${theme.glow1} blur-[180px] rounded-full animate-float transition-colors duration-1000`}></div>
        <div className={`absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] ${theme.glow2} blur-[180px] rounded-full animate-float transition-colors duration-1000`} style={{animationDelay: '-3s'}}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 md:py-16 flex flex-col items-center">
        
        {/* Top bar with audio status */}
        <div className="w-full flex justify-between items-center mb-16 px-4">
          <div className="flex items-center gap-3 glass px-4 py-2 rounded-full border-white/5">
             <div className={`w-2 h-2 rounded-full ${audioState === 'running' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></div>
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
               Signal: {audioState === 'running' ? 'Active' : 'Muted'}
             </span>
             <button onClick={handleFixAudio} className="ml-2 hover:scale-110 transition-transform">
               <i className="fas fa-bolt text-[10px] text-yellow-500"></i>
             </button>
          </div>

          <button 
            onClick={() => setViewMode(ViewMode.FEEDBACK)}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
          >
            Send Feedback <i className="fas fa-arrow-right ml-1"></i>
          </button>
        </div>

        {/* Hero Section */}
        <header className="w-full mb-12 flex flex-col items-center text-center">
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-4 text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30 uppercase leading-none">
            StoryScape
          </h1>
          <div className={`h-1 w-24 mb-8 bg-gradient-to-r from-transparent via-white/20 to-transparent`}></div>
          
          <div className="flex flex-col items-center gap-2 mb-12">
            <h2 className={`text-xl md:text-2xl font-bold uppercase tracking-widest ${theme.accent} transition-colors duration-1000`}>
              {theme.heroTitle}
            </h2>
            <p className="max-w-lg text-sm text-white/40 font-medium leading-relaxed opacity-80 uppercase tracking-tight">
              {theme.heroDesc}
            </p>
          </div>

          {/* Segmented Tab Control */}
          <div className="glass p-1.5 rounded-full flex gap-1 mb-16 border-white/5 adventure-card-shadow animate-in fade-in zoom-in-95 duration-700">
            <ModeTab 
              active={activeTab === 'adventures'} 
              onClick={() => setActiveTab('adventures')}
              label="Adventures"
              icon="fa-wand-sparkles"
              activeClass={theme.tabActive}
            />
            <ModeTab 
              active={activeTab === 'files'} 
              onClick={() => setActiveTab('files')}
              label="Chronicles"
              icon="fa-scroll"
              activeClass={theme.tabActive}
            />
            <ModeTab 
              active={activeTab === 'custom'} 
              onClick={() => setActiveTab('custom')}
              label="Studio"
              icon="fa-clapperboard"
              activeClass={theme.tabActive}
            />
          </div>
        </header>

        {/* Saved Session Notification */}
        {savedSession && (
          <div className="w-full max-w-2xl mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className={`glass p-8 rounded-[2.5rem] border-white/10 bg-white/[0.02] relative overflow-hidden group flex flex-col sm:flex-row items-center gap-6`}>
              <div className={`w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0 ${theme.accent}`}>
                <i className="fas fa-history"></i>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Stored Memory Fragment</h3>
                <p className="text-sm font-bold uppercase tracking-widest">
                  {savedSession.config.genre} • {savedSession.config.topic}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={resumeSession} className="px-6 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Restore</button>
                <button onClick={discardSavedSession} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Display */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {activeTab === 'adventures' ? (
            <>
              <GenreTile 
                genre={Genre.FANTASY} 
                icon="fa-dragon" 
                desc="Magic realms, dragons, and legendary quests."
                accent="amber"
                theme={theme}
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreTile 
                genre={Genre.SCIFI} 
                icon="fa-user-astronaut" 
                desc="Quantum futures and void exploration."
                accent="cyan"
                theme={theme}
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreTile 
                genre={Genre.MYSTERY} 
                icon="fa-magnifying-glass" 
                desc="Noir cities and cryptic puzzles."
                accent="indigo"
                theme={theme}
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreTile 
                genre={Genre.HORROR} 
                icon="fa-ghost" 
                desc="Eldritch terrors and dark descents."
                accent="red"
                theme={theme}
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : activeTab === 'files' ? (
            <>
              <GenreTile 
                genre={Genre.FANTASY} 
                icon="fa-book-atlas" 
                desc="Long-form mythical histories."
                accent="emerald"
                theme={theme}
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreTile 
                genre={Genre.SCIFI} 
                icon="fa-microchip" 
                desc="Extended technical space logs."
                accent="blue"
                theme={theme}
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreTile 
                genre={Genre.MYSTERY} 
                icon="fa-file-signature" 
                desc="Complete archival investigations."
                accent="slate"
                theme={theme}
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreTile 
                genre={Genre.HORROR} 
                icon="fa-book-dead" 
                desc="Occult auditory journals."
                accent="orange"
                theme={theme}
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-4xl">
                 <GenreTile 
                    genre={Genre.FANTASY} 
                    icon="fa-feather-pointed" 
                    desc="Creative control over mythic narratives."
                    accent="violet"
                    theme={theme}
                    onStart={() => setViewMode(ViewMode.SETUP)}
                  />
                  <GenreTile 
                    genre={Genre.SCIFI} 
                    icon="fa-atom" 
                    desc="Architect complex sci-fi scenarios."
                    accent="sky"
                    theme={theme}
                    onStart={() => setViewMode(ViewMode.SETUP)}
                  />
              </div>
            </div>
          )}
        </div>
      </div>
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
        return (
          <StoryFilesView 
            config={setupConfig} 
            initialHistory={initialHistory}
            onExit={() => {
              setViewMode(ViewMode.HOME);
              setSetupConfig(null);
              setSessionOrigin(null);
              setInitialHistory([]);
            }} 
          />
        );
      }
      return (
        <AdventureView 
          config={setupConfig} 
          initialHistory={initialHistory}
          onExit={() => {
            setViewMode(ViewMode.HOME);
            setSetupConfig(null);
            setSessionOrigin(null);
            setInitialHistory([]);
          }} 
        />
      );
    }
    if (viewMode === ViewMode.SETUP) return renderSetup();
    if (viewMode === ViewMode.FEEDBACK) return <FeedbackView onBack={() => setViewMode(ViewMode.HOME)} />;
    return renderHome();
  };

  return <div className="min-h-screen bg-[#020202]">{renderContent()}</div>;
};

interface ModeTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  activeClass: string;
}

const ModeTab: React.FC<ModeTabProps> = ({ active, onClick, label, icon, activeClass }) => (
  <button 
    onClick={onClick}
    className={`px-8 py-3.5 rounded-full flex items-center gap-3 transition-all duration-500 ${
      active 
        ? `${activeClass} shadow-2xl scale-[1.05] z-10` 
        : 'text-white/20 hover:text-white/40 hover:bg-white/5'
    }`}
  >
    <i className={`fas ${icon} text-xs`}></i>
    <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden sm:block">
      {label}
    </span>
  </button>
);

interface GenreTileProps {
  genre: Genre;
  icon: string;
  desc: string;
  accent: string;
  theme: any;
  onStart: () => void;
}

const GenreTile: React.FC<GenreTileProps> = ({ genre, icon, desc, accent, theme, onStart }) => {
  const accentMap: Record<string, string> = {
    amber: 'group-hover:text-amber-400 group-hover:bg-amber-400/10 border-amber-500/0 hover:border-amber-500/30',
    cyan: 'group-hover:text-cyan-400 group-hover:bg-cyan-400/10 border-cyan-500/0 hover:border-cyan-500/30',
    indigo: 'group-hover:text-indigo-400 group-hover:bg-indigo-400/10 border-indigo-500/0 hover:border-indigo-500/30',
    red: 'group-hover:text-red-400 group-hover:bg-red-400/10 border-red-500/0 hover:border-red-500/30',
    emerald: 'group-hover:text-emerald-400 group-hover:bg-emerald-400/10 border-emerald-500/0 hover:border-emerald-500/30',
    blue: 'group-hover:text-blue-400 group-hover:bg-blue-400/10 border-blue-500/0 hover:border-blue-500/30',
    slate: 'group-hover:text-slate-400 group-hover:bg-slate-400/10 border-slate-500/0 hover:border-slate-500/30',
    orange: 'group-hover:text-orange-400 group-hover:bg-orange-400/10 border-orange-500/0 hover:border-orange-500/30',
    violet: 'group-hover:text-violet-400 group-hover:bg-violet-400/10 border-violet-500/0 hover:border-violet-500/30',
    sky: 'group-hover:text-sky-400 group-hover:bg-sky-400/10 border-sky-500/0 hover:border-sky-500/30',
  };

  return (
    <button 
      onClick={onStart} 
      className={`group p-8 glass rounded-[3rem] transition-all duration-700 flex flex-col items-center text-center relative hover:scale-[1.03] active:scale-95 border ${accentMap[accent]} adventure-card-shadow bg-white/[0.01]`}
    >
      <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center mb-8 transition-all duration-700 shadow-inner group-hover:scale-110">
        <i className={`fas ${icon} text-2xl opacity-40 group-hover:opacity-100`}></i>
      </div>
      
      <h3 className="text-2xl font-black mb-3 tracking-tighter uppercase leading-none">{genre}</h3>
      <p className="text-[10px] text-white/20 leading-relaxed font-bold uppercase tracking-widest line-clamp-2">{desc}</p>
      
      <div className="mt-8 w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] group-hover:bg-white group-hover:text-black transition-all">
        Initiate Link
      </div>
    </button>
  );
};

interface SetupViewProps {
  genre: Genre;
  origin: 'adventures' | 'files' | 'custom';
  onBack: () => void;
  onConfirm: (config: AdventureConfig) => void;
}

const SetupView: React.FC<SetupViewProps> = ({ genre, origin, onBack, onConfirm }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState<GeminiVoice>('Zephyr');
  const [mode, setMode] = useState<NarratorMode>(NarratorMode.SINGLE);
  const [duration, setDuration] = useState(15);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020202] relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/5 blur-[150px] rounded-full"></div>
      
      <div className="max-w-3xl w-full glass p-8 md:p-14 rounded-[4rem] border-white/5 space-y-12 z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-3">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">{genre} Matrix</span>
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tighter">
            {origin === 'files' ? 'Seal Protocol' : 'Forge Reality'}
          </h2>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-[0.3em]">Temporal Seed (Optional)</label>
            <input 
              type="text" 
              value={topic} 
              onChange={e => setTopic(e.target.value)}
              placeholder="Leave empty for the Oracle's choice..."
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-6 outline-none focus:border-white/30 transition-all text-lg font-light placeholder:opacity-10"
            />
          </div>

          {origin === 'files' && (
            <div className="space-y-6 glass p-8 rounded-[3rem] border-white/5 bg-white/[0.01]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] uppercase font-black opacity-30 ml-2 tracking-widest">Chronicle Span</label>
                <span className="text-xl font-black text-indigo-400">{duration} Minutes</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="60" 
                step="5"
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[9px] opacity-20 uppercase tracking-[0.2em] text-center">Optimized for long-form neural synthesis</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Vocal Dialect</label>
              <div className="relative">
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] px-8 py-5 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  {LANGUAGES.map(l => <option key={l} value={l} className="bg-black">{l}</option>)}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Narrative Mode</label>
              <div className="relative">
                <select 
                  value={mode} 
                  onChange={e => setMode(e.target.value as NarratorMode)}
                  className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] px-8 py-5 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  <option value={NarratorMode.SINGLE} className="bg-black">Solo Guide</option>
                  <option value={NarratorMode.MULTI} className="bg-black">Full Ensemble</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Select Neural Core</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col items-center gap-1 p-5 rounded-[1.5rem] border transition-all duration-300 ${voice === v.id ? 'bg-white text-black border-white shadow-2xl scale-105' : 'bg-white/5 border-white/10 opacity-40 hover:opacity-60'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button onClick={onBack} className="flex-1 py-6 rounded-[1.5rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-95">Return</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, durationMinutes: origin === 'files' ? duration : undefined })} 
            className="flex-[2] py-6 rounded-[1.5rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] transition-all shadow-2xl active:scale-95"
          >
            {origin === 'files' ? 'Seal Archive' : `Launch ${genre}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
