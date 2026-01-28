
import React, { useState, useEffect } from 'react';
import { Genre, ViewMode, AdventureConfig, NarratorMode, GeminiVoice } from './types';
import AdventureView from './components/AdventureView';
import StoryFilesView from './components/StoryFilesView';
import VoiceGuruView from './components/VoiceGuruView';

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

    // Check for saved session
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
      alert("Audio engine primed.");
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
      // We assume resumed sessions go to the matching origin
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
    <div className="min-h-screen flex flex-col items-center p-6 bg-[#0a0a0a] overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>

      <div className="max-w-6xl w-full text-center z-10 pt-12 md:pt-20">
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="flex items-center gap-4 px-6 py-2.5 glass rounded-full shadow-2xl border-white/5">
            <div className={`flex items-center gap-2 pr-4 border-r border-white/10`}>
              <div className={`w-2.5 h-2.5 rounded-full ${audioState === 'running' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse shadow-[0_0_10_px_#ef4444]'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${audioState === 'running' ? 'text-green-400' : 'text-red-400'}`}>
                {audioState === 'running' ? 'Audio Signal Active' : 'Sound Engine Blocked'}
              </span>
            </div>
            <button onClick={handleFixAudio} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2">
              <i className="fas fa-bolt text-xs text-yellow-500"></i> Fix Audio
            </button>
          </div>
        </div>

        {savedSession && (
          <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
             <div className="glass p-8 rounded-[2.5rem] border-blue-500/20 max-w-lg mx-auto bg-blue-500/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                  <i className="fas fa-history text-4xl"></i>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">Unfinished Chronicle Found</h3>
                <p className="text-xs text-white/50 mb-6 leading-relaxed">
                   We found a saved {savedSession.config.genre} session about "{savedSession.config.topic}". Would you like to resume?
                </p>
                <div className="flex gap-3">
                   <button onClick={resumeSession} className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-transform">Resume Saga</button>
                   <button onClick={discardSavedSession} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10">Discard</button>
                </div>
             </div>
          </div>
        )}

        <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">
          STORYSCAPE
        </h1>
        <p className="text-xl md:text-2xl text-white/50 mb-12 max-w-2xl mx-auto font-light">
          {activeTab === 'adventures' ? 'Live Interactive Saga Engine.' : activeTab === 'files' ? 'Archived Chronology & Deep Narratives.' : 'Direct Your Own Cinematic Productions.'}
        </p>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-16">
          <div className="glass p-1.5 rounded-full flex gap-1 border-white/5 shadow-2xl">
            <button 
              onClick={() => setActiveTab('adventures')}
              className={`px-8 md:px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'adventures' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Adventures
            </button>
            <button 
              onClick={() => setActiveTab('files')}
              className={`px-8 md:px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'files' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Story Files
            </button>
            <button 
              onClick={() => setActiveTab('custom')}
              className={`px-8 md:px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'custom' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Write Your Own
            </button>
          </div>
        </div>

        {/* Dynamic Genre Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'adventures' ? (
            <>
              <GenreCard 
                genre={Genre.FANTASY} 
                icon="fa-dragon" 
                desc="Magic and ancient quests."
                color="hover:border-amber-500/50"
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreCard 
                genre={Genre.SCIFI} 
                icon="fa-user-astronaut" 
                desc="Futuristic dystopias."
                color="hover:border-cyan-500/50"
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreCard 
                genre={Genre.MYSTERY} 
                icon="fa-magnifying-glass" 
                desc="Hidden truths."
                color="hover:border-purple-500/50"
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreCard 
                genre={Genre.HORROR} 
                icon="fa-ghost" 
                desc="Psychological thrills."
                color="hover:border-red-500/50"
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : activeTab === 'files' ? (
            <>
              <GenreCard 
                genre={Genre.FANTASY} 
                icon="fa-scroll" 
                desc="Recorded scrolls of high magic."
                color="hover:border-emerald-500/50"
                onStart={() => handleStartSetup(Genre.FANTASY)}
              />
              <GenreCard 
                genre={Genre.SCIFI} 
                icon="fa-microchip" 
                desc="Encrypted logs from the far future."
                color="hover:border-indigo-500/50"
                onStart={() => handleStartSetup(Genre.SCIFI)}
              />
              <GenreCard 
                genre={Genre.MYSTERY} 
                icon="fa-folder-open" 
                desc="Classified case files and enigmas."
                color="hover:border-slate-500/50"
                onStart={() => handleStartSetup(Genre.MYSTERY)}
              />
              <GenreCard 
                genre={Genre.HORROR} 
                icon="fa-book-dead" 
                desc="Banned journals of the occult."
                color="hover:border-orange-500/50"
                onStart={() => handleStartSetup(Genre.HORROR)}
              />
            </>
          ) : (
            <>
              <GenreCard 
                genre={Genre.FANTASY} 
                icon="fa-feather-pointed" 
                desc="Direct custom fantasy scripts."
                color="hover:border-indigo-500/50"
                onStart={() => setViewMode(ViewMode.SETUP)}
              />
              <GenreCard 
                genre={Genre.HORROR} 
                icon="fa-skull-crossbones" 
                desc="Forge custom terrifying tales."
                color="hover:border-red-500/50"
                onStart={() => setViewMode(ViewMode.SETUP)}
              />
              <GenreCard 
                genre={Genre.SCIFI} 
                icon="fa-atom" 
                desc="Architect custom future logs."
                color="hover:border-blue-500/50"
                onStart={() => setViewMode(ViewMode.SETUP)}
              />
              <GenreCard 
                genre={Genre.MYSTERY} 
                icon="fa-mask-ventilator" 
                desc="Craft custom noir enigmas."
                color="hover:border-slate-500/50"
                onStart={() => setViewMode(ViewMode.SETUP)}
              />
            </>
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
    return renderHome();
  };

  return <div className="min-h-screen bg-[#0a0a0a]">{renderContent()}</div>;
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0a] relative">
      <div className="max-w-3xl w-full glass p-8 md:p-12 rounded-[3.5rem] border-white/10 space-y-8 z-10">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black uppercase tracking-tighter">
            {origin === 'files' ? 'Prepare Archive Log' : 'Forge Your Destiny'}
          </h2>
          <p className="text-white/40 uppercase tracking-widest text-xs">{genre} Saga</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black opacity-40 ml-2 tracking-widest">Adventure Topic (Optional)</label>
            <input 
              type="text" 
              value={topic} 
              onChange={e => setTopic(e.target.value)}
              placeholder="Leave empty for a surprise..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all text-sm"
            />
          </div>

          {origin === 'files' && (
            <div className="space-y-4 glass p-6 rounded-3xl border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] uppercase font-black opacity-40 ml-2 tracking-widest">Story Duration (Minutes)</label>
                <span className="text-sm font-black text-white">{duration}m</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="60" 
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <p className="text-[9px] opacity-30 uppercase tracking-widest text-center mt-2">Maximum 60 Minutes • Deep Sleep Optimization</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black opacity-40 ml-2 tracking-widest">Language</label>
              <select 
                value={language} 
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none text-sm appearance-none"
              >
                {LANGUAGES.map(l => <option key={l} value={l} className="bg-black">{l}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black opacity-40 ml-2 tracking-widest">Narrator Performance</label>
              <select 
                value={mode} 
                onChange={e => setMode(e.target.value as NarratorMode)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none text-sm appearance-none"
              >
                <option value={NarratorMode.SINGLE} className="bg-black">Single Narrator</option>
                <option value={NarratorMode.MULTI} className="bg-black">Multiple Character Performance</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black opacity-40 ml-2 tracking-widest">Base Voice Texture</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${voice === v.id ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 border-white/10 opacity-40'}`}
                >
                  <span className="text-[10px] font-bold">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={onBack} className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Back</button>
          <button 
            onClick={() => onConfirm({ genre, topic, language, voice, mode, durationMinutes: origin === 'files' ? duration : undefined })} 
            className="flex-[2] py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-2xl"
          >
            {origin === 'files' ? 'Seal Archive Log' : `Enter ${genre} Realm`}
          </button>
        </div>
      </div>
    </div>
  );
};

interface GenreCardProps {
  genre: Genre;
  icon: string;
  desc: string;
  color: string;
  onStart: () => void;
}

const GenreCard: React.FC<GenreCardProps> = ({ genre, icon, desc, color, onStart }) => (
  <button onClick={onStart} className={`group p-8 glass rounded-[2.5rem] border border-white/5 transition-all duration-500 flex flex-col items-center text-center relative ${color} hover:scale-105 active:scale-95`}>
    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
      <i className={`fas ${icon} text-3xl opacity-80 group-hover:opacity-100 transition-opacity`}></i>
    </div>
    <h3 className="text-2xl font-bold mb-3 tracking-tight">{genre}</h3>
    <p className="text-xs opacity-40 leading-relaxed mb-6">{desc}</p>
    <div className="mt-auto w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest group-hover:bg-white group-hover:text-black transition-all">
      Select Realm
    </div>
  </button>
);

export default App;
