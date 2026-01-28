
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full animate-float" style={{animationDelay: '-2s'}}></div>
      </div>

      {/* Navigation Sidebar */}
      <nav className="w-full md:w-80 glass border-r border-white/5 z-20 flex flex-col p-8 md:h-screen shrink-0">
        <div className="mb-12">
          <h1 className="text-3xl font-black tracking-tighter text-glow mb-2">STORYSCAPE</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${audioState === 'running' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
              {audioState === 'running' ? 'Engine Ready' : 'Engine Idle'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-auto">
          <NavButton 
            active={activeTab === 'adventures'} 
            onClick={() => setActiveTab('adventures')}
            icon="fa-wand-sparkles"
            label="Live Saga"
            desc="Interactive Adventures"
          />
          <NavButton 
            active={activeTab === 'files'} 
            onClick={() => setActiveTab('files')}
            icon="fa-box-archive"
            label="Archives"
            desc="Deep Sleep Narratives"
          />
          <NavButton 
            active={activeTab === 'custom'} 
            onClick={() => setActiveTab('custom')}
            icon="fa-pen-nib"
            label="Studio"
            desc="Direct Your Script"
          />
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <button 
            onClick={() => setViewMode(ViewMode.FEEDBACK)}
            className="w-full py-4 rounded-2xl glass hover:bg-white/5 transition-all text-left px-6 flex items-center gap-4 group"
          >
            <i className="fas fa-comment-dots text-white/40 group-hover:text-white transition-colors"></i>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest">Feedback</span>
              <span className="block text-[8px] text-white/20 uppercase">Send Transmission</span>
            </div>
          </button>
          
          <button 
            onClick={handleFixAudio}
            className="w-full py-4 rounded-2xl glass hover:bg-white/5 transition-all text-left px-6 flex items-center gap-4 group"
          >
            <i className="fas fa-bolt text-yellow-500/40 group-hover:text-yellow-500 transition-colors"></i>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest">Prime Engine</span>
              <span className="block text-[8px] text-white/20 uppercase">Reset Audio Signal</span>
            </div>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 z-10 p-6 md:p-12 overflow-y-auto custom-scrollbar h-screen">
        <div className="max-w-6xl mx-auto">
          {savedSession && (
            <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="glass p-8 rounded-[2.5rem] border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden group flex flex-col md:flex-row items-center gap-8">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-history text-2xl text-indigo-400"></i>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">Unfinished Chronicle</h3>
                    <p className="text-xs text-white/40 mb-0 leading-relaxed uppercase tracking-widest">
                       Resuming: {savedSession.config.genre} - {savedSession.config.topic}
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                     <button onClick={resumeSession} className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all">Resume</button>
                     <button onClick={discardSavedSession} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">Dismiss</button>
                  </div>
               </div>
            </div>
          )}

          <div className="mb-16">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 opacity-90">
              {activeTab === 'adventures' ? 'Start a New Journey' : 
               activeTab === 'files' ? 'Explore the Vault' : 
               'Creative Direction'}
            </h2>
            <p className="text-white/40 uppercase tracking-[0.3em] text-[11px] font-bold">
              {activeTab === 'adventures' ? 'PICK A REALM TO BEGIN YOUR LIVE NARRATIVE EXPERIENCE' : 
               activeTab === 'files' ? 'LONG-FORM CINEMATIC SESSIONS DESIGNED FOR DEEP FOCUS' : 
               'FORGE CUSTOM PRODUCTIONS WITH MULTIPLE VOICE MAPPINGS'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'adventures' ? (
              <>
                <GenreCard 
                  genre={Genre.FANTASY} 
                  icon="fa-dragon" 
                  desc="Ancient magic, lost kingdoms, and mythical beasts."
                  color="hover:border-amber-500/40"
                  accent="amber"
                  onStart={() => handleStartSetup(Genre.FANTASY)}
                />
                <GenreCard 
                  genre={Genre.SCIFI} 
                  icon="fa-user-astronaut" 
                  desc="Distant moons, AI glitches, and deep space mysteries."
                  color="hover:border-cyan-500/40"
                  accent="cyan"
                  onStart={() => handleStartSetup(Genre.SCIFI)}
                />
                <GenreCard 
                  genre={Genre.MYSTERY} 
                  icon="fa-magnifying-glass" 
                  desc="Noir detectives, hidden truths, and shifting shadows."
                  color="hover:border-purple-500/40"
                  accent="purple"
                  onStart={() => handleStartSetup(Genre.MYSTERY)}
                />
                <GenreCard 
                  genre={Genre.HORROR} 
                  icon="fa-ghost" 
                  desc="Psychological terror and things that lurk in the dark."
                  color="hover:border-red-500/40"
                  accent="red"
                  onStart={() => handleStartSetup(Genre.HORROR)}
                />
              </>
            ) : activeTab === 'files' ? (
              <>
                <GenreCard 
                  genre={Genre.FANTASY} 
                  icon="fa-scroll" 
                  desc="Recorded high magic archives. Ambient and soothing."
                  color="hover:border-emerald-500/40"
                  accent="emerald"
                  onStart={() => handleStartSetup(Genre.FANTASY)}
                />
                <GenreCard 
                  genre={Genre.SCIFI} 
                  icon="fa-microchip" 
                  desc="Encrypted futuristic logs. Atmospheric soundscapes."
                  color="hover:border-indigo-500/40"
                  accent="indigo"
                  onStart={() => handleStartSetup(Genre.SCIFI)}
                />
                <GenreCard 
                  genre={Genre.MYSTERY} 
                  icon="fa-folder-open" 
                  desc="Classified noir case files. Hypnotic investigation."
                  color="hover:border-slate-500/40"
                  accent="slate"
                  onStart={() => handleStartSetup(Genre.MYSTERY)}
                />
                <GenreCard 
                  genre={Genre.HORROR} 
                  icon="fa-book-dead" 
                  desc="Banned journals. Eerie and immersive narratives."
                  color="hover:border-orange-500/40"
                  accent="orange"
                  onStart={() => handleStartSetup(Genre.HORROR)}
                />
              </>
            ) : (
              <>
                <GenreCard 
                  genre={Genre.FANTASY} 
                  icon="fa-feather-pointed" 
                  desc="Director mode for custom fantasy world-building."
                  color="hover:border-indigo-500/40"
                  accent="indigo"
                  onStart={() => setViewMode(ViewMode.SETUP)}
                />
                <GenreCard 
                  genre={Genre.HORROR} 
                  icon="fa-skull-crossbones" 
                  desc="Forge custom terrifying tales with precise control."
                  color="hover:border-red-500/40"
                  accent="red"
                  onStart={() => setViewMode(ViewMode.SETUP)}
                />
                <GenreCard 
                  genre={Genre.SCIFI} 
                  icon="fa-atom" 
                  desc="Architect complex futuristic logs and scenarios."
                  color="hover:border-blue-500/40"
                  accent="blue"
                  onStart={() => setViewMode(ViewMode.SETUP)}
                />
                <GenreCard 
                  genre={Genre.MYSTERY} 
                  icon="fa-mask-ventilator" 
                  desc="Craft intricate noir enigmas and plot twists."
                  color="hover:border-slate-500/40"
                  accent="slate"
                  onStart={() => setViewMode(ViewMode.SETUP)}
                />
              </>
            )}
          </div>
        </div>
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

  return <div className="min-h-screen bg-[#050505]">{renderContent()}</div>;
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  desc: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, desc }) => (
  <button 
    onClick={onClick}
    className={`w-full p-6 rounded-[2rem] text-left transition-all duration-300 relative overflow-hidden group ${
      active 
        ? 'bg-white text-black shadow-2xl scale-[1.02]' 
        : 'glass text-white/40 hover:text-white hover:bg-white/5'
    }`}
  >
    {active && (
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <i className={`fas ${icon} text-4xl`}></i>
      </div>
    )}
    <div className="flex flex-col gap-1 z-10 relative">
      <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${active ? 'text-black/40' : 'text-white/20 group-hover:text-white/40'}`}>
        {label}
      </span>
      <span className="text-sm font-black tracking-tight uppercase">
        {desc}
      </span>
    </div>
  </button>
);

interface GenreCardProps {
  genre: Genre;
  icon: string;
  desc: string;
  color: string;
  accent: string;
  onStart: () => void;
}

const GenreCard: React.FC<GenreCardProps> = ({ genre, icon, desc, color, accent, onStart }) => {
  const accentClasses: Record<string, string> = {
    amber: 'group-hover:text-amber-400 group-hover:bg-amber-400/10',
    cyan: 'group-hover:text-cyan-400 group-hover:bg-cyan-400/10',
    purple: 'group-hover:text-purple-400 group-hover:bg-purple-400/10',
    red: 'group-hover:text-red-400 group-hover:bg-red-400/10',
    emerald: 'group-hover:text-emerald-400 group-hover:bg-emerald-400/10',
    indigo: 'group-hover:text-indigo-400 group-hover:bg-indigo-400/10',
    slate: 'group-hover:text-slate-400 group-hover:bg-slate-400/10',
    orange: 'group-hover:text-orange-400 group-hover:bg-orange-400/10',
    blue: 'group-hover:text-blue-400 group-hover:bg-blue-400/10',
  };

  return (
    <button 
      onClick={onStart} 
      className={`group p-10 glass rounded-[3.5rem] border border-white/5 transition-all duration-500 flex flex-col items-start text-left relative ${color} hover:scale-[1.03] active:scale-95 min-h-[320px]`}
    >
      <div className={`w-16 h-16 rounded-[1.75rem] bg-white/5 flex items-center justify-center mb-10 transition-all duration-500 shadow-inner ${accentClasses[accent] || ''}`}>
        <i className={`fas ${icon} text-2xl`}></i>
      </div>
      
      <div className="mt-auto">
        <h3 className="text-3xl font-black mb-3 tracking-tighter uppercase">{genre}</h3>
        <p className="text-xs text-white/30 leading-relaxed mb-0 font-medium line-clamp-2">{desc}</p>
      </div>
      
      <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 transition-transform">
        <i className="fas fa-arrow-right text-lg"></i>
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505] relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[150px] rounded-full"></div>
      
      <div className="max-w-3xl w-full glass p-8 md:p-14 rounded-[4.5rem] border-white/10 space-y-12 z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-3">
          <p className="text-indigo-400 uppercase tracking-[0.5em] text-[9px] font-black">{genre} Realm Configuration</p>
          <h2 className="text-5xl font-black uppercase tracking-tighter">
            {origin === 'files' ? 'Archive Protocol' : 'Forge Destiny'}
          </h2>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-[0.3em]">Adventure Topic (Optional)</label>
            <input 
              type="text" 
              value={topic} 
              onChange={e => setTopic(e.target.value)}
              placeholder="Leave empty for the Oracle's choice..."
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-6 outline-none focus:border-white/30 transition-all text-lg font-light placeholder:opacity-10"
            />
          </div>

          {origin === 'files' && (
            <div className="space-y-6 glass p-8 rounded-[3rem] border-white/5 bg-black/20">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] uppercase font-black opacity-30 ml-2 tracking-widest">Temporal Length</label>
                <span className="text-xl font-black text-indigo-400">{duration} Minutes</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="60" 
                step="5"
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <p className="text-[9px] opacity-20 uppercase tracking-[0.2em] text-center">Optimized for Deep Audio Immersions</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Dialect</label>
              <div className="relative">
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none text-sm appearance-none font-bold uppercase tracking-widest cursor-pointer hover:bg-white/10 transition-all"
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
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none text-sm appearance-none font-bold uppercase tracking-widest cursor-pointer hover:bg-white/10 transition-all"
                >
                  <option value={NarratorMode.SINGLE} className="bg-black">SOLO NARRATOR</option>
                  <option value={NarratorMode.MULTI} className="bg-black">CAST ENSEMBLE</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <label className="text-[10px] uppercase font-black opacity-30 ml-4 tracking-widest">Voice Texture Mapping</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col items-center gap-1 p-5 rounded-[2rem] border transition-all duration-300 ${voice === v.id ? 'bg-white text-black border-white shadow-2xl scale-105' : 'bg-white/5 border-white/10 opacity-40 hover:opacity-60'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button onClick={onBack} className="flex-1 py-6 rounded-[2rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-95">Cancel</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, durationMinutes: origin === 'files' ? duration : undefined })} 
            className="flex-[2] py-6 rounded-[2rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95"
          >
            {origin === 'files' ? 'Seal Archive' : `Enter ${genre} Realm`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
