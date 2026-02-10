
// Add React import to fix 'Cannot find namespace React' error
import React, { useEffect, useState, useRef } from 'react';
import { AdventureConfig } from '../types';
import { StoryScapeService, SongData } from '../services/geminiLiveService';
import { audioBufferToWav, downloadOrShareAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

type VocalFX = 'Clean' | 'Reverb' | 'Echo' | 'Auto-Soul';

interface SingerViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const STAGE_AMBIENCE = 'https://assets.mixkit.co/sfx/preview/mixkit-audience-light-applause-354.mp3';

const VOCAL_FX_PROMPTS: Record<VocalFX, string> = {
  'Clean': 'Deliver a raw, soulful, and intimate performance.',
  'Reverb': 'Ethereal cathedral reverb. Let notes ring in a vast stone hall.',
  'Echo': 'Rhythmic phrase-end echoes echoing off distant canyon walls.',
  'Auto-Soul': 'High-fidelity autotune effect with robotic pitch-snapping.'
};

const SingerView: React.FC<SingerViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOutputActive, setIsOutputActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState((config.durationMinutes || 10) * 60);
  const [ambientVolume, setAmbientVolume] = useState(0.15);
  const [isMuted, setIsMuted] = useState(false);
  const [songData, setSongData] = useState<SongData | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [vocalFX, setVocalFX] = useState<VocalFX>('Clean');
  const [showLyrics, setShowLyrics] = useState(true);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // FIX: Guard to prevent FX change from triggering app exit
  const isChangingFX = useRef(false);

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
      setBufferPercent(p => (p >= 99 ? 99 : p + Math.floor(Math.random() * 8) + 2));
    }, 400);
  };

  const stopBuffering = () => {
    setIsBuffering(false);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
  };

  const initService = async (advConfig: AdventureConfig, currentFX: VocalFX) => {
    setConnectingProgress(10);
    isChangingFX.current = false; // Reset guard
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(30);
    const fetchedSong = await service.fetchSongData(advConfig);
    setSongData(fetchedSong);
    setConnectingProgress(70);

    const firstSegment = fetchedSong.segments[activeSegmentIndex] || fetchedSong.segments[0] || { label: 'Intro', text: 'Melodic hum' };

    const customInstruction = `
      You are a World-Class Musical Performer. 
      MODE: PURE A CAPPELLA SINGING. NO SPEAKING. NO INSTRUMENTS.
      
      SONG PERFORMANCE PROTOCOL (EXTREMELY STRICT):
      1. DO NOT DRAG: NEVER extend a single vowel or sound (like "Hoo", "Aaa") for more than 2 SECONDS.
      2. FAST PACE: Prioritize delivering the actual lyrics clearly. 
      3. NO AMBIENT LOOPING: Do not get stuck in wordless melodic patterns. 
      4. SING THE TEXT: Translate every segment directly into a soulful, rhythmic melodic performance.
      5. VOCAL FX: Use ${currentFX} processing logic: ${VOCAL_FX_PROMPTS[currentFX]}.
      6. NO TALKING: Start singing IMMEDIATELY.

      PERFORMANCE START: Sing [${firstSegment.label}] - "${firstSegment.text}".
    `;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        if (role === 'model') {
          if (isFinal) {
            setTranscriptions(prev => [...prev, { role: 'model', text: text.trim() }]);
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(text);
          }
        }
      },
      onTurnComplete: () => {
        if (secondsRemaining > 0 && !isPaused && fetchedSong.segments.length > 0) {
          setActiveSegmentIndex(prev => {
            const nextIndex = (prev + 1) % fetchedSong.segments.length;
            const nextSeg = fetchedSong.segments[nextIndex];
            // FORCE PROGRESSION prompt
            service.sendTextChoice(`STOP MELODY. SING LYRICS NOW: [${nextSeg.label}] "${nextSeg.text}". NO DRAGGING.`);
            return nextIndex;
          });
          startBuffering();
        }
      },
      onError: () => {
        startBuffering();
        setTimeout(() => initService(config, vocalFX), 3000);
      },
      onClose: () => {
        // Only trigger onExit if we are not purposely restarting for an FX change
        if (!isChangingFX.current) {
          onExit();
        }
      },
    }, transcriptions, undefined, customInstruction).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config, vocalFX);
    const audio = new Audio(STAGE_AMBIENCE);
    audio.loop = true;
    audio.volume = ambientVolume;
    audio.play().catch(() => {});
    ambientAudioRef.current = audio;

    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    };
  }, []);

  const handleFXChange = (fx: VocalFX) => {
    if (fx === vocalFX) return;
    isChangingFX.current = true; // Set guard
    setVocalFX(fx);
    if (serviceRef.current) {
        serviceRef.current.stopAdventure();
        initService(config, fx);
    }
  };

  useEffect(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.volume = isMuted ? 0 : ambientVolume;
  }, [ambientVolume, isMuted]);

  useEffect(() => {
    if (connectingProgress === 100 && !isPaused && secondsRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setSecondsRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [connectingProgress, isPaused, secondsRemaining]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  const handleDownload = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) return;
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
      await downloadOrShareAudio(wavBlob, `Studio_FX_Master_${vocalFX}_${(songData?.songTitle || config.topic).replace(/\s+/g, '_')}.wav`);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-[#0d0212] text-fuchsia-50 font-sans flex flex-col p-4 md:p-8 overflow-hidden relative">
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,${vocalFX === 'Auto-Soul' ? '#06b6d4' : vocalFX === 'Reverb' ? '#8b5cf6' : '#701a75'} 0%,transparent_70%)] pointer-events-none opacity-20 transition-colors duration-1000`}></div>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0 border-fuchsia-500/20">
            <i className="fas fa-arrow-left text-fuchsia-400"></i>
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-fuchsia-400 uppercase truncate max-w-[200px] md:max-w-md">
              {songData?.songTitle || config.topic}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isOutputActive ? 'bg-fuchsia-500 animate-pulse shadow-[0_0_10px_#d946ef]' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-fuchsia-300">
                {songData?.artist || 'Neural Artist'} • {vocalFX} MODE
              </p>
            </div>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-full border border-fuchsia-500/10 backdrop-blur-xl shrink-0">
            {(['Clean', 'Reverb', 'Echo', 'Auto-Soul'] as VocalFX[]).map(fx => (
                <button key={fx} onClick={() => handleFXChange(fx)} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${vocalFX === fx ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_#d946ef]' : 'text-white/30 hover:text-white/60'}`}>
                    {fx}
                </button>
            ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setShowLyrics(!showLyrics)} className={`w-12 h-12 rounded-full glass flex items-center justify-center transition-all shrink-0 ${showLyrics ? 'bg-fuchsia-500/40 border-fuchsia-400' : 'border-fuchsia-500/20'}`}>
            <i className="fas fa-music text-sm text-fuchsia-400"></i>
          </button>
          <button onClick={handleDownload} disabled={isDownloading} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0 border-fuchsia-500/20">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'} text-sm text-fuchsia-400`}></i>
          </button>
          <button onClick={onExit} className="px-8 py-3 rounded-full bg-fuchsia-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-fuchsia-50 transition-all shrink-0 text-center">EXIT</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full z-10">
        
        {showLyrics && songData && (
          <aside className="hidden lg:flex flex-col w-96 glass rounded-[3rem] border-fuchsia-500/10 bg-black/40 overflow-hidden animate-in slide-in-from-left duration-500 shadow-2xl">
            <div className="p-8 border-b border-fuchsia-500/10 bg-fuchsia-500/5 flex justify-between items-center">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">STUDIO SCRIPT</h3>
               <span className="text-[8px] font-bold text-fuchsia-500/40 uppercase tracking-widest">{songData.isOfficial ? 'SYNCHRONIZED' : 'COMPOSED'}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/10">
               {songData.segments.map((seg, idx) => (
                 <div key={idx} className={`space-y-2 transition-all duration-700 ${idx === activeSegmentIndex ? 'opacity-100 scale-100' : 'opacity-20 scale-95'}`}>
                   <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-widest">{seg.label}</p>
                   <p className="text-sm leading-relaxed whitespace-pre-wrap font-serif italic text-fuchsia-100">
                     {seg.text}
                   </p>
                 </div>
               ))}
            </div>
          </aside>
        )}

        <div className="flex-1 min-h-0 flex flex-col glass rounded-[3rem] overflow-hidden shadow-2xl border-fuchsia-500/10 bg-black/40 relative">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-8 md:p-12 space-y-12 scroll-smooth custom-scrollbar bg-black/20">
            {(connectingProgress < 100 || isBuffering) && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center gap-10 text-center px-12">
                 <div className="relative">
                   <div className={`w-48 h-48 border-[2px] border-fuchsia-900/10 ${vocalFX === 'Auto-Soul' ? 'border-t-cyan-500' : 'border-t-fuchsia-500'} rounded-full animate-spin`}></div>
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                     <span className="font-black text-5xl text-fuchsia-400">{isBuffering ? bufferPercent : connectingProgress}%</span>
                     <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-30 text-fuchsia-200">Neural Sync</span>
                   </div>
                 </div>
                 <h3 className="text-2xl font-black uppercase tracking-[0.5em] text-fuchsia-400">
                   {isBuffering ? 'APPLYING FX PROFILE' : 'INITIALIZING STUDIO'}
                 </h3>
              </div>
            )}

            {transcriptions.map((t, i) => (
              <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="max-w-[85%] p-10 rounded-[3.5rem] bg-fuchsia-950/10 border border-fuchsia-500/10 rounded-tl-none shadow-inner group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500/20 group-hover:bg-fuchsia-500 transition-all"></div>
                  <p className="text-[10px] text-fuchsia-500 opacity-60 mb-6 uppercase tracking-[0.5em] font-black flex items-center gap-3">
                    <i className="fas fa-compact-disc animate-spin-slow"></i> MELODIC SIGNAL
                  </p>
                  <p className="text-3xl md:text-5xl leading-snug font-light text-fuchsia-50/95 italic font-serif tracking-tight">"{t.text}"</p>
                </div>
              </div>
            ))}

            {currentModelText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-10 rounded-[3.5rem] bg-fuchsia-500/[0.01] border border-dashed border-fuchsia-500/20 rounded-tl-none animate-pulse">
                  <p className="text-3xl md:text-5xl leading-snug italic text-fuchsia-400/30 font-serif tracking-tight">"{currentModelText}"</p>
                </div>
              </div>
            )}
            <div className="h-24"></div>
          </div>

          <div className="p-8 md:p-12 glass border-t border-fuchsia-500/10 flex flex-col gap-8 bg-black/60 shrink-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-16">
                <div className="flex items-center gap-4">
                   <div className={`w-4 h-4 rounded-full ${isOutputActive ? 'bg-fuchsia-500 shadow-[0_0_20px_#d946ef]' : 'bg-red-500'}`}></div>
                   <div className="flex flex-col">
                     <span className="text-[10px] uppercase tracking-[0.2em] font-black text-fuchsia-300">MASTER VOCAL</span>
                     <span className="text-[8px] opacity-40 uppercase font-bold">{isOutputActive ? 'Capturing High-Fidelity Harmony' : 'Awaiting Next Line'}</span>
                   </div>
                </div>
                <div className="h-10 w-px bg-white/5 hidden md:block"></div>
                <div className="flex items-center gap-4">
                  <i className="fas fa-clock text-fuchsia-400 text-xs opacity-50"></i>
                  <span className="text-sm font-black tracking-widest text-fuchsia-400">{formatTime(secondsRemaining)} REEL LEFT</span>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                 <button onClick={togglePause} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl shrink-0 group ${isPaused ? 'bg-fuchsia-600 text-white shadow-[0_0_30px_#701a75]' : 'glass border-fuchsia-500/20 hover:bg-fuchsia-500/10'}`}>
                   <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-xl group-hover:scale-110 transition-transform`}></i>
                 </button>
              </div>
            </div>
            <div className="w-full h-2 bg-fuchsia-950/40 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
              <div className={`h-full ${vocalFX === 'Auto-Soul' ? 'bg-cyan-500 shadow-[0_0_20px_#06b6d4]' : 'bg-fuchsia-500 shadow-[0_0_20px_#d946ef]'} transition-all duration-1000 rounded-full`} style={{ width: `${(secondsRemaining / ((config.durationMinutes || 10) * 60)) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(217, 70, 239, 0.2); border-radius: 10px; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      ` }} />
    </div>
  );
};

export default SingerView;
