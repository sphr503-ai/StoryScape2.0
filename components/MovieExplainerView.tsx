
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, NarratorMode } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav, downloadOrShareAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface MovieExplainerViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const MovieExplainerView: React.FC<MovieExplainerViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [ambientVolume, setAmbientVolume] = useState(0.12);
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const [secondsRemaining, setSecondsRemaining] = useState((config.durationMinutes || 25) * 60);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isOutputActive, setIsOutputActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('Initializing Decoder');
  
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

  const handleDownloadSession = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("No audio archived.");
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
      await downloadOrShareAudio(wavBlob, `CineRecap_${config.topic.replace(/\s+/g, '_')}.wav`);
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
    setCurrentPhase(advConfig.isOriginalScript ? 'Neural Script Synthesis' : 'Searching Official Data');
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    
    let movieLore: LoreData;
    if (advConfig.isOriginalScript) {
       movieLore = {
         manifest: `TITLE: ${advConfig.topic}. 
         Genre: ${advConfig.genre}. Language: ${advConfig.language}.
         INSTRUCTION: Create a deep, scene-by-scene script. No rushing. Describe characters and visuals.`,
         sources: []
       };
    } else {
       movieLore = await service.fetchLore({ 
         ...advConfig, 
         topic: advConfig.topic 
       });
    }
    
    setLore(movieLore);
    setConnectingProgress(45);
    setCurrentPhase('Verifying Cinema Archive');
    
    const movieYear = movieLore.verifiedMetadata?.year || "Unknown Year";

    const customInstruction = `You are a Professional Movie Recapper in ${advConfig.language}. 
    STYLE: Inspired by high-performing YouTube channels like "Movie Explain Universe" and "Mr. Hindi Rockers".

    THE ALGORITHM:
    1. THE HOOK: "Dosto, kya aapne kabhi socha tha..." Start with the core conflict.
    2. SCENE-BY-SCENE: Focus on ONE scene at a time. Describe the lighting, the actor's expression, and the tension.
    3. THE LOGIC: Explain *why* a character did something. Don't just list events.
    4. NO BULLET TRAIN: Slow down. Do not summarize the whole movie in 2 minutes. We want a detailed 20-minute breakdown.
    5. ENGAGEMENT: Address the audience as "Dosto". Use cinematic vocabulary.

    LORE MANIFEST:
    ${movieLore.manifest}

    OPENING:
    "Ye ek [Genre] movie hai sun ${movieYear} ki. Naam hai ${advConfig.topic}. Dosto, scene ki shuruat mein hum dekhte hain..."
    `;

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
          service.sendTextChoice("Continue the recap. Describe the next intense scene with full detail. Focus on character motivations. Do not rush to the ending yet.");
          startBuffering();
        }
      },
      onError: () => {
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => onExit(),
    }, transcriptions, movieLore, customInstruction).then(() => {
      setConnectingProgress(100);
      setCurrentPhase('Recap Connection Established');
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3');
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
    <div className={`h-screen bg-[#020d0a] text-emerald-50 font-sans flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative`}>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className="fas fa-arrow-left text-emerald-400"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400 leading-none uppercase">
              {config.isOriginalScript ? 'DESIRE-DECODER' : 'RECAPPER'}: {config.topic}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${isOutputActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-emerald-300">
                {config.language} • {lore?.verifiedMetadata?.year || config.genre} {config.isOriginalScript ? '• UNRESTRICTED' : '• VERIFIED MOVIE'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleDownloadSession} disabled={isDownloading} title="Export Recap" className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-sm text-emerald-400`}></i>
          </button>
          
          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-emerald-500/10 shrink-0">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70 w-5">
              <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-low'} text-emerald-400`}></i>
            </button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-emerald-900/40 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>

          <button onClick={handleSaveDraft} className="px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/10 font-black text-xs uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2">
            <i className="fas fa-save text-[10px]"></i> Save Draft
          </button>

          <button onClick={() => { setIsSummarizing(true); StoryScapeService.generateSummary(config.genre, transcriptions).then(s => { setSummary(s); setIsSummarizing(false); }); }} className="px-8 py-3 rounded-full bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-emerald-500 transition-all shrink-0 text-center">End Session</button>
          
          <button onClick={handleExitAndClear} title="Exit" className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center hover:bg-red-500/30 transition-all shrink-0">
            <i className="fas fa-stop text-sm"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-emerald-500/10 z-10 bg-black/40">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {(connectingProgress < 100 || isBuffering || isDownloading) && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center gap-8 text-center px-12">
               <div className="relative">
                 <div className={`w-36 h-36 border-[6px] border-emerald-900/20 ${isDownloading ? 'border-t-blue-400' : 'border-t-emerald-500'} rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl text-emerald-400">
                   {isDownloading ? downloadProgress : (isBuffering ? bufferPercent : connectingProgress)}%
                 </div>
               </div>
               <div className="space-y-3">
                 <h3 className="text-xl font-black uppercase tracking-[0.3em] text-emerald-400">
                   {isDownloading ? 'ARCHIVING RECAP...' : currentPhase.toUpperCase()}
                 </h3>
                 <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] max-w-xs mx-auto">
                   {isDownloading ? 'Finalizing the decoded analysis for local storage.' : (config.isOriginalScript ? 'Crafting your unrestricted cinema dream...' : 'Verifying film facts to prevent plot hallucinations...')}
                 </p>
               </div>
            </div>
          )}
          
          {transcriptions.map((t, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-[92%] p-6 md:p-8 rounded-[2.5rem] bg-emerald-950/20 border border-emerald-500/10 rounded-tl-none shadow-xl">
                <p className="text-[9px] text-emerald-500 opacity-60 mb-2 uppercase tracking-[0.4em] font-black flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> CINEMATIC DECODING
                </p>
                <p className="text-xl md:text-2xl leading-relaxed font-light text-emerald-50/90 break-words hyphens-auto">{t.text}</p>
              </div>
            </div>
          ))}

          {currentModelText && (
            <div className="flex justify-start">
              <div className="max-w-[92%] p-6 md:p-8 rounded-[2.5rem] bg-emerald-500/[0.02] border border-dashed border-emerald-500/20 rounded-tl-none animate-pulse">
                <p className="text-xl md:text-2xl leading-relaxed italic text-emerald-400/60 break-words hyphens-auto">{currentModelText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 glass border-t border-emerald-500/10 flex flex-col gap-6 bg-black/60 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-4">
                 <div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500'}`}></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 text-emerald-300">{isOutputActive ? 'Narrating' : 'Syncing'}</span>
              </div>
              <div className="h-8 w-px bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4">
                <i className="fas fa-stopwatch text-emerald-400 text-xs"></i>
                <span className="text-sm font-black tracking-widest text-emerald-400">{formatTime(secondsRemaining)} Remaining</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl shrink-0 ${isPaused ? 'bg-emerald-600 text-white' : 'glass border-emerald-500/20 hover:bg-emerald-500/10'}`}>
                 <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
               </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-emerald-950/40 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_#10b981]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 25) * 60)) * 100}%` }}></div>
          </div>
        </div>
      </main>

      {summary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl overflow-y-auto">
          <div className="max-w-5xl w-full my-auto space-y-16 py-20 animate-in fade-in slide-in-from-bottom-12">
            <div className="text-center space-y-6">
              <p className="text-emerald-500 uppercase tracking-[1.2em] text-[10px] font-black">Recap Conclusion</p>
              <h2 className="text-8xl md:text-[10rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-emerald-400 to-emerald-900 uppercase leading-none">THE END</h2>
            </div>
            <div className="glass p-16 rounded-[5rem] border-emerald-500/20 bg-violet-950/5 relative shadow-2xl">
              <i className="fas fa-quote-left absolute top-12 left-12 text-emerald-500/10 text-8xl"></i>
              <p className="text-3xl md:text-4xl font-light italic text-center leading-relaxed text-violet-100/90 font-serif">"{summary}"</p>
            </div>
            <div className="flex justify-center pt-10">
              <button onClick={onExit} className="px-16 py-8 rounded-[3rem] bg-white text-black font-black uppercase tracking-[0.4em] shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform active:scale-95 text-center">BACK TO HUB</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default MovieExplainerView;
