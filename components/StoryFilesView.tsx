
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, NarratorMode } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav, downloadOrShareAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface StoryFilesViewProps {
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
  // Fix: Ensure exhaustive mapping for the Record after adding Genre.EDUCATION
  [Genre.EDUCATION]: 'https://assets.mixkit.co/sfx/preview/mixkit-library-room-ambience-with-distant-chatter-2517.mp3',
};

const StoryFilesView: React.FC<StoryFilesViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [ambientVolume, setAmbientVolume] = useState(0.25);
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

  const handleDownloadSession = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("The chronicle audio hasn't been archived yet.");
      return;
    }
    setIsDownloading(true);
    try {
      const buffers = serviceRef.current.recordedBuffers;
      const sampleRate = buffers[0].sampleRate;
      let totalLength = 0;
      buffers.forEach(b => totalLength += b.length);
      const offlineCtx = new OfflineAudioContext(1, totalLength, sampleRate);
      let offset = 0;
      buffers.forEach(buffer => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start(offset);
        offset += buffer.duration;
      });
      const finalBuffer = await offlineCtx.startRendering();
      const wavBlob = await audioBufferToWav(finalBuffer);
      await downloadOrShareAudio(wavBlob, `Archived_Saga_${config.topic.replace(/\s+/g, '_')}.wav`);
    } catch (err) {
      alert("Failed to compile audio.");
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

  useEffect(() => {
    if (connectingProgress === 100 && !isPaused && secondsRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setSecondsRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [connectingProgress, isPaused, secondsRemaining]);

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(5);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    const fetchedLore = await service.fetchLore(advConfig);
    setLore(fetchedLore);
    setConnectingProgress(45);
    
    const customInstruction = `You are a Celestial Chronicler for Deep Sleep stories in ${advConfig.language}. 
    STYLE: Rhythmic, sensory, and slow. Like liquid gold pouring over silk.

    RULES FOR SLEEP NARRATION:
    1. VIVID SENSORY DETAIL: Focus on the sounds, smells, and textures of the environment.
    2. RHYTHMIC FLOW: Use longer, flowing sentences. No abrupt changes.
    3. NO RUSHING: Each turn should describe a small, peaceful moment. Do not finish the story in one go.
    4. NO QUESTIONS: Do not ask the listener anything. Just keep narrating.
    5. FLOW: Ensure each segment leads naturally into the next ambient detail.

    LORE MANIFEST:
    ${fetchedLore.manifest}

    TALE: A ${advConfig.genre} journey through "${advConfig.topic}".`;

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
          service.sendTextChoice("Continue the peaceful, rhythmic narration. Describe the surroundings in even more detail. Stay slow and soothing.");
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
    <div className={`h-screen bg-gradient-to-b ${config.genre === Genre.FANTASY ? 'from-emerald-950/40' : config.genre === Genre.SCIFI ? 'from-indigo-950/40' : 'from-slate-900'} to-black flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div><h1 className="text-2xl font-bold tracking-tight">{config.genre}: {config.topic}</h1><div className="flex items-center gap-2 mt-0.5"><div className={`w-2.5 h-2.5 rounded-full ${isOutputActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div><p className="text-[10px] opacity-60 uppercase tracking-widest font-black">{config.language} • {config.voice}</p></div></div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleDownloadSession} disabled={isDownloading} className="w-12 h-12 rounded-full glass border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-sm`}></i>
          </button>
          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-white/5 shrink-0">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70 w-5"><i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-low'}`}></i></button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white" />
          </div>
          <button onClick={handleSaveDraft} className="px-5 py-2.5 rounded-full bg-white/10 border border-white/10 font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2">
            <i className="fas fa-save text-[10px]"></i> Save Draft
          </button>
          <button onClick={() => { setIsSummarizing(true); StoryScapeService.generateSummary(config.genre, transcriptions).then(s => { setSummary(s); setIsSummarizing(false); }); }} className="px-6 py-2.5 rounded-full bg-white text-black font-black text-xs uppercase tracking-widest shrink-0 text-center">Finish</button>
          <button onClick={handleExitAndClear} className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center transition-all shrink-0"><i className="fas fa-stop"></i></button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[2.5rem] overflow-hidden shadow-2xl relative border-white/10 z-10 bg-black/20">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          {(connectingProgress < 100 || isBuffering || isDownloading) && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-6 text-center px-12">
               <div className="relative">
                 <div className={`w-32 h-32 border-[6px] border-white/5 ${isDownloading ? 'border-t-blue-400' : 'border-t-white'} rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">
                   {isDownloading ? downloadProgress : isBuffering ? bufferPercent : connectingProgress}%
                 </div>
               </div>
               <p className="text-xs font-black uppercase tracking-widest opacity-60">
                 {isDownloading ? 'Compiling Audio Archive...' : connectingProgress < 50 ? 'Mining Lore Archives...' : isBuffering ? 'Retrieving next chapter...' : 'Establishing Link...'}
               </p>
            </div>
          )}
          {transcriptions.map((t, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-[90%] p-6 rounded-[2rem] bg-black/40 border border-white/5 rounded-tl-none">
                <p className="text-[10px] opacity-40 mb-2 uppercase tracking-widest font-black">The Narrator</p>
                <p className="text-lg md:text-xl leading-relaxed font-light break-words hyphens-auto">{t.text}</p>
              </div>
            </div>
          ))}
          {currentModelText && (
            <div className="flex justify-start">
              <div className="max-w-[90%] p-6 rounded-[2rem] bg-black/30 rounded-tl-none animate-pulse">
                <p className="text-lg md:text-xl leading-relaxed italic opacity-70 break-words hyphens-auto">{currentModelText}</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-6 md:p-8 glass border-t border-white/5 flex flex-col gap-4 bg-black/40 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4"><div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div><span className="text-xs uppercase tracking-widest font-black opacity-80">{isOutputActive ? 'Active' : 'Buffering'}</span></div>
              <div className="h-8 w-px bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4"><i className="fas fa-stopwatch text-indigo-400 text-xs"></i><span className="text-xs uppercase tracking-widest font-black opacity-80 text-indigo-400">{formatTime(secondsRemaining)} Remaining</span></div>
            </div>
            <button onClick={togglePause} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${isPaused ? 'bg-green-500 text-white' : 'glass border-white/10 hover:bg-white/10'}`}><i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i></button>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 15) * 60)) * 100}%` }}></div></div>
        </div>
      </main>
    </div>
  );
};

export default StoryFilesView;
