import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, NarratorMode } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { fastAudioBuffersToWav, downloadOrShareAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface PodcastViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const PODCAST_AMBIENTS: Record<string, string> = {
  'Mystery': 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  'Thriller': 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  'Documentary': 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  'Sci-Fi': 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-wind-vibe-1204.mp3',
};

const PodcastView: React.FC<PodcastViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [ambientVolume, setAmbientVolume] = useState(0.15);
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
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

  const truncateTopic = (text: string) => {
    const words = text.split(/\s+/);
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + ' (....)';
    }
    return text;
  };

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

  const handleDownloadSession = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("No broadcast data available yet.");
      return;
    }
    setIsDownloading(true);
    try {
      const wavBlob = await fastAudioBuffersToWav(serviceRef.current.recordedBuffers);
      await downloadOrShareAudio(wavBlob, `Broadcast_${config.topic.replace(/\s+/g, '_')}.wav`);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem('storyscape_saved_session', JSON.stringify({
      config,
      transcriptions
    }));
    onExit();
  };

  const handleExitAndClear = () => {
    localStorage.removeItem('storyscape_saved_session');
    onExit();
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/\([^)]*\)/g, '') 
      .replace(/\[[^\]]*\]/g, '') 
      .replace(/^[\w\u0900-\u097F]+[:：]\s*/, '') 
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

    service.setOnBufferingChange((buffering) => {
      if (buffering) startBuffering();
      else stopBuffering();
    });

    setConnectingProgress(15);
    const fetchedLore = await service.fetchLore(advConfig);
    setLore(fetchedLore);
    setConnectingProgress(45);
    
    const customInstruction = `You are the host of an INVESTIGATIVE Podcast in ${advConfig.language}. 
    STYLE: Atmospheric, suspenseful, and rhythmic. Like a true crime documentary.

    CRITICAL PACING RULES:
    1. DO NOT RUSH: Build the scene. Describe the environment before dropping facts.
    2. THE HOOK: Start with a mystery, but don't solve it immediately.
    3. SCENE FOCUS: Each turn should focus on ONE specific element of the investigation.
    4. CONVERSATIONAL: Use pauses (represented by punctuation). Talk *to* the listener.
    5. NO SPEAKER LABELS: Start talking directly as the host.

    LORE MANIFEST:
    ${fetchedLore.manifest}

    TOPIC: "${advConfig.topic}". Unfold the mystery layer by layer.`;

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
        }
      },
      onTurnComplete: () => {
        if (secondsRemaining > 0) {
          service.sendTextChoice("Continue the investigation. Describe the next scene with high detail and build more suspense. Do not reach the end yet.");
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
    <div className={`h-screen bg-[#050512] text-violet-50 font-sans flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className="fas fa-arrow-left text-violet-400"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-violet-400">CAST: {truncateTopic(config.topic)}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2.5 h-2.5 rounded-full ${isOutputActive ? 'bg-violet-500 animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-violet-300">{config.language} • {config.genre}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleDownloadSession} disabled={isDownloading} title="Download Audio" className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-arrow-down-long'} text-sm text-violet-400`}></i>
          </button>
          
          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-white/5 shrink-0">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70 w-5">
              <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-low'} text-violet-400`}></i>
            </button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500" />
          </div>

          <button onClick={handleSaveDraft} className="px-5 py-2.5 rounded-full bg-white/10 border border-white/10 font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2">
            <i className="fas fa-save text-[10px]"></i> Save Draft
          </button>

          <button onClick={() => { setIsSummarizing(true); StoryScapeService.generateSummary(config.genre, transcriptions).then(s => { setSummary(s); setIsSummarizing(false); }); }} className="px-8 py-3 rounded-full bg-white text-black font-black text-xs uppercase tracking-widest shadow-2xl shrink-0 text-center">Finish</button>
          
          <button onClick={handleExitAndClear} title="Abort Show" className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center hover:bg-red-500/30 transition-all shrink-0">
            <i className="fas fa-stop text-sm"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-violet-500/10 z-10 bg-black/40">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {(connectingProgress < 100 || isBuffering || isDownloading) && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center gap-8 text-center px-12">
               <div className="relative">
                 <div className={`w-36 h-36 border-[6px] border-violet-900/20 ${isDownloading ? 'border-t-blue-400' : 'border-t-violet-500'} rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl text-violet-400">
                   {isDownloading ? '...' : (isBuffering ? bufferPercent : connectingProgress)}%
                 </div>
               </div>
               <div className="space-y-3">
                 <h3 className="text-xl font-black uppercase tracking-[0.3em] text-violet-400">
                   {isDownloading ? 'ARCHIVING BROADCAST...' : (connectingProgress < 100 ? 'ESTABLISHING LINK...' : 'GATHERING LORE...')}
                 </h3>
                 <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] max-w-xs mx-auto">
                   {isDownloading ? 'Directly encoding audio from neural cache.' : 'Live from the StoryScape Investigative Studio.'}
                 </p>
               </div>
            </div>
          )}
          
          {transcriptions.map((t, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-[92%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] bg-violet-950/20 border border-violet-500/10 rounded-tl-none shadow-xl">
                <p className="text-[9px] text-violet-500 opacity-60 mb-2 uppercase tracking-[0.4em] font-black flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span> INVESTIGATION IN PROGRESS
                </p>
                <p className="text-xl md:text-2xl leading-relaxed font-light text-violet-50/90 break-words hyphens-auto">{t.text}</p>
              </div>
            </div>
          ))}

          {currentModelText && (
            <div className="flex justify-start">
              <div className="max-w-[92%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] bg-violet-500/[0.02] border border-dashed border-violet-500/20 rounded-tl-none animate-pulse">
                <p className="text-xl md:text-2xl leading-relaxed italic text-violet-400/60 break-words hyphens-auto">{currentModelText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 glass border-t border-violet-500/10 flex flex-col gap-6 bg-black/60 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-4">
                 <div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-violet-500 shadow-[0_0_15px_#8b5cf6]' : 'bg-red-500'}`}></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 text-violet-300">{isOutputActive ? 'Transmitting' : 'On Standby'}</span>
              </div>
              <div className="h-8 w-px bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4">
                <i className="fas fa-stopwatch text-violet-400 text-xs"></i>
                <span className="text-sm font-black tracking-widest text-violet-400">{formatTime(secondsRemaining)} Remaining</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl shrink-0 ${isPaused ? 'bg-violet-600 text-white' : 'glass border-violet-500/20 hover:bg-violet-500/10'}`}>
                 <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
               </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-violet-950/40 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all duration-1000 shadow-[0_0_15px_#8b5cf6]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 15) * 60)) * 100}%` }}></div>
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
              <button onClick={onExit} className="px-16 py-8 rounded-[3rem] bg-white text-black font-black uppercase tracking-[0.4em] shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform active:scale-95 text-center">BACK TO STUDIO</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default PodcastView;