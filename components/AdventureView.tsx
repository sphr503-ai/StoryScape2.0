
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, LoreData } from '../types';
import { StoryScapeService } from '../services/geminiLiveService';
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
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('mic');
  const [isPaused, setIsPaused] = useState(false);
  const [lore, setLore] = useState<LoreData | null>(null);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  const serviceRef = useRef<StoryScapeService | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // TEXT ACCUMULATION ALGORITHM (From Podcast Player)
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
    
    // Check if the new text is already contained or a suffix
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

  useEffect(() => {
    let anim: number;
    const checkSignal = () => {
      if (analysers.out) {
        const data = new Uint8Array(analysers.out.frequencyBinCount);
        analysers.out.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsNarrating(volume > 3);
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
  }, [analysers]);

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(30);
    const fetchedLore = await service.fetchLore(advConfig);
    setLore(fetchedLore);
    setConnectingProgress(70);

    const systemInstruction = `
      You are the Master Narrator for an immersive ${advConfig.genre} adventure titled "${advConfig.topic}".
      STYLE: Cinematic, vivid, and highly responsive. In ${advConfig.language}.
      LORE Grounding: ${fetchedLore.manifest}
      INSTRUCTION: Keep each turn relatively short (2-4 sentences). Always end with a choice or prompt for the user.
      NEVER break character.
    `;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        const processedText = cleanText(text);
        if (!processedText && !isFinal) return;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (role === 'model') {
          if (isFinal) {
            setMessages(prev => {
              const fullText = smartAppend(currentNarratorText, processedText).replace(/\s+/g, ' ').trim();
              if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === fullText) return prev;
              return [...prev, { role: 'model', text: fullText, timestamp }];
            });
            setCurrentNarratorText('');
          } else {
            setCurrentNarratorText(prev => smartAppend(prev, processedText));
          }
        } else {
          if (isFinal) {
            setMessages(prev => {
              const fullText = smartAppend(currentUserText, processedText).replace(/\s+/g, ' ').trim();
              return [...prev, { role: 'user', text: fullText, timestamp }];
            });
            setCurrentUserText('');
          } else {
            setCurrentUserText(prev => smartAppend(prev, processedText));
          }
        }
      },
      onError: (err) => console.error("Neural Link Failure:", err),
      onClose: () => onExit(),
    }, messages.map(m => ({ role: m.role, text: m.text })), fetchedLore, systemInstruction).then(() => {
      setConnectingProgress(100);
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
      service.setMicActive(true);
    });
  };

  useEffect(() => {
    initService(config);
    const audio = new Audio(AMBIENT_SOUNDS[config.genre]);
    audio.loop = true;
    audio.volume = ambientVolume;
    audio.play().catch(e => console.warn("Ambient audio failed", e));
    ambientAudioRef.current = audio;

    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.volume = isMuted ? 0 : ambientVolume;
  }, [ambientVolume, isMuted]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentNarratorText, currentUserText]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !serviceRef.current) return;
    const msg = textInput.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextInput('');
  };

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      await serviceRef.current.setMicActive(newMode === 'mic');
    }
  };

  const handleDownload = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("No audio data available for export yet.");
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
    <div className={`h-screen bg-[#020205] text-white font-sans flex flex-col overflow-hidden relative selection:bg-white selection:text-black`}>
      <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre={config.genre} isPaused={isPaused} />

      {/* HEADER: Podcast-style unified bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 z-50 shrink-0 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
            <i className="fas fa-arrow-left text-cyan-400"></i>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase leading-none">{config.topic}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${isNarrating ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-cyan-200">{config.genre} • {config.language}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleDownload} disabled={isDownloading} className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-all shrink-0" title="Export Audio">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-sm text-cyan-400`}></i>
          </button>
          
          <div className="flex items-center gap-3 glass px-5 py-2.5 rounded-full flex-1 md:flex-none border-white/5 shrink-0">
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-70 w-5">
              <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-low'} text-cyan-400`}></i>
            </button>
            <input type="range" min="0" max="1" step="0.01" value={ambientVolume} onChange={(e) => setAmbientVolume(parseFloat(e.target.value))} className="w-20 md:w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
          </div>

          <button onClick={togglePause} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${isPaused ? 'bg-green-500 text-white' : 'glass border-white/10 hover:bg-white/10'}`}>
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>

          <button onClick={onExit} className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center hover:bg-red-500/30 transition-all shrink-0">
            <i className="fas fa-stop text-sm"></i>
          </button>
        </div>
      </header>

      {/* MAIN LOG AREA: Podcast-style bubbles */}
      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-t-[3rem] overflow-hidden shadow-2xl relative border-white/10 z-10 bg-black/40 mt-4">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative">
          
          {connectingProgress < 100 && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center gap-8 text-center px-12">
               <div className="relative">
                 <div className={`w-32 h-32 border-[6px] border-cyan-900/20 border-t-cyan-500 rounded-full animate-spin`}></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-cyan-400">
                   {connectingProgress}%
                 </div>
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black uppercase tracking-[0.3em] text-cyan-400">Forging Neural Link...</h3>
                 <p className="text-[10px] opacity-40 uppercase tracking-[0.2em]">Synchronizing with the Grand Narrator.</p>
               </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[85%] p-6 rounded-[2rem] border transition-all ${
                m.role === 'user' 
                  ? 'bg-cyan-950/20 border-cyan-500/10 rounded-tr-none' 
                  : 'bg-white/5 border-white/5 rounded-tl-none shadow-xl'
              }`}>
                <p className={`text-[9px] mb-2 uppercase tracking-[0.3em] font-black flex items-center gap-2 ${m.role === 'user' ? 'text-cyan-400' : 'text-white/40'}`}>
                  {m.role === 'user' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>}
                  {m.role === 'user' ? 'YOUR ACTION' : 'THE NARRATOR'}
                </p>
                <p className="text-lg md:text-xl leading-relaxed font-light break-words hyphens-auto">
                  {m.text}
                </p>
                <p className="text-[8px] opacity-20 mt-3 text-right uppercase tracking-widest">{m.timestamp}</p>
              </div>
            </div>
          ))}

          {(currentNarratorText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-6 rounded-[2rem] border border-dashed transition-all animate-pulse ${
                currentUserText ? 'bg-cyan-500/[0.02] border-cyan-500/20 rounded-tr-none' : 'bg-white/[0.02] border-white/10 rounded-tl-none'
              }`}>
                <p className="text-lg md:text-xl leading-relaxed italic opacity-60 break-words hyphens-auto">
                  {currentUserText || currentNarratorText}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* INPUT BAR: High-end interactive control */}
        <div className="p-8 md:p-10 glass border-t border-white/10 bg-black/60 shrink-0">
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
             <button 
                onClick={handleMicToggle}
                className={`w-16 h-16 rounded-full border-2 transition-all flex items-center justify-center shadow-2xl shrink-0 ${
                  inputMode === 'mic' 
                    ? 'bg-red-600 border-red-400 text-white animate-pulse' 
                    : 'glass border-white/10 text-white/30 hover:text-white'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
              </button>

              <div className="flex-1 relative group">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex gap-3 w-full">
                       <input 
                         type="text" 
                         value={textInput} 
                         onChange={(e) => setTextInput(e.target.value)}
                         placeholder={isPaused ? "Saga Halted" : "What do you do next?"}
                         disabled={isPaused}
                         className="flex-1 glass border-white/10 rounded-full px-8 py-5 outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition-all text-lg font-light placeholder:opacity-20"
                       />
                       <button 
                         type="submit" 
                         disabled={!textInput.trim() || isPaused}
                         className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 shadow-2xl shrink-0"
                       >
                          <i className="fas fa-paper-plane text-lg"></i>
                       </button>
                    </form>
                 ) : (
                    <div className="w-full h-16 rounded-full glass border border-dashed border-white/10 flex items-center px-8 text-white/20 uppercase tracking-[0.4em] font-black text-xs">
                       {isUserSpeaking ? "Neural Link Active" : "Listening for your destiny..."}
                    </div>
                 )}
              </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
      ` }} />
    </div>
  );
};

export default AdventureView;
