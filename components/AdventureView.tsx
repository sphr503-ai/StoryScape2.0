import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav, downloadOrShareAudio } from '../utils/audioUtils';
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

const AMBIENT_SOUNDS: Record<Genre, string> = {
  [Genre.FANTASY]: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-at-night-with-crickets-1224.mp3',
  [Genre.SCIFI]: 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-wind-vibe-1204.mp3',
  [Genre.MYSTERY]: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  [Genre.HORROR]: 'https://assets.mixkit.co/sfx/preview/mixkit-horror-atmosphere-drone-953.mp3',
  [Genre.THRILLER]: 'https://assets.mixkit.co/sfx/preview/mixkit-suspense-movie-trailer-ambience-2537.mp3',
  [Genre.DOCUMENTARY]: 'https://assets.mixkit.co/sfx/preview/mixkit-pensive-ambient-piano-loop-2384.mp3',
  [Genre.EDUCATION]: 'https://assets.mixkit.co/sfx/preview/mixkit-library-room-ambience-with-distant-chatter-2517.mp3',
};

const AdventureView: React.FC<AdventureViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.map(h => ({
      ...h,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))
  );
  
  const [currentNarratorText, setCurrentNarratorText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('text'); 
  const [isPaused, setIsPaused] = useState(false);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);

  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  const serviceRef = useRef<StoryScapeService | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bufferIntervalRef = useRef<number | null>(null);

  const narratorAccumulator = useRef<string>('');
  const userAccumulator = useRef<string>('');

  const cleanText = (text: string): string => {
    return text
      .replace(/\([^)]*\)/g, '') 
      .replace(/\[[^\]]*\]/g, '') 
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
      if (cleanPrev.slice(-len) === cleanNext.slice(0, len)) {
        return cleanPrev + cleanNext.slice(len);
      }
    }
    const needsSpace = !prev.endsWith(' ') && !next.startsWith(' ') && !/^[।.,!?]/.test(cleanNext);
    return prev + (needsSpace ? ' ' : '') + next;
  };

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

  useEffect(() => {
    let anim: number;
    const checkSignal = () => {
      if (analysers.out) {
        const data = new Uint8Array(analysers.out.frequencyBinCount);
        analysers.out.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        const isActive = volume > 3;
        setIsNarrating(isActive);
        if (isActive && isBuffering) stopBuffering();
      }
      if (analysers.in) {
        const data = new Uint8Array(analysers.in.frequencyBinCount);
        analysers.in.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsUserSpeaking(volume > 3);
      }
      anim = requestAnimationFrame(checkSignal);
    };
    checkSignal();
    return () => cancelAnimationFrame(anim);
  }, [analysers, isBuffering]);

  const initService = async (advConfig: AdventureConfig) => {
    setError(null);
    setConnectingProgress(10);
    const service = new StoryScapeService();
    serviceRef.current = service;

    try {
      setConnectingProgress(30);
      const fetchedLore = await service.fetchLore(advConfig);
      setLore(fetchedLore);
      setConnectingProgress(70);

      const systemInstruction = `
        You are the Master Narrator for an immersive ${advConfig.genre} adventure titled "${advConfig.topic}".
        STYLE: Cinematic, vivid, and responsive. Language: ${advConfig.language}.
        LORE Grounding: ${fetchedLore.manifest}
        INSTRUCTION: Keep each turn short but descriptive (2-4 sentences). Always prompt the user for their choice or action.
      `;

      await service.startAdventure(advConfig, {
        onTranscriptionUpdate: (role, text, isFinal) => {
          if (!text && !isFinal) return;
          const processedText = cleanText(text);
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (role === 'model') {
            // Commit any active user transcription when model starts responding
            if (userAccumulator.current.trim()) {
               const finalUserText = userAccumulator.current.trim();
               setMessages(prev => {
                  const alreadyPresent = prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].text === finalUserText;
                  if (alreadyPresent) return prev;
                  return [...prev, { role: 'user', text: finalUserText, timestamp }];
               });
               userAccumulator.current = '';
               setCurrentUserText('');
            }

            narratorAccumulator.current = smartAppend(narratorAccumulator.current, processedText);
            setCurrentNarratorText(narratorAccumulator.current);

            if (isFinal) {
              const finalNarratorText = narratorAccumulator.current.trim();
              if (finalNarratorText) {
                setMessages(prev => {
                  const alreadyPresent = prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === finalNarratorText;
                  if (alreadyPresent) return prev;
                  return [...prev, { role: 'model', text: finalNarratorText, timestamp }];
                });
                setCurrentNarratorText('');
                narratorAccumulator.current = '';
                stopBuffering();
              }
            }
          } else {
            userAccumulator.current = smartAppend(userAccumulator.current, processedText);
            setCurrentUserText(userAccumulator.current);

            if (isFinal) {
              const finalUserText = userAccumulator.current.trim();
              if (finalUserText) {
                setMessages(prev => {
                  const alreadyPresent = prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].text === finalUserText;
                  if (alreadyPresent) return prev;
                  return [...prev, { role: 'user', text: finalUserText, timestamp }];
                });
                setCurrentUserText('');
                userAccumulator.current = '';
              }
            }
          }
        },
        onTurnComplete: () => {
          stopBuffering();
          const finalNarratorText = narratorAccumulator.current.trim();
          if (finalNarratorText) {
             const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             setMessages(prev => {
                const alreadyPresent = prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === finalNarratorText;
                if (alreadyPresent) return prev;
                return [...prev, { role: 'model', text: finalNarratorText, timestamp: ts }];
             });
             setCurrentNarratorText('');
             narratorAccumulator.current = '';
          }
        },
        onError: (err) => {
          console.error("Neural Link Failure:", err);
          setError(err.message || "Unknown Network Error");
        },
        onClose: () => onExit(),
      }, messages.map(m => ({ role: m.role, text: m.text })), fetchedLore, systemInstruction);

      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    } catch (err: any) {
      setError(err.message || "Failed to establish link.");
    }
  };

  useEffect(() => {
    initService(config);
    const audio = new Audio(AMBIENT_SOUNDS[config.genre]);
    audio.loop = true;
    audio.volume = ambientVolume;
    audio.play().catch(e => console.warn("Ambient audio requires gesture", e));
    ambientAudioRef.current = audio;

    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.volume = isMuted ? 0 : ambientVolume;
  }, [ambientVolume, isMuted]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, currentNarratorText, currentUserText]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !serviceRef.current || isPaused) return;
    const msg = textInput.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextInput('');
    startBuffering();
  };

  const handleMicToggle = async () => {
    const isActivating = inputMode !== 'mic';
    if (!isActivating) {
      setInputMode('text');
      if (serviceRef.current) await serviceRef.current.setMicActive(false);
      return;
    }
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(true);
        setInputMode('mic');
      } catch (err: any) {
        alert("Microphone Error: " + (err.message || "Permission denied"));
        setInputMode('text');
      }
    }
  };

  const handleDownload = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("No audio recorded.");
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
      await downloadOrShareAudio(wavBlob, `Saga_${config.topic.replace(/\s+/g, '_')}.wav`);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (serviceRef.current) serviceRef.current.setPaused(next);
    if (ambientAudioRef.current) {
      if (next) ambientAudioRef.current.pause();
      else if (!isMuted) ambientAudioRef.current.play();
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0c] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Visualizer Layer */}
      <div className="absolute inset-0 z-0 opacity-40">
        <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />
      </div>

      {/* Modern Compact Header */}
      <header className="z-50 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
            <i className="fas fa-chevron-left text-white/40"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">{config.topic}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isNarrating ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`}></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{config.genre} • {config.language}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={isDownloading} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 transition-all border border-white/5">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-arrow-down-long'}`}></i>
          </button>
          <button onClick={togglePause} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-green-600 text-white' : 'hover:bg-white/5 text-white/60 border border-white/5'}`}>
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>
          <button onClick={onExit} className="w-9 h-9 rounded-full hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-all border border-white/5">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 min-h-0 relative z-10 flex flex-col">
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 custom-scrollbar scroll-smooth"
        >
          {/* Connection Overlay */}
          {(connectingProgress < 100 || error) && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-6 p-12">
               {!error ? (
                 <>
                   <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40">Syncing Saga Protocols...</p>
                 </>
               ) : (
                 <div className="text-center space-y-4">
                   <i className="fas fa-triangle-exclamation text-3xl text-red-500 mb-2"></i>
                   <h3 className="text-sm font-bold uppercase">Neural Link Error</h3>
                   <p className="text-white/40 text-[10px] max-w-xs">{error}</p>
                   <button onClick={() => initService(config)} className="px-6 py-2 rounded-full bg-white text-black text-[10px] font-black uppercase">Reconnect</button>
                 </div>
               )}
            </div>
          )}

          {/* Chat Bubbles */}
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {/* Avatar Indicator */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                m.role === 'user' ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                {m.role === 'user' ? 'W' : 'M'}
              </div>

              <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 rounded-2xl text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-lg' 
                    : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-none shadow-xl'
                }`}>
                  {m.text}
                </div>
                <span className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-1.5 px-1">{m.timestamp}</span>
              </div>
            </div>
          ))}

          {/* Streaming Bubbles */}
          {(currentNarratorText || currentUserText) && (
            <div className={`flex items-end gap-3 ${currentUserText ? 'flex-row-reverse' : 'flex-row'} animate-pulse`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                currentUserText ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400/50' : 'bg-white/5 border-white/10 text-white/20'
              }`}>
                {currentUserText ? '...' : '...'}
              </div>
              <div className={`max-w-[75%] md:max-w-[60%] px-5 py-4 rounded-2xl text-sm md:text-base italic ${
                currentUserText ? 'bg-indigo-900/10 text-indigo-400/60 rounded-br-none' : 'bg-white/[0.02] border border-dashed border-white/10 text-white/30 rounded-bl-none'
              }`}>
                {currentUserText || currentNarratorText}
              </div>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !currentNarratorText && (
            <div className="flex flex-col items-center py-4 gap-2 opacity-30 animate-pulse">
               <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
               </div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em]">Mastering Turn... {bufferPercent}%</span>
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 md:p-8 bg-black/60 border-t border-white/5 backdrop-blur-2xl shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
             <button 
                onClick={handleMicToggle}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  inputMode === 'mic' 
                    ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse' 
                    : 'bg-white/5 hover:bg-white/10 border border-white/5 text-white/40'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>

              <div className="flex-1 flex items-center gap-3 relative">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                       <input 
                         type="text" 
                         value={textInput} 
                         onChange={(e) => setTextInput(e.target.value)}
                         placeholder={isPaused ? "Saga Halted" : "Type your action..."}
                         disabled={isPaused}
                         className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 md:py-4 outline-none focus:border-white/30 transition-all text-sm md:text-base font-light placeholder:opacity-20"
                       />
                       <button 
                         type="submit" 
                         disabled={!textInput.trim() || isPaused}
                         className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-20 transition-all shrink-0"
                       >
                          <i className="fas fa-paper-plane text-sm md:text-base"></i>
                       </button>
                    </form>
                 ) : (
                    <div className="flex-1 h-12 md:h-14 rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center px-6">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
                          {isUserSpeaking ? "Recording Neural Pulse..." : "Listening..."}
                       </span>
                    </div>
                 )}
              </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      ` }} />
    </div>
  );
};

export default AdventureView;