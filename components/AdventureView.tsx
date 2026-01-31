
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
    return text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/^[^:]+:\s*/, '').replace(/\s+/g, ' ').trim();
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
        const processedText = cleanText(text);
        if (!processedText && !isFinal) return;

        if (role === 'model') {
          if (isFinal) {
            setTranscriptions(prev => [...prev, { role: 'model', text: processedText }]);
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(processedText);
          }
        } else {
          if (isFinal) {
            setTranscriptions(prev => [...prev, { role: 'user', text: processedText }]);
            setCurrentUserText('');
          } else {
            setCurrentUserText(processedText);
          }
        }
      },
      onError: (err) => {
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => onExit(),
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcriptions, currentModelText, currentUserText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    setTranscriptions(prev => [...prev, { role: 'user', text: textChoice.trim() }]);
    serviceRef.current.sendTextChoice(textChoice.trim());
    setTextChoice('');
    startBuffering();
  };

  const handleSaveDraft = () => {
    localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions }));
    onExit();
  };

  const handleExitAndClear = () => {
    localStorage.removeItem('storyscape_saved_session');
    onExit();
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleSaveDraft} className="px-6 py-3 rounded-full bg-white/10 border border-white/10 text-xs font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-all flex items-center gap-2">
            <i className="fas fa-save text-[10px]"></i> Save Draft
          </button>
          <button onClick={() => setShowFinishConfirmation(true)} className="px-8 py-3 rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.2em] shadow-2xl shrink-0">Finish</button>
          <button onClick={handleExitAndClear} className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center shrink-0"><i className="fas fa-stop"></i></button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-white/10 z-10 bg-black/20">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8 text-center px-12 pointer-events-none">
               <div className="relative">
                 <div className="w-40 h-40 border-[6px] border-white/5 border-t-white rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl">{isBuffering ? bufferPercent : connectingProgress}%</div>
               </div>
               <h3 className="text-xl font-black uppercase tracking-[0.3em]">Connecting to Oracle...</h3>
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
                <p className="text-xl md:text-2xl leading-relaxed italic opacity-60 break-words hyphens-auto">{currentModelText || currentUserText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 glass border-t border-white/10 flex flex-col gap-6 bg-black/40 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <button onClick={handleMicToggle} className={`flex items-center gap-4 px-8 py-4 rounded-full border transition-all shrink-0 ${inputMode === 'mic' ? 'bg-blue-600 border-blue-400 text-white shadow-2xl' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-keyboard'}`}></i>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{inputMode === 'mic' ? 'Mic Active' : 'Text Mode'}</span>
            </button>
            <button onClick={() => setIsPaused(!isPaused)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${isPaused ? 'bg-green-600 text-white shadow-2xl' : 'glass border-white/10 hover:bg-white/5'}`}>
                <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
            </button>
          </div>

          {inputMode === 'text' && (
            <form onSubmit={handleTextSubmit} className="relative flex items-center gap-3">
              <input type="text" value={textChoice} onChange={(e) => setTextChoice(e.target.value)} disabled={isPaused} placeholder={isPaused ? "Saga Paused..." : "Describe your intent..."} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none focus:border-white/30 text-lg font-light transition-all disabled:opacity-30" />
              <button type="submit" disabled={!textChoice.trim() || isPaused} className="px-10 py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-xs shadow-2xl shrink-0">Send</button>
            </form>
          )}
        </div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }` }} />
    </div>
  );
};

export default AdventureView;
