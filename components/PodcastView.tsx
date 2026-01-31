
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
  const [ambientVolume, setAmbientVolume] = useState(0.15);
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [lore, setLore] = useState<LoreData | null>(null);
  
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
        return p + Math.floor(Math.random() * 5) + 2;
      });
    }, 450);
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
    
    // ENHANCED PROMPT: Specifically designed to emulate "The Why Files" (AJ & Hecklefish style)
    const customInstruction = `You are the host of a world-renowned, high-production investigative podcast in ${advConfig.language}. 
    STYLE: Inspired by AJ from "The Why Files". You are witty, deeply researched, skeptical but open-minded, and highly entertaining. 
    
    SPECIAL INSTRUCTION: Occasionally, simulate an interaction with your skeptical, witty sidekick (like Hecklefish). 
    - You (AJ style): Serious, narrative-driven, providing facts.
    - Sidekick: Sarcastic, скеptical, adding humor or asking the "dumb" questions.
    Keep the sidekick interruptions brief but punchy.

    LORE MANIFEST (This is your research data. Ground the story in THESE facts):
    ${fetchedLore.manifest}

    STRICT BROADCAST RULES:
    1. PROFESSIONAL PACING: Build suspense. Use dramatic pauses.
    2. THE "HOOK": Every segment must leave the listener wanting more.
    3. BROADCAST CLARITY: No repetitive phrasing. Perfect spacing between words.
    4. TOPIC FOCUS: Deep dive into the mystery or crime of: "${advConfig.topic}". Use real-world grounding provided in the Lore Manifest.`;

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
          service.sendTextChoice("Keep the show moving. Transition to the next fascinating discovery or crime detail. Involve the sidekick for a quick witty retort before diving back into the facts.");
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
    const ambientUrl = PODCAST_AMBIENTS[config.genre as string] || PODCAST_AMBIENTS['Documentary'];
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
    <div className={`h-screen bg-[#050512] text-violet-50 font-sans flex flex-col p-4 md:p-10 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      {/* Decorative Broadcast Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-30"></div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 z-10 shrink-0">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-violet-400 leading-none">THE BROADCAST: {config.topic}</h1>
          <div className="flex items-center gap-3 mt-3">
            <div className={`flex items-center gap-2 glass px-3 py-1 rounded-full border-violet-500/20`}>
              <div className={`w-2 h-2 rounded-full ${isOutputActive ? 'bg-violet-500 shadow-[0_0_10px_#8b5cf6] animate-pulse' : 'bg-red-600'}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest">{isOutputActive ? 'LIVE' : 'ON AIR'}</span>
            </div>
            <p className="text-[10px] opacity-40 uppercase tracking-[0.3em] font-bold">{config.genre} • {config.language}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-4 glass px-6 py-3 rounded-full flex-1 md:flex-none border-violet-500/10">
            <i className="fas fa-sliders text-violet-400 text-xs"></i>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-violet-900/40 rounded-lg appearance-none cursor-pointer accent-violet-500" />
          </div>
          <button onClick={() => { setIsSummarizing(true); StoryScapeService.generateSummary(config.genre, transcriptions).then(s => { setSummary(s); setIsSummarizing(false); }); }} className="px-10 py-3.5 rounded-full bg-violet-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-105 transition-all">END BROADCAST</button>
          <button onClick={onExit} className="w-12 h-12 rounded-full bg-white/5 text-white/40 border border-white/5 flex items-center justify-center hover:text-red-400 transition-all"><i className="fas fa-times"></i></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full glass rounded-[4rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] relative border-violet-500/10 z-10 bg-black/40 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12 scroll-smooth custom-scrollbar relative">
          
          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl z-50 flex flex-col items-center justify-center gap-10 text-center px-16">
               <div className="relative">
                 <div className={`w-40 h-40 border-[4px] border-violet-900/20 border-t-violet-500 rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl text-violet-400">
                   {connectingProgress < 100 ? connectingProgress : bufferPercent}%
                 </div>
               </div>
               <div className="space-y-4">
                 <h3 className="text-xl font-black uppercase tracking-[0.5em] text-violet-400">
                   {connectingProgress < 100 ? 'SYNCING SATELLITE LINK...' : 'GATHERING INTELLIGENCE...'}
                 </h3>
                 <p className="text-[10px] opacity-30 uppercase tracking-[0.2em] max-w-sm mx-auto">Accessing neural archives and grounding the narrative in verified data.</p>
               </div>
            </div>
          )}
          
          {transcriptions.length === 0 && !isBuffering && connectingProgress === 100 && (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center space-y-6">
              <i className="fas fa-microphone-lines text-8xl"></i>
              <p className="text-sm font-black uppercase tracking-[1em]">Standby for Transmission</p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="max-w-[92%] p-10 rounded-[3rem] bg-violet-950/[0.08] border border-violet-500/10 rounded-tl-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/20"></div>
                <p className="text-[10px] text-violet-500/60 mb-4 uppercase tracking-[0.5em] font-black flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span> SYSTEM NARRATOR
                </p>
                <p className="text-2xl md:text-3xl leading-relaxed font-light text-violet-50/90 tracking-tight">{t.text}</p>
              </div>
            </div>
          ))}

          {currentModelText && (
            <div className="flex justify-start">
              <div className="max-w-[92%] p-10 rounded-[3rem] bg-violet-500/[0.02] border border-dashed border-violet-500/20 rounded-tl-none animate-pulse">
                <p className="text-2xl md:text-3xl leading-relaxed italic text-violet-400/60">{currentModelText}</p>
              </div>
            </div>
          )}
        </div>

        {/* Control Footer */}
        <div className="p-10 glass-dark border-t border-violet-500/10 flex flex-col gap-8 bg-black/60 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex items-center gap-12">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 mb-2">Signal Status</span>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-violet-500 shadow-[0_0_20px_#8b5cf6]' : 'bg-white/5'}`}></div>
                  <span className="text-xs font-black uppercase tracking-widest">{isOutputActive ? 'TRANSMITTING' : 'IDLE'}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-violet-500/10 hidden lg:block"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 mb-2">Episode Clock</span>
                <div className="flex items-center gap-3 text-violet-400">
                  <i className="fas fa-stopwatch text-xs"></i>
                  <span className="text-base font-black tracking-[0.2em]">{formatTime(secondsRemaining)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <button onClick={togglePause} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isPaused ? 'bg-violet-600 text-white' : 'glass border-violet-500/20 hover:bg-violet-500/10'}`}>
                 <i className={`fas ${isPaused ? 'fa-play translate-x-0.5' : 'fa-pause'} text-xl`}></i>
               </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-violet-950/40 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all duration-1000 shadow-[0_0_20px_#8b5cf6]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 15) * 60)) * 100}%` }}></div>
          </div>
        </div>
      </main>

      {summary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl overflow-y-auto">
          <div className="max-w-5xl w-full my-auto space-y-16 py-20 animate-in fade-in slide-in-from-bottom-12">
            <div className="text-center space-y-6">
              <p className="text-violet-500 uppercase tracking-[1.2em] text-[10px] font-black">Episode Conclusion</p>
              <h2 className="text-8xl md:text-[10rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-violet-400 to-violet-900 uppercase leading-none">THE END</h2>
            </div>
            <div className="glass p-16 rounded-[5rem] border-violet-500/20 bg-violet-950/5 relative shadow-2xl">
              <i className="fas fa-quote-left absolute top-12 left-12 text-violet-500/10 text-8xl"></i>
              <p className="text-3xl md:text-4xl font-light italic text-center leading-relaxed text-violet-100/90 font-serif">"{summary}"</p>
            </div>
            <div className="flex justify-center pt-10">
              <button onClick={onExit} className="px-16 py-8 rounded-[3rem] bg-white text-black font-black uppercase tracking-[0.4em] shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform active:scale-95">BACK TO STUDIO</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 5px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default PodcastView;
