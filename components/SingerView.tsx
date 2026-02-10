
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig } from '../types';
import { StoryScapeService, SongData } from '../services/geminiLiveService';
import { audioBufferToWav, downloadOrShareAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface SingerViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const STAGE_AMBIENCE = 'https://assets.mixkit.co/sfx/preview/mixkit-audience-light-applause-354.mp3';

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
  const [showLyrics, setShowLyrics] = useState(false);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(30);
    const fetchedSong = await service.fetchSongData(advConfig);
    setSongData(fetchedSong);
    setConnectingProgress(70);

    const customInstruction = `
      You are a Professional Vocal Synth specialized in PURE MUSICAL PERFORMANCE in ${advConfig.language}.
      
      SONG DATA:
      Topic/Detected Name: "${fetchedSong.songTitle}"
      Artist: "${fetchedSong.artist}"
      Script/Lyrics: ${fetchedSong.lyrics}
      Style Notes: ${fetchedSong.compositionNotes}

      VOCAL PERFORMANCE PROTOCOL (SONG-ONLY MODE):
      1. ABSOLUTELY NO TALKING: Proceed directly and exclusively to singing. Do not greet, do not explain, do not say "Thank you". 
      2. EMOTIONAL INTENSITY: Deliver the lyrics with extreme soulful depth, inspired by Arijit Singh's breathy and vulnerable tone.
      3. MUSICALITY: Use your voice to convey the melody. Use Aalaps (Ooo/Aaa), Harkats, and Meends (melodic glides). 
      4. SCRIPT LOYALTY: If "${fetchedSong.songTitle}" is a real song, sing the OFFICIAL SCRIPT provided. If original, perform the generated script with a rhythmic flow.
      5. BREATH AS INSTRUMENT: Let the listener hear the subtle breaths and emotional thahrav (pauses) between melodic phrases.
      6. MULTI-TURN PERFORMANCE: If you reach the end of a segment, wait for the next cue and resume singing the next verse. Do not stop until the song is complete.

      Perform the first segment of the song NOW. Start with a soulful intro hum.
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
        if (secondsRemaining > 0) {
          service.sendTextChoice("Resume singing the next segment of the song. Maintain the same soulful, breathy melody. No talking.");
          startBuffering();
        }
      },
      onError: () => {
        startBuffering();
        setTimeout(() => initService(config), 3000);
      },
      onClose: () => onExit(),
    }, transcriptions, undefined, customInstruction).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
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

  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = isMuted ? 0 : ambientVolume;
    }
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
      await downloadOrShareAudio(wavBlob, `Song_Performance_${(songData?.songTitle || config.topic).replace(/\s+/g, '_')}.wav`);
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#701a75_0%,transparent_70%)] pointer-events-none opacity-20"></div>
      <Visualizer inputAnalyser={null} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0 border-fuchsia-500/20">
            <i className="fas fa-arrow-left text-fuchsia-400"></i>
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-fuchsia-400 uppercase">
              {songData?.isOfficial ? 'COVER:' : 'ORIGINAL:'} {songData?.songTitle || config.topic}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isOutputActive ? 'bg-fuchsia-500 animate-pulse shadow-[0_0_10px_#d946ef]' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-fuchsia-300">
                {songData?.artist} • {config.language} {songData?.isOfficial && '• OFFICIAL_SCRIPT_IMPORTED'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowLyrics(!showLyrics)} 
            className={`w-12 h-12 rounded-full glass flex items-center justify-center transition-all shrink-0 ${showLyrics ? 'bg-fuchsia-500/40 border-fuchsia-400' : 'border-fuchsia-500/20'}`}
            title="Toggle Lyrical Script"
          >
            <i className="fas fa-file-lines text-sm text-fuchsia-400"></i>
          </button>

          <button onClick={handleDownload} disabled={isDownloading} title="Download Recording" className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0 border-fuchsia-500/20">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-sm text-fuchsia-400`}></i>
          </button>

          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-fuchsia-500/10 shrink-0">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70 w-5">
              <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-low'} text-fuchsia-400`}></i>
            </button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
          </div>

          <button onClick={onExit} className="px-8 py-3 rounded-full bg-fuchsia-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-fuchsia-500 transition-all shrink-0 text-center">EXIT SESSION</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full z-10">
        
        {/* LYRICS SIDEBAR */}
        {showLyrics && songData && (
          <aside className="hidden lg:flex flex-col w-80 glass rounded-[3rem] border-fuchsia-500/10 bg-black/40 overflow-hidden animate-in slide-in-from-left duration-500">
            <div className="p-6 border-b border-fuchsia-500/10 bg-fuchsia-500/5">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">Lyrical Script</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
               <p className="text-sm leading-relaxed whitespace-pre-wrap font-serif italic text-fuchsia-100/60">
                 {songData.lyrics}
               </p>
            </div>
          </aside>
        )}

        {/* PERFORMANCE VIEW */}
        <div className="flex-1 min-h-0 flex flex-col glass rounded-[3rem] overflow-hidden shadow-2xl border-fuchsia-500/10 bg-black/40 relative">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-8 md:p-12 space-y-8 scroll-smooth custom-scrollbar bg-black/20">
            {(connectingProgress < 100 || isBuffering) && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center gap-8 text-center px-12">
                 <div className="relative">
                   <div className="w-40 h-40 border-[4px] border-fuchsia-900/20 border-t-fuchsia-500 rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center font-black text-4xl text-fuchsia-400">
                     {isBuffering ? bufferPercent : connectingProgress}%
                   </div>
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase tracking-[0.4em] text-fuchsia-400">
                     {songData?.isOfficial ? 'IMPORTING SCRIPT...' : 'GENERATING SCORE...'}
                   </h3>
                   <p className="text-[10px] opacity-40 uppercase tracking-[0.2em]">Preparing high-fidelity soulful vocal synthesis.</p>
                 </div>
              </div>
            )}

            {transcriptions.map((t, i) => (
              <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="max-w-[85%] p-8 rounded-[3rem] bg-fuchsia-950/10 border border-fuchsia-500/10 rounded-tl-none shadow-inner">
                  <p className="text-[10px] text-fuchsia-500 opacity-60 mb-4 uppercase tracking-[0.5em] font-black flex items-center gap-2">
                    <i className="fas fa-music animate-bounce"></i> PERFORMANCE STREAM
                  </p>
                  <p className="text-2xl md:text-3xl leading-snug font-light text-fuchsia-50/90 italic font-serif">"{t.text}"</p>
                </div>
              </div>
            ))}

            {currentModelText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-8 rounded-[3rem] bg-fuchsia-500/[0.02] border border-dashed border-fuchsia-500/20 rounded-tl-none animate-pulse">
                  <p className="text-2xl md:text-3xl leading-snug italic text-fuchsia-400/40 font-serif">"{currentModelText}"</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 md:p-10 glass border-t border-fuchsia-500/10 flex flex-col gap-6 bg-black/60 shrink-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-12">
                <div className="flex items-center gap-4">
                   <div className={`w-3.5 h-3.5 rounded-full ${isOutputActive ? 'bg-fuchsia-500 shadow-[0_0_15px_#d946ef]' : 'bg-red-500'}`}></div>
                   <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 text-fuchsia-300">{isOutputActive ? 'Vocal Engine Running' : 'Syncing Melody'}</span>
                </div>
                <div className="h-8 w-px bg-white/10 hidden md:block"></div>
                <div className="flex items-center gap-4">
                  <i className="fas fa-stopwatch text-fuchsia-400 text-xs"></i>
                  <span className="text-sm font-black tracking-widest text-fuchsia-400">{formatTime(secondsRemaining)} Remaining</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                 <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl shrink-0 ${isPaused ? 'bg-fuchsia-600 text-white' : 'glass border-fuchsia-500/20 hover:bg-fuchsia-500/10'}`}>
                   <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                 </button>
              </div>
            </div>
            <div className="w-full h-1.5 bg-fuchsia-950/40 rounded-full overflow-hidden">
              <div className="h-full bg-fuchsia-500 transition-all duration-1000 shadow-[0_0_15px_#d946ef]" style={{ width: `${(secondsRemaining / ((config.durationMinutes || 10) * 60)) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(217, 70, 239, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default SingerView;
