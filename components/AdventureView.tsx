
import React, { useEffect, useState, useRef } from 'react';
import { Genre, GeminiVoice, AdventureConfig, NarratorMode } from '../types';
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

// Added missing music genres to fulfill Record<Genre, string> requirements
const AMBIENT_SOUNDS: Record<Genre, string> = {
  [Genre.FANTASY]: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-at-night-with-crickets-1224.mp3',
  [Genre.SCIFI]: 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-wind-vibe-1204.mp3',
  [Genre.MYSTERY]: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  [Genre.HORROR]: 'https://assets.mixkit.co/sfx/preview/mixkit-horror-atmosphere-drone-953.mp3',
  [Genre.THRILLER]: 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  [Genre.DOCUMENTARY]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.POP]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.ROCK]: 'https://assets.mixkit.co/sfx/preview/mixkit-battle-ambient-with-explosions-2780.mp3',
  [Genre.JAZZ]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.HIPHOP]: 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  [Genre.CLASSICAL]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.SOUL]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
};

const AdventureView: React.FC<AdventureViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.map(h => ({
      ...h,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))
  );
  
  const [currentModelText, setCurrentModelText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textChoice, setTextChoice] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('text');
  const [ambientVolume, setAmbientVolume] = useState(0.25);
  const [isPaused, setIsPaused] = useState(false);
  
  const [isOutputActive, setIsOutputActive] = useState(false);
  const [isInputActive, setIsInputActive] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [lore, setLore] = useState<LoreData | null>(null);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let anim: number;
    const checkSignal = () => {
      if (analysers.out) {
        const data = new Uint8Array(analysers.out.frequencyBinCount);
        analysers.out.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        const isActive = volume > 2;
        setIsOutputActive(isActive);
        if (isActive && isBuffering) stopBuffering();
      }
      if (analysers.in && inputMode === 'mic') {
        const data = new Uint8Array(analysers.in.frequencyBinCount);
        analysers.in.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsInputActive(volume > 2);
      } else {
        setIsInputActive(false);
      }
      anim = requestAnimationFrame(checkSignal);
    };
    checkSignal();
    return () => cancelAnimationFrame(anim);
  }, [analysers, inputMode, isBuffering]);

  const startBuffering = () => {
    setIsBuffering(true);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    bufferIntervalRef.current = window.setInterval(() => {
      setBufferPercent(p => {
        if (p >= 99) return 99;
        return p + Math.floor(Math.random() * 5) + 3;
      });
    }, 400);
  };

  const stopBuffering = () => {
    setIsBuffering(false);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
  };

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(newMode === 'mic');
      } catch (err) {
        alert("Microphone activation failed.");
        setInputMode('text');
      }
    }
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(5);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    const fetchedLore = await service.fetchLore(advConfig);
    setLore(fetchedLore);
    setConnectingProgress(45);

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (role === 'model') {
          if (isFinal) {
            setMessages(prev => [...prev, { role: 'model', text, timestamp }]);
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(text);
          }
        } else {
          if (isFinal) {
            setMessages(prev => [...prev, { role: 'user', text, timestamp }]);
            setCurrentUserText('');
          } else {
            setCurrentUserText(text);
          }
        }
      },
      onError: (err) => {
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => onExit(),
    }, messages.map(m => ({role: m.role, text: m.text})), fetchedLore).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
    const audio = new Audio(AMBIENT_SOUNDS[config.genre]);
    audio.loop = true;
    audio.volume = ambientVolume;
    audio.play().catch(() => {});
    ambientAudioRef.current = audio;
    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentModelText, currentUserText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: textChoice.trim(), timestamp }]);
    serviceRef.current.sendTextChoice(textChoice.trim());
    setTextChoice('');
    startBuffering();
  };

  const getGenreStyles = () => {
    switch(config.genre) {
      case Genre.FANTASY: return 'from-amber-900/40 to-black text-amber-50 font-fantasy';
      case Genre.SCIFI: return 'from-blue-900/40 to-black text-cyan-50 font-scifi';
      case Genre.MYSTERY: return 'from-slate-800/60 to-black text-slate-100';
      case Genre.HORROR: return 'from-red-950/50 to-black text-red-50';
      default: return 'from-neutral-900 to-black text-white';
    }
  };

  return (
    <div className={`h-screen bg-gradient-to-b ${getGenreStyles()} flex flex-col transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      {/* HEADER */}
      <header className="px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-20 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight uppercase leading-none">{config.topic}</h1>
            <div className="flex items-center gap-3 mt-1.5">
               <div className={`w-2 h-2 rounded-full ${isOutputActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
               <p className="text-[9px] opacity-60 uppercase tracking-widest font-black">{config.genre} • {config.language}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => {
              localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions: messages }));
              onExit();
            }} 
            className="hidden sm:flex px-6 py-2 rounded-full glass text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all gap-2"
          >
            <i className="fas fa-save"></i> Save Draft
          </button>
          <button onClick={onExit} className="flex-1 sm:flex-none px-8 py-2 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-2xl transition-transform active:scale-95">End Saga</button>
        </div>
      </header>

      {/* CHAT AREA */}
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-10 space-y-8 custom-scrollbar scroll-smooth">
          
          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-6 text-center px-12 pointer-events-none">
               <div className="relative">
                 <div className="w-24 h-24 border-[4px] border-white/5 border-t-white rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-xl">{isBuffering ? bufferPercent : connectingProgress}%</div>
               </div>
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Gathering Chronicle Lore...</h3>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full items-end gap-2 animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-5 md:p-6 rounded-2xl shadow-xl relative ${
                m.role === 'user' 
                  ? 'bg-red-600/80 text-white rounded-tr-none border border-white/10' 
                  : 'bg-blue-600/80 text-white rounded-tl-none border border-white/5'
              }`}>
                {/* Bubble Tail */}
                <div className={`absolute top-0 ${m.role === 'user' ? 'right-[-6px]' : 'left-[-6px]'}`}>
                   <svg viewBox="0 0 8 13" className={`w-3 h-4 fill-current ${m.role === 'user' ? 'text-red-600/80' : 'text-blue-600/80'}`}>
                     <path d={m.role === 'user' ? "M0 0v13l8-13H0z" : "M8 0v13l-8-13h8z"} />
                   </svg>
                </div>
                <div className="text-[16px] md:text-xl leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`flex items-center gap-2 mt-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <span className="text-[9px] opacity-40 uppercase tracking-widest font-black">
                     {m.timestamp} — {m.role === 'user' ? 'The Wanderer' : 'The Oracle'}
                   </span>
                   {m.role === 'user' && <i className="fas fa-check-double text-[10px] text-blue-400 opacity-60"></i>}
                </div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-6 rounded-2xl animate-pulse ${
                currentUserText ? 'bg-red-600/30 rounded-tr-none' : 'bg-blue-600/30 rounded-tl-none'
              }`}>
                <div className="text-[16px] md:text-xl leading-relaxed italic opacity-60">
                  {currentModelText || currentUserText}
                </div>
              </div>
            </div>
          )}
          <div className="h-4"></div>
        </div>

        {/* INPUT FOOTER */}
        <div className="p-4 md:p-8 bg-black/60 border-t border-white/5 backdrop-blur-xl flex flex-col gap-6 z-20 shrink-0">
          <div className="max-w-5xl mx-auto w-full flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={handleMicToggle} 
                className={`flex-1 md:w-16 md:h-16 h-14 rounded-2xl md:rounded-full border transition-all flex items-center justify-center gap-3 md:gap-0 ${
                  inputMode === 'mic' 
                    ? 'bg-red-600 border-red-400 text-white shadow-2xl animate-pulse' 
                    : 'glass border-white/10 text-white/40 hover:text-white'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
                <span className="md:hidden text-[10px] font-black uppercase tracking-widest">{inputMode === 'mic' ? 'Mic Active' : 'Text Only'}</span>
              </button>
              
              <button onClick={() => setIsPaused(!isPaused)} className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-green-600 text-white shadow-2xl' : 'glass border-white/10 hover:bg-white/10'}`}>
                  <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-xl`}></i>
              </button>
            </div>

            {inputMode === 'text' && (
              <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-3 w-full">
                <input 
                  type="text" 
                  value={textChoice} 
                  onChange={(e) => setTextChoice(e.target.value)} 
                  disabled={isPaused} 
                  placeholder={isPaused ? "Saga Paused..." : "Respond to the destiny..."} 
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 text-base md:text-lg font-light transition-all disabled:opacity-30" 
                />
                <button 
                  type="submit" 
                  disabled={!textChoice.trim() || isPaused} 
                  className="w-14 h-14 md:px-10 md:w-auto rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center"
                >
                  <span className="hidden md:block">Send</span>
                  <i className="fas fa-paper-plane md:hidden"></i>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }` }} />
    </div>
  );
};

export default AdventureView;
