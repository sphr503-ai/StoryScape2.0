
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

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);
  const [activeTab, setActiveTab] = useState<'adventures' | 'files' | 'custom'>('adventures');
  const [sessionOrigin, setSessionOrigin] = useState<'adventures' | 'files' | 'custom' | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [setupConfig, setSetupConfig] = useState<AdventureConfig | null>(null);
  const [audioState, setAudioState] = useState<'suspended' | 'running' | 'closed'>('suspended');
  const [initialHistory, setInitialHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
  const [savedSession, setSavedSession] = useState<{config: AdventureConfig, transcriptions: any[]} | null>(null);

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
    <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden relative">
      {/* Immersive Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-900/10 blur-[150px] rounded-full animate-float" style={{animationDelay: '-3s'}}></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-900/5 blur-[120px] rounded-full animate-float" style={{animationDelay: '-6s'}}></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-24 flex flex-col items-center">
        
        {/* Header Section */}
        <header className="w-full mb-16 flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className={`w-2 h-2 rounded-full ${audioState === 'running' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              {audioState === 'running' ? 'Neural Signal Clear' : 'Neural Signal Suspended'}
            </span>
            <button onClick={handleFixAudio} className="ml-4 p-1.5 glass rounded-full hover:bg-white/10 transition-all">
              <i className="fas fa-bolt text-[10px] text-yellow-500"></i>
            </button>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase font-scifi">
            StoryScape
          </h1>
          <p className="max-w-xl text-lg text-white/40 font-light leading-relaxed mb-12">
            The multiverse of infinite interactive audio adventures. Powered by advanced neural narration and real-time generation.
          </p>

          {/* New Modern Mode Selector */}
          <div className="glass p-1.5 rounded-full flex gap-1 mb-16 border-white/5 adventure-card-shadow animate-in fade-in zoom-in-95 duration-700">
            <ModeTab 
              active={activeTab === 'adventures'} 
              onClick={() => setActiveTab('adventures')}
              label="Live Adventures"
              icon="fa-wand-sparkles"
            />
            <ModeTab 
              active={activeTab === 'files'} 
              onClick={() => setActiveTab('files')}
              label="Story Vault"
              icon="fa-box-archive"
            />
            <ModeTab 
              active={activeTab === 'custom'} 
              onClick={() => setActiveTab('custom')}
              label="Creative Studio"
              icon="fa-pen-nib"
            />
          </div>
        </header>

        {/* Saved Session Alert */}
        {savedSession && (
          <div className="w-full max-w-2xl mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass p-8 rounded-[2.5rem] border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden group flex flex-col sm:flex-row items-center gap-6">
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <i className="fas fa-clock-rotate-left text-indigo-400"></i>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-sm font-black uppercase tracking-widest mb-1">Unfinished Narrative Found</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest">
                  {savedSession.config.genre} • {savedSession.config.topic}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={resumeSession} className="px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Resume</button>
                <button onClick={discardSavedSession} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* Genre Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {activeTab === 'adventures' ? (
            <>
              <GenreTile 
                genre={Genre.FANTASY} 
                icon="fa-dragon" 
                desc="Magic realms, ancient dragons, and legendary quests."
                accent="amber"
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreTile 
                genre={Genre.SCIFI} 
                icon="fa-user-astronaut" 
                desc="Quantum futures, AI singularities, and void exploration."
                accent="cyan"
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreTile 
                genre={Genre.MYSTERY} 
                icon="fa-magnifying-glass" 
                desc="Noir cities, cryptic puzzles, and shifting shadows."
                accent="indigo"
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreTile 
                genre={Genre.HORROR} 
                icon="fa-ghost" 
                desc="Eldritch terrors and psychological descents into dark."
                accent="red"
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : activeTab === 'files' ? (
            <>
              <GenreTile 
                genre={Genre.FANTASY} 
                icon="fa-scroll" 
                desc="Long-form mythical histories for deep immersion."
                accent="emerald"
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreTile 
                genre={Genre.SCIFI} 
                icon="fa-microchip" 
                desc="Extended technical logs from the fringe of space."
                accent="blue"
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreTile 
                genre={Genre.MYSTERY} 
                icon="fa-folder-open" 
                desc="Complete archival investigations and cold cases."
                accent="slate"
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreTile 
                genre={Genre.HORROR} 
                icon="fa-book-dead" 
                desc="Extended auditory descents into the occult."
                accent="orange"
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-4xl">
                 <GenreTile 
                    genre={Genre.FANTASY} 
                    icon="fa-feather-pointed" 
                    desc="Full creative control over fantasy world-building."
                    accent="violet"
                    onStart={() => setViewMode(ViewMode.SETUP)}
                  />
                  <GenreTile 
                    genre={Genre.SCIFI} 
                    icon="fa-atom" 
                    desc="Architect detailed sci-fi scripts with custom voices."
                    accent="sky"
                    onStart={() => setViewMode(ViewMode.SETUP)}
                  />
              </div>
            </div>
          )}
        </div>

        {/* Floating Footer Navigation */}
        <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <button 
            onClick={() => setViewMode(ViewMode.FEEDBACK)}
            className="flex items-center gap-3 glass px-8 py-4 rounded-full border-white/10 hover:bg-white hover:text-black hover:scale-105 active:scale-95 transition-all shadow-2xl group"
          >
            <i className="fas fa-comment-dots text-sm opacity-50 group-hover:opacity-100"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Feedback</span>
          </button>
        </footer>
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
}

const ModeTab: React.FC<ModeTabProps> = ({ active, onClick, label, icon }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-4 rounded-full flex items-center gap-3 transition-all duration-300 ${
      active 
        ? 'bg-white text-black shadow-xl scale-[1.05] z-10' 
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'
    }`}
  >
    <i className={`fas ${icon} text-sm`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
      {label}
    </span>
  </button>
);

interface GenreTileProps {
  genre: Genre;
  icon: string;
  desc: string;
  accent: string;
  onStart: () => void;
}

const GenreTile: React.FC<GenreTileProps> = ({ genre, icon, desc, accent, onStart }) => {
  const accentMap: Record<string, string> = {
    amber: 'group-hover:text-amber-400 group-hover:bg-amber-400/10 border-amber-500/0 hover:border-amber-500/20',
    cyan: 'group-hover:text-cyan-400 group-hover:bg-cyan-400/10 border-cyan-500/0 hover:border-cyan-500/20',
    indigo: 'group-hover:text-indigo-400 group-hover:bg-indigo-400/10 border-indigo-500/0 hover:border-indigo-500/20',
    red: 'group-hover:text-red-400 group-hover:bg-red-400/10 border-red-500/0 hover:border-red-500/20',
    emerald: 'group-hover:text-emerald-400 group-hover:bg-emerald-400/10 border-emerald-500/0 hover:border-emerald-500/20',
    blue: 'group-hover:text-blue-400 group-hover:bg-blue-400/10 border-blue-500/0 hover:border-blue-500/20',
    slate: 'group-hover:text-slate-400 group-hover:bg-slate-400/10 border-slate-500/0 hover:border-slate-500/20',
    orange: 'group-hover:text-orange-400 group-hover:bg-orange-400/10 border-orange-500/0 hover:border-orange-500/20',
    violet: 'group-hover:text-violet-400 group-hover:bg-violet-400/10 border-violet-500/0 hover:border-violet-500/20',
    sky: 'group-hover:text-sky-400 group-hover:bg-sky-400/10 border-sky-500/0 hover:border-sky-500/20',
  };

  return (
    <button 
      onClick={onStart} 
      className={`group p-10 glass rounded-[3rem] transition-all duration-500 flex flex-col items-center text-center relative hover:scale-[1.02] active:scale-95 border ${accentMap[accent]} adventure-card-shadow`}
    >
      <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center mb-8 transition-all duration-500 shadow-inner group-hover:scale-110">
        <i className={`fas ${icon} text-2xl opacity-60 group-hover:opacity-100`}></i>
      </div>
      
      <h3 className="text-2xl font-black mb-3 tracking-tighter uppercase">{genre}</h3>
      <p className="text-[11px] text-white/30 leading-relaxed font-medium uppercase tracking-widest">{desc}</p>
      
      <div className="mt-10 w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] group-hover:bg-white group-hover:text-black transition-all">
        Launch Portal
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
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">{genre} Config</span>
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tighter">
            {origin === 'files' ? 'Archive Protocol' : 'Forge Destiny'}
          </h2>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-[0.3em]">Chronicle Seed (Optional)</label>
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
                <label className="text-[10px] uppercase font-black opacity-30 ml-2 tracking-widest">Chronicle Duration</label>
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
              <p className="text-[9px] opacity-20 uppercase tracking-[0.2em] text-center">Engine optimized for long-form synthesis</p>
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
              <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Vocal Arrangement</label>
              <div className="relative">
                <select 
                  value={mode} 
                  onChange={e => setMode(e.target.value as NarratorMode)}
                  className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] px-8 py-5 outline-none text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-white/10 transition-all"
                >
                  <option value={NarratorMode.SINGLE} className="bg-black">Solo Narrator</option>
                  <option value={NarratorMode.MULTI} className="bg-black">Cast Ensemble</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Select Neural Voice Core</label>
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
          <button onClick={onBack} className="flex-1 py-6 rounded-[1.5rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-95">Cancel</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, durationMinutes: origin === 'files' ? duration : undefined })} 
            className="flex-[2] py-6 rounded-[1.5rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] transition-all shadow-2xl active:scale-95"
          >
            {origin === 'files' ? 'Seal Protocol' : `Enter ${genre} Realm`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
