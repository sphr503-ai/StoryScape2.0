
import React, { useEffect, useState, useRef } from 'react';
import { Genre, GeminiVoice, AdventureConfig, NarratorMode } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface AdventureViewProps {
  config: AdventureConfig;
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
};

type InputMode = 'text' | 'mic';

const AdventureView: React.FC<AdventureViewProps> = ({ config, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textChoice, setTextChoice] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isMuted, setIsMuted] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.25);
  const [isPaused, setIsPaused] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const [isOutputActive, setIsOutputActive] = useState(false);
  const [isInputActive, setIsInputActive] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [showLore, setShowLore] = useState(false);

  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (transcriptions.length > 0) {
      localStorage.setItem('storyscape_saved_session', JSON.stringify({
        config,
        transcriptions
      }));
    }
  }, [transcriptions, config]);

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

  const cleanText = (text: string): string => {
    return text
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/^[^:]+:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const smartAppend = (prev: string, next: string): string => {
    if (!prev) return next.trim();
    if (!next) return prev;
    const cleanPrev = prev.trim();
    const cleanNext = next.trim();
    if (cleanPrev.endsWith(cleanNext)) return prev;
    const maxOverlap = Math.min(cleanPrev.length, cleanNext.length);
    for (let len = maxOverlap; len >= 2; len--) {
      const suffix = cleanPrev.slice(-len);
      const prefix = cleanNext.slice(0, len);
      if (suffix === prefix) return cleanPrev + cleanNext.slice(len);
    }
    const needsSpace = !prev.endsWith(' ') && !next.startsWith(' ') && !/^[।.,!?]/.test(cleanNext);
    return prev + (needsSpace ? ' ' : '') + next;
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
        const processedText = cleanText(text);
        if (!processedText && !isFinal) return;

        if (role === 'model') {
          if (isFinal) {
            setTranscriptions(prev => {
              const fullText = smartAppend(currentModelText, processedText).replace(/\s+/g, ' ').trim();
              if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === fullText) return prev;
              return [...prev, { role: 'model', text: fullText }];
            });
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(prev => smartAppend(prev, processedText));
          }
        } else {
          if (isFinal) {
            setTranscriptions(prev => {
              const fullText = smartAppend(currentUserText, processedText).replace(/\s+/g, ' ').trim();
              if (prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].text === fullText) return prev;
              return [...prev, { role: 'user', text: fullText }];
            });
            setCurrentUserText('');
          } else {
            setCurrentUserText(prev => smartAppend(prev, processedText));
          }
        }
      },
      onError: (err) => {
        console.error("Gemini Error:", err);
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => {
        localStorage.removeItem('storyscape_saved_session');
        onExit();
      },
    }, transcriptions, fetchedLore).then(() => {
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, currentModelText, currentUserText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    const choice = textChoice.trim();
    setTranscriptions(prev => [...prev, { role: 'user', text: choice }]);
    serviceRef.current.sendTextChoice(choice);
    setTextChoice('');
    startBuffering();
  };

  const toggleInputMode = () => setInputMode(prev => prev === 'text' ? 'mic' : 'text');

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (serviceRef.current) serviceRef.current.setPaused(next);
    if (ambientAudioRef.current) {
      if (next) ambientAudioRef.current.pause();
      else if (!isMuted) ambientAudioRef.current.play();
    }
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
    <div className={`h-screen bg-gradient-to-b ${getGenreStyles()} flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">{config.genre}: {config.topic}</h1>
            <div className="flex items-center gap-3 mt-0.5">
               <div className={`w-2.5 h-2.5 rounded-full ${isOutputActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
               <p className="text-[10px] opacity-60 uppercase tracking-widest font-black">{config.language} • {config.mode}</p>
               {lore && (
                 <button onClick={() => setShowLore(!showLore)} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-white/10 transition-colors">
                   <i className="fas fa-scroll mr-1"></i> Lore Archives
                 </button>
               )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-4 glass px-6 py-3 rounded-full flex-1 md:flex-none border-white/5">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70"><i className={`fas ${isMuted ? 'fa-volume-mute text-red-400' : 'fa-volume-low'}`}></i></button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white" />
          </div>
          <button onClick={() => setShowFinishConfirmation(true)} className="px-8 py-3 rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.2em] shadow-2xl shrink-0">Finish</button>
          <button onClick={onExit} className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center shrink-0"><i className="fas fa-stop"></i></button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-white/10 z-10 bg-black/20">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {showLore && lore && (
            <div className="mb-12 glass p-8 rounded-[2.5rem] border-white/10 bg-black/40 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter text-blue-400">Archival Findings</h3>
                <button onClick={() => setShowLore(false)} className="opacity-40 hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
              </div>
              <p className="text-sm font-light leading-relaxed mb-6 opacity-80">{lore.manifest}</p>
              <div className="flex flex-wrap gap-2">
                {lore.sources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/5 transition-all text-blue-300">
                    <i className="fas fa-link mr-1.5"></i> {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8 text-center px-12">
               <div className="relative">
                 <div className="w-40 h-40 border-[6px] border-white/5 border-t-white rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl">{isBuffering ? bufferPercent : connectingProgress}%</div>
               </div>
               <div className="space-y-3">
                 <h3 className="text-xl font-black uppercase tracking-[0.3em]">
                   {connectingProgress < 20 ? 'Accessing Global Archives...' : 
                    connectingProgress < 50 ? 'Synthesizing World Data...' : 
                    isBuffering ? 'Re-weaving temporal thread...' : 'Summoning the Voice...'}
                 </h3>
                 <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] max-w-xs mx-auto">
                   {connectingProgress < 50 ? 'Fetching real-world inspirations to ground the narrative...' : 'Establishing live vocal connection...'}
                 </p>
               </div>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl ${t.role === 'user' ? 'bg-white/10 border border-white/10 rounded-tr-none' : 'bg-black/40 border border-white/5 rounded-tl-none'}`}>
                <p className={`text-[9px] opacity-30 mb-2 uppercase tracking-[0.3em] font-black ${t.role === 'user' ? 'text-right' : 'text-left'}`}>{t.role === 'user' ? 'The Wanderer' : 'The Oracle'}</p>
                <p className="text-xl md:text-2xl leading-relaxed font-light break-words hyphens-auto">{t.text}</p>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] ${currentUserText ? 'bg-white/10 rounded-tr-none' : 'bg-black/40 rounded-tl-none'} animate-pulse`}>
                <p className="text-xl md:text-2xl leading-relaxed italic opacity-60 break-words hyphens-auto">
                  {currentModelText || currentUserText}
                  <span className="inline-flex gap-1 ml-4">
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.1s]"></span>
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 glass border-t border-white/10 flex flex-col gap-6 bg-black/40 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-4">
                 <div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Narrator Status</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className={`w-3.5 h-3.5 rounded-full ${isInputActive ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-white/10'}`}></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Input Signal</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={toggleInputMode} className={`flex items-center gap-4 px-8 py-4 rounded-full border transition-all shrink-0 ${inputMode === 'mic' ? 'bg-blue-600 border-blue-400 text-white shadow-2xl' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-keyboard'}`}></i>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{inputMode === 'mic' ? 'Mic Active' : 'Text Mode'}</span>
              </button>
              <button onClick={togglePause} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${isPaused ? 'bg-green-600 text-white shadow-2xl' : 'glass border-white/10'}`}>
                <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
              </button>
            </div>
          </div>

          {inputMode === 'text' ? (
            <form onSubmit={handleTextSubmit} className="relative flex items-center gap-3">
              <input type="text" value={textChoice} onChange={(e) => setTextChoice(e.target.value)} disabled={isPaused} placeholder={isPaused ? "Saga Paused..." : "Describe your intent..."} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none focus:border-white/30 text-lg font-light transition-all disabled:opacity-30" />
              <button type="submit" disabled={!textChoice.trim() || isPaused} className="px-10 py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-xs shadow-2xl shrink-0">Send</button>
            </form>
          ) : (
            <div className="flex flex-col items-center py-6 bg-blue-500/10 rounded-[2rem] border border-blue-500/20 animate-pulse">
               <span className="text-sm font-black uppercase tracking-[0.3em] text-blue-400">Capturing Vocal Intent...</span>
            </div>
          )}
        </div>
      </main>

      {showFinishConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
          <div className="glass p-12 rounded-[4rem] border-white/10 max-w-lg w-full text-center space-y-10">
            <h3 className="text-3xl font-black uppercase">Finalize Chronicle?</h3>
            <div className="flex flex-col gap-4">
              <button onClick={async () => { setShowFinishConfirmation(false); setIsSummarizing(true); setSummary(await StoryScapeService.generateSummary(config.genre, transcriptions)); setIsSummarizing(false); localStorage.removeItem('storyscape_saved_session'); }} className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em]">Begin Finalization</button>
              <button onClick={() => setShowFinishConfirmation(false)} className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 font-bold uppercase tracking-[0.2em]">Return to Story</button>
            </div>
          </div>
        </div>
      )}

      {(summary || isSummarizing) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl overflow-y-auto">
          <div className="max-w-4xl w-full my-auto space-y-16 py-20">
            {isSummarizing ? (
              <div className="text-center animate-pulse"><h2 className="text-4xl font-black uppercase tracking-tighter">Weaving the Finale...</h2></div>
            ) : (
              <div className="space-y-16 animate-in fade-in slide-in-from-bottom-12">
                <div className="text-center"><h2 className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/20 uppercase">FINALE</h2></div>
                <div className="glass p-16 rounded-[5rem] border-white/10"><p className="text-3xl font-light italic text-center leading-relaxed">"{summary}"</p></div>
                <div className="flex justify-center pt-8"><button onClick={onExit} className="px-16 py-8 rounded-[3rem] bg-white text-black font-black uppercase tracking-[0.3em] shadow-2xl">Return to Hub</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdventureView;
