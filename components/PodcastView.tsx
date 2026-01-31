
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, NarratorMode } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface PodcastViewProps {
  config: AdventureConfig;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const PODCAST_AMBIENTS: Record<string, string> = {
  'Mystery': 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  'Thriller': 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  'Documentary': 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  'Sci-Fi': 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-wind-vibe-1204.mp3',
};

const PodcastView: React.FC<PodcastViewProps> = ({ config, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [secondsRemaining, setSecondsRemaining] = useState((config.durationMinutes || 15) * 60);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isOutputActive, setIsOutputActive] = useState(false);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
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
      anim = requestAnimationFrame(checkSignal);
    };
    checkSignal();
    return () => cancelAnimationFrame(anim);
  }, [analysers, isBuffering]);

  const startBuffering = () => {
    setIsBuffering(true);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    bufferIntervalRef.current = window.setInterval(() => {
      setBufferPercent(p => {
        if (p >= 99) return 99;
        return p + Math.floor(Math.random() * 4) + 1;
      });
    }, 500);
  };

  const stopBuffering = () => {
    setIsBuffering(false);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
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
    
    const customInstruction = `You are the host of a high-production, incredibly engaging investigative podcast in ${advConfig.language}. 
    Style: Inspired by AJ from "The Why Files". You are witty, deeply researched, suspenseful, and highly entertaining. 
    
    LORE MANIFEST (Incorporate these facts with cinematic flair):
    ${fetchedLore.manifest}

    STRICT PERFORMANCE RULES:
    1. DYNAMIC DELIVERY: Vary your tone. Use hooks, cliffhangers, and insightful observations.
    2. THE "FISH" SIDEKICK: Occasionally include a witty interaction with an imaginary, skeptical sidekick for humor and pacing.
    3. BROADCAST QUALITY: No repetitions. No stuttering. No merged words.
    4. IMMERSIVE INVESTIGATION: Focus on real-world mystery, crime, or mind-blowing knowledge related to: ${advConfig.topic}.`;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        if (role === 'model') {
          if (isFinal) {
            setTranscriptions(prev => {
              const fullText = smartAppend(currentModelText, text).replace(/\s+/g, ' ').trim();
              if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === fullText) return prev;
              return [...prev, { role: 'model', text: fullText }];
            });
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(prev => smartAppend(prev, text));
          }
        }
      },
      onTurnComplete: () => {
        if (secondsRemaining > 0) {
          service.sendTextChoice("Keep the broadcast going. Dive deeper into the next phase of the investigation. Make it thrilling.");
          startBuffering();
        }
      },
      onError: () => {
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => onExit(),
    }, transcriptions, fetchedLore, customInstruction).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
    const ambientUrl = PODCAST_AMBIENTS[config.genre] || PODCAST_AMBIENTS['Documentary'];
    const audio = new Audio(ambientUrl);
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
    if (connectingProgress === 100 && !isPaused && secondsRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setSecondsRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [connectingProgress, isPaused, secondsRemaining]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, currentModelText]);

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (serviceRef.current) serviceRef.current.setPaused(next);
    if (ambientAudioRef.current) {
      if (next) ambientAudioRef.current.pause();
      else if (!isMuted) ambientAudioRef.current.play();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`h-screen bg-[#050510] text-violet-50 font-sans flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-violet-400">EPISODE: {config.topic}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2.5 h-2.5 rounded-full ${isOutputActive ? 'bg-violet-500 animate-pulse' : 'bg-red-500'}`}></div>
            <p className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-black">BROADCASTING • {config.genre}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-violet-500/20">
            <i className="fas fa-headphones text-violet-400 text-xs"></i>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-violet-900/30 rounded-lg appearance-none cursor-pointer accent-violet-500" />
          </div>
          <button onClick={() => { setIsSummarizing(true); StoryScapeService.generateSummary(config.genre, transcriptions).then(s => { setSummary(s); setIsSummarizing(false); }); }} className="px-6 py-2.5 rounded-full bg-violet-600 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(139,92,246,0.5)]">END SHOW</button>
          <button onClick={onExit} className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-violet-500/10 z-10 bg-black/40 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 scroll-smooth custom-scrollbar relative">
          {(connectingProgress < 100 || isBuffering || isDownloading) && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center gap-6 text-center px-12">
               <div className="relative">
                 <div className={`w-36 h-36 border-[6px] border-violet-900/20 border-t-violet-500 rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-violet-400">
                   {connectingProgress < 100 ? connectingProgress : bufferPercent}%
                 </div>
               </div>
               <div className="space-y-2">
                 <p className="text-xs font-black uppercase tracking-[0.5em] text-violet-400">
                   {connectingProgress < 100 ? 'SYNCING BROADCAST...' : 'RESEARCHING NEXT SEGMENT...'}
                 </p>
                 <p className="text-[10px] opacity-40 uppercase tracking-widest">Live from the StoryScape Studio</p>
               </div>
            </div>
          )}
          
          {transcriptions.length === 0 && !isBuffering && connectingProgress === 100 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
              <i className="fas fa-microphone-lines text-6xl"></i>
              <p className="text-sm font-black uppercase tracking-[0.5em]">Waiting for transmission...</p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="max-w-[90%] p-8 rounded-[2.5rem] bg-violet-950/10 border border-violet-500/10 rounded-tl-none shadow-xl">
                <p className="text-[9px] text-violet-400 mb-3 uppercase tracking-[0.4em] font-black flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span> THE HOST
                </p>
                <p className="text-xl md:text-2xl leading-relaxed font-light text-violet-50/90">{t.text}</p>
              </div>
            </div>
          ))}

          {currentModelText && (
            <div className="flex justify-start">
              <div className="max-w-[90%] p-8 rounded-[2.5rem] bg-violet-950/5 border border-dashed border-violet-500/20 rounded-tl-none animate-pulse">
                <p className="text-xl md:text-2xl leading-relaxed italic text-violet-300/70">{currentModelText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 glass-dark border-t border-violet-500/10 flex flex-col gap-6 bg-black/60 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">On Air</span>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isOutputActive ? 'bg-violet-500 shadow-[0_0_15px_#8b5cf6]' : 'bg-white/10'}`}></div>
                  <span className="text-xs font-black uppercase tracking-[0.2em]">{isOutputActive ? 'Transmitting' : 'Idle'}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-violet-500/20 hidden md:block"></div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">Show Timer</span>
                <div className="flex items-center gap-3 text-violet-400">
                  <i className="fas fa-clock text-xs"></i>
                  <span className="text-sm font-black tracking-widest">{formatTime(secondsRemaining)}</span>
                </div>
              </div>
            </div>
            
            <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-violet-600 text-white shadow-2xl' : 'glass border-violet-500/20 hover:bg-violet-500/10'}`}>
              <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
            </button>
          </div>
          <div className="w-full h-1.5 bg-violet-950/40 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all duration-1000 shadow-[0_0_15px_#8b5cf6]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 15) * 60)) * 100}%` }}></div>
          </div>
        </div>
      </main>

      {summary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl overflow-y-auto">
          <div className="max-w-4xl w-full my-auto space-y-16 py-20 animate-in fade-in slide-in-from-bottom-12">
            <div className="text-center space-y-4">
              <p className="text-violet-400 uppercase tracking-[1em] text-xs font-black">Post-Show Wrap Up</p>
              <h2 className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-600 uppercase">WRAP</h2>
            </div>
            <div className="glass p-16 rounded-[5rem] border-violet-500/20 bg-violet-950/5 relative">
              <i className="fas fa-quote-left absolute top-10 left-10 text-violet-500/20 text-6xl"></i>
              <p className="text-3xl font-light italic text-center leading-relaxed text-violet-100">"{summary}"</p>
            </div>
            <div className="flex justify-center pt-8">
              <button onClick={onExit} className="px-16 py-8 rounded-[3rem] bg-white text-black font-black uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform">Back to Studio</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default PodcastView;
