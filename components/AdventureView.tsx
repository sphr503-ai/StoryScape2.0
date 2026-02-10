
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import Visualizer from './Visualizer';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface AdventureViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const AMBIENT_SOUNDS: Record<Genre, string> = {
  [Genre.FANTASY]: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-at-night-with-crickets-1224.mp3',
  [Genre.SCIFI]: 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-wind-vibe-1204.mp3',
  [Genre.MYSTERY]: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  [Genre.HORROR]: 'https://assets.mixkit.co/sfx/preview/mixkit-horror-atmosphere-drone-953.mp3',
  [Genre.THRILLER]: 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  [Genre.DOCUMENTARY]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.EDUCATION]: 'https://assets.mixkit.co/sfx/preview/mixkit-library-room-ambience-with-distant-chatter-2517.mp3',
};

const AdventureView: React.FC<AdventureViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.map(h => ({
      ...h,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))
  );
  
  const [currentNarratorText, setCurrentNarratorText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('mic');
  const [isPaused, setIsPaused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  const serviceRef = useRef<StoryScapeService | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: number;
    const checkSignal = () => {
      if (analysers.out) {
        const data = new Uint8Array(analysers.out.frequencyBinCount);
        analysers.out.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsNarrating(volume > 3);
      }
      if (analysers.in) {
        const data = new Uint8Array(analysers.in.frequencyBinCount);
        analysers.in.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsUserSpeaking(volume > 3);
      }
      anim = requestAnimationFrame(checkSignal);
    };
    checkSignal();
    return () => cancelAnimationFrame(anim);
  }, [analysers]);

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(30);
    const fetchedLore = await service.fetchLore(advConfig);
    setLore(fetchedLore);
    setConnectingProgress(70);

    const systemInstruction = `
      You are the Master Narrator for an immersive ${advConfig.genre} adventure titled "${advConfig.topic}".
      STYLE: Cinematic, vivid, and responsive. 
      LORE: Use these facts if relevant: ${fetchedLore.manifest}
      INSTRUCTION: Keep each turn relatively short (2-4 sentences). Always end with a prompt that invites the user's input.
      NEVER break character.
    `;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (role === 'model') {
          setCurrentNarratorText(text);
          if (isFinal) {
            setMessages(prev => [...prev, { role: 'model', text, timestamp }]);
            setCurrentNarratorText('');
          }
        } else {
          setCurrentUserText(text);
          if (isFinal) {
            setMessages(prev => [...prev, { role: 'user', text, timestamp }]);
            setCurrentUserText('');
          }
        }
      },
      onError: (err) => console.error("Neural Link Failure:", err),
      onClose: () => onExit(),
    }, messages.map(m => ({ role: m.role, text: m.text })), fetchedLore, systemInstruction).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
      // Start with Mic Active by default for immersion
      service.setMicActive(true);
    });
  };

  useEffect(() => {
    initService(config);
    const audio = new Audio(AMBIENT_SOUNDS[config.genre]);
    audio.loop = true;
    audio.volume = ambientVolume;
    audio.play().catch(e => console.warn("Ambient offline", e));
    ambientAudioRef.current = audio;

    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.volume = ambientVolume;
  }, [ambientVolume]);

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [messages, showHistory]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !serviceRef.current) return;
    const msg = textInput.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextInput('');
  };

  // Fix: handleMicToggle was used in the render but not defined
  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      await serviceRef.current.setMicActive(newMode === 'mic');
    }
  };

  const getThemeColor = () => {
    switch(config.genre) {
      case Genre.FANTASY: return 'from-amber-500/20';
      case Genre.SCIFI: return 'from-cyan-500/20';
      case Genre.HORROR: return 'from-red-500/20';
      case Genre.MYSTERY: return 'from-purple-500/20';
      default: return 'from-white/10';
    }
  };

  return (
    <div className={`h-screen bg-black text-white font-sans flex flex-col overflow-hidden relative selection:bg-white selection:text-black`}>
      {/* Background Ambience Layers */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getThemeColor()} to-transparent opacity-30 pointer-events-none`}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)] pointer-events-none"></div>

      {/* HEADER: Minimal & Floating */}
      <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-[100] bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full glass border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-[0.3em] uppercase opacity-80">{config.topic}</h1>
            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white/40">{config.genre} • {config.language}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowHistory(!showHistory)}
             className={`w-10 h-10 rounded-full glass border-white/10 flex items-center justify-center transition-all ${showHistory ? 'bg-white text-black' : 'hover:bg-white/10'}`}
             title="Adventure Log"
           >
             <i className="fas fa-scroll text-xs"></i>
           </button>
           <button onClick={onExit} className="px-6 py-2 rounded-full glass border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:border-red-500 transition-all">Exit Saga</button>
        </div>
      </header>

      {/* MAIN CINEMATIC AREA */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-6 mt-16 mb-32">
        
        {/* NEURAL CORE: Central Visualizer Focus */}
        <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
           <div className={`absolute inset-0 transition-all duration-1000 ${isNarrating ? 'scale-110 opacity-100' : 'scale-100 opacity-40'}`}>
              <Visualizer 
                inputAnalyser={analysers.in} 
                outputAnalyser={analysers.out} 
                genre={config.genre} 
                isPaused={isPaused} 
              />
           </div>
           
           {/* Focus Aura */}
           <div className={`w-48 h-48 rounded-full border border-white/5 flex items-center justify-center transition-all duration-1000 ${isNarrating ? 'border-white/30 shadow-[0_0_100px_rgba(255,255,255,0.1)] scale-105' : 'scale-95'}`}>
              <div className={`w-32 h-32 rounded-full glass border-white/5 flex items-center justify-center shadow-inner`}>
                 <i className={`fas ${isNarrating ? 'fa-volume-high animate-pulse' : isUserSpeaking ? 'fa-microphone animate-bounce text-red-500' : 'fa-brain opacity-20'} text-2xl transition-colors`}></i>
              </div>
           </div>

           {/* Loading State Overlay */}
           {connectingProgress < 100 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-3xl z-50 rounded-full">
                <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
                <div className="text-center">
                   <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40">Awakening Oracle</p>
                   <p className="text-xl font-black mt-2">{connectingProgress}%</p>
                </div>
             </div>
           )}
        </div>

        {/* NARRATION TEXT: Subtitle Style */}
        <div className="w-full max-w-4xl text-center mt-12 min-h-[120px] flex items-center justify-center px-4">
           <p className={`text-xl md:text-3xl leading-relaxed font-light transition-all duration-700 ${isNarrating ? 'text-white opacity-100' : 'text-white/40 blur-[1px]'}`}>
             {currentNarratorText || messages[messages.length - 1]?.text || "The journey begins..."}
           </p>
        </div>

        {/* USER INPUT PREVIEW: Bottom-center overlay */}
        {currentUserText && (
          <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
             <div className="glass px-8 py-4 rounded-[2rem] border-white/10 bg-black/60 shadow-2xl flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                <p className="text-sm md:text-base italic font-medium text-white/80">{currentUserText}</p>
             </div>
          </div>
        )}
      </main>

      {/* HISTORY SLIDE-OVER */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-black/95 backdrop-blur-3xl z-[200] border-l border-white/10 transition-transform duration-700 ease-out shadow-[-50px_0_100px_rgba(0,0,0,0.8)] ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
             <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Adventure Log</h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Total Turns: {messages.length}</p>
             </div>
             <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10"><i className="fas fa-times"></i></button>
          </div>
          
          <div ref={historyScrollRef} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar scroll-smooth">
             {messages.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                  <i className="fas fa-scroll-old text-5xl mb-6"></i>
                  <p className="text-xs uppercase tracking-[0.4em] font-black">Archive Empty</p>
               </div>
             )}
             {messages.map((m, i) => (
               <div key={i} className={`flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[8px] font-black uppercase tracking-[0.4em] px-3 py-1 rounded-sm ${m.role === 'user' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'}`}>
                      {m.role === 'user' ? 'Wanderer' : 'Oracle'}
                    </span>
                    <span className="text-[8px] opacity-20 font-black uppercase">{m.timestamp}</span>
                  </div>
                  <p className={`text-base md:text-lg leading-relaxed ${m.role === 'user' ? 'text-white/60 italic' : 'text-white/90'}`}>{m.text}</p>
               </div>
             ))}
          </div>

          {lore && lore.sources.length > 0 && (
            <div className="p-8 border-t border-white/5 bg-black/40">
               <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">Neural Grounding Sources</h4>
               <div className="flex flex-wrap gap-2">
                  {lore.sources.slice(0, 3).map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] glass px-3 py-1.5 rounded-full border-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest truncate max-w-[140px]">
                       {s.title}
                    </a>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 md:p-10 z-[150] bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-6">
           
           {/* Ambient & System Controls */}
           <div className="flex items-center gap-4 glass px-6 py-3 rounded-full border-white/10 bg-black/40 shadow-xl">
              <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                 <i className="fas fa-volume-low text-[10px] opacity-40"></i>
                 <input 
                    type="range" min="0" max="1" step="0.01" value={ambientVolume} 
                    onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} 
                    className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white" 
                 />
              </div>
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-green-500 text-black' : 'hover:bg-white/5 text-white/40'}`}
                title={isPaused ? "Resume" : "Halt Saga"}
              >
                 <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-xs`}></i>
              </button>
           </div>

           {/* Central Input Interaction */}
           <div className="flex-1 w-full flex items-center gap-4">
              <button 
                onClick={handleMicToggle}
                className={`w-16 h-16 rounded-full border-2 transition-all flex items-center justify-center shadow-2xl shrink-0 group ${
                  inputMode === 'mic' 
                    ? 'bg-red-600 border-red-400 text-white animate-pulse' 
                    : 'glass border-white/10 text-white/30 hover:text-white'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
              </button>

              <div className="flex-1 relative group">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex gap-2 w-full">
                       <input 
                         type="text" 
                         value={textInput} 
                         onChange={(e) => setTextInput(e.target.value)}
                         placeholder="Describe your action..."
                         className="flex-1 glass border-white/10 rounded-full px-8 py-5 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all text-lg font-light placeholder:opacity-20"
                       />
                       <button 
                         type="submit" 
                         disabled={!textInput.trim()}
                         className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 shadow-2xl"
                       >
                          <i className="fas fa-arrow-up text-lg"></i>
                       </button>
                    </form>
                 ) : (
                    <div className="w-full h-16 rounded-full glass border border-dashed border-white/10 flex items-center px-8 text-white/20 uppercase tracking-[0.4em] font-black text-xs">
                       {isUserSpeaking ? "Neural Link Active" : "Speak to shape destiny..."}
                    </div>
                 )}
              </div>
           </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        
        @keyframes subtle-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        .neural-orb-glow {
          animation: subtle-pulse 5s ease-in-out infinite;
        }
      ` }} />
    </div>
  );
};

export default AdventureView;
