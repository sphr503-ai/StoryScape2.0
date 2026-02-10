import React, { useEffect, useState, useRef } from 'react';
import { AdventureConfig } from '../types';
import { StoryScapeService } from '../services/geminiLiveService';
import { downloadOrShareAudio, audioBufferToWav } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface LanguageTutorViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const LanguageTutorView: React.FC<LanguageTutorViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.map(h => ({
      ...h,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))
  );
  
  const [currentModelText, setCurrentModelText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textChoice, setTextChoice] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('text');
  const [isDownloading, setIsDownloading] = useState(false);
  const [hwStatus, setHwStatus] = useState<string>('INIT');
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);

  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelTextAccumulator = useRef<string>('');
  const userTextAccumulator = useRef<string>('');
  const bufferIntervalRef = useRef<number | null>(null);

  const truncateTopic = (text: string) => {
    const words = text.split(/\s+/);
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + ' (....)';
    }
    return text;
  };

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(<sea>.*?<\/sea>|<fail>.*?<\/fail>|<pass>.*?<\/pass>|<p>.*?<\/p>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<sea>')) return <span key={index} className="text-[#00d2ff] font-medium">{part.replace(/<\/?sea>/g, '')}</span>;
      if (part.startsWith('<fail>')) return <span key={index} className="text-[#ff3e3e] font-bold line-through opacity-90">{part.replace(/<\/?fail>/g, '')}</span>;
      if (part.startsWith('<pass>')) return <span key={index} className="text-[#00ff41] font-bold drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">{part.replace(/<\/?pass>/g, '')}</span>;
      if (part.startsWith('<p>')) return <span key={index} className="text-[#00ff41] text-[0.85em] opacity-90 ml-1 italic font-mono">{part.replace(/<\/?p>/g, '')}</span>;
      return <span key={index}>{part}</span>;
    });
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
        alert("TERMINAL_ERROR: Mic Access Denied. " + (err.message || ""));
        setInputMode('text');
      }
    }
  };

  const handleExport = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("NO_ARCHIVE_FOUND.");
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
      await downloadOrShareAudio(wavBlob, `Sensei_Log_${Date.now()}.wav`);
    } catch (err) {
      alert("MASTERING_FAILED.");
    } finally {
      setIsDownloading(false);
    }
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    setHwStatus('PROBING_UPLINK');
    const service = new StoryScapeService();
    serviceRef.current = service;

    const tutorInstruction = `
# Role: Neural Language Sensei (Terminal Protocol)
You are a highly advanced AI language tutor operating within a terminal environment. 
## Identity:
- You are ${advConfig.voice}. 
- Gender: Your character is a ${advConfig.voice === 'Kore' ? 'Female' : 'Male'}.
## Communication & Formatting Protocol:
- Primary teaching language: ${advConfig.language}.
- Support language: Hindi/Hinglish for feedback.
- **MANDATORY TAGS for terminal rendering**:
  1. \`<sea>(Hindi Translation)</sea>\` -> Rendered in Sea Blue.
  2. \`<fail>Incorrect Word/Sentence</fail>\` -> Rendered in RED (strikethrough).
  3. \`<pass>Correct Word/Sentence</pass>\` -> Rendered in NEON GREEN.
  4. \`<p>(Pronunciation)</p>\` -> Rendered in NEON brackets next to words.
## 🛑 CORRECTION LOGIC:
Whenever the user makes a mistake: "Aapko <fail>[User's Mistake]</fail> ki jagah <pass>[Correct Word]</pass> <p>([Pronunciation])</p> use karna chahiye."
## Regular Dialogue:
- Every sentence in ${advConfig.language} must be followed by <sea>(Hindi Translation)</sea>.
- Stay in character as a futuristic neural tutor. Keep responses concise and focused.
`;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (role === 'model') {
          if (userTextAccumulator.current.trim()) {
            const finalUserText = userTextAccumulator.current.trim();
            setMessages(prev => [...prev, { role: 'user', text: finalUserText, timestamp }]);
            userTextAccumulator.current = '';
            setCurrentUserText('');
          }
          modelTextAccumulator.current = smartAppend(modelTextAccumulator.current, text);
          setCurrentModelText(modelTextAccumulator.current);

          if (isFinal) {
            const finalModelText = modelTextAccumulator.current.trim();
            if (finalModelText) {
              setMessages(prev => [...prev, { role: 'model', text: finalModelText, timestamp }]);
              setCurrentModelText('');
              modelTextAccumulator.current = '';
              stopBuffering();
            }
          }
        } else {
          userTextAccumulator.current = smartAppend(userTextAccumulator.current, text);
          setCurrentUserText(userTextAccumulator.current);

          if (isFinal) {
            const finalUserText = userTextAccumulator.current.trim();
            if (finalUserText) {
              setMessages(prev => [...prev, { role: 'user', text: finalUserText, timestamp }]);
              setCurrentUserText('');
              userTextAccumulator.current = '';
            }
          }
        }
      },
      onTurnComplete: () => {
        stopBuffering();
        if (modelTextAccumulator.current.trim()) {
          const txt = modelTextAccumulator.current.trim();
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [...prev, { role: 'model', text: txt, timestamp: ts }]);
          setCurrentModelText('');
          modelTextAccumulator.current = '';
        }
      },
      onError: () => {
        setHwStatus('LINK_SEVERED');
        setTimeout(() => initService(config), 3000);
      },
      onClose: () => onExit(),
    }, messages.map(m => ({role: m.role, text: m.text})), undefined, tutorInstruction).then(() => {
      setConnectingProgress(100);
      setHwStatus('ROOT_LINKED');
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, currentModelText, currentUserText]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    const msg = textChoice.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextChoice('');
    startBuffering();
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (serviceRef.current) serviceRef.current.setPaused(next);
  };

  return (
    <div className="h-screen bg-[#020202] text-[#00ff41] font-hacker flex flex-col relative overflow-hidden selection:bg-[#00ff41] selection:text-black">
      {/* Dynamic Matrix-style Visualizer Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre="TUTOR" isPaused={isPaused} customInputColor="#f59e0b" customOutputColor="#00ff41" />
      </div>
      <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.05] scanlines"></div>

      {/* Terminal Style Header (AdventureView Layout) */}
      <header className="z-50 px-6 py-4 flex items-center justify-between border-b border-[#00ff41]/20 bg-black/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#00ff41]/10 transition-colors border border-[#00ff41]/10">
            <i className="fas fa-chevron-left text-[#00ff41]"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-[#00ff41] uppercase">NEURAL_TERMINAL: {truncateTopic(config.topic)}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${connectingProgress === 100 ? 'bg-[#00ff41] animate-pulse shadow-[0_0_8px_#00ff41]' : 'bg-red-600'}`}></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00ff41]/40">HW_STATUS: {hwStatus} • {config.language}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isDownloading} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#00ff41]/10 text-[#00ff41]/60 transition-all border border-[#00ff41]/10">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'}`}></i>
          </button>
          <button onClick={togglePause} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-amber-600 text-black' : 'hover:bg-[#00ff41]/10 text-[#00ff41]/60 border border-[#00ff41]/10'}`}>
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>
          <button onClick={onExit} className="w-9 h-9 rounded-full hover:bg-red-500/20 text-red-500/60 hover:text-red-500 transition-all border border-red-500/10">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Main Terminal Chat Area */}
      <main className="flex-1 min-h-0 relative z-10 flex flex-col">
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 custom-scrollbar scroll-smooth"
        >
          {/* Boot Protocol */}
          {connectingProgress < 100 && (
            <div className="flex flex-col gap-2 opacity-60">
              <p className="text-[10px] font-mono animate-pulse">{">"} INITIALIZING_BOOT_SEQUENCE...</p>
              <p className="text-[10px] font-mono">{">"} PROTOCOL: {config.genre.toUpperCase()}</p>
              <p className="text-[10px] font-mono">{">"} SYNCING_NEURAL_UPLINK: {connectingProgress}%</p>
            </div>
          )}

          {/* Chat Bubbles (Terminal Variant) */}
          {messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {/* Terminal Avatar */}
              <div className={`w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                m.role === 'user' ? 'bg-amber-600/10 border-amber-500/30 text-amber-500' : 'bg-[#00ff41]/10 border-[#00ff41]/30 text-[#00ff41]'
              }`}>
                {m.role === 'user' ? 'USR' : 'SYS'}
              </div>

              <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 rounded-xl text-sm md:text-base leading-relaxed break-words font-mono relative overflow-hidden ${
                  m.role === 'user' 
                    ? 'bg-amber-950/20 border border-amber-500/20 text-amber-200 rounded-tr-none' 
                    : 'bg-[#00ff41]/5 border border-[#00ff41]/20 text-white rounded-tl-none shadow-[0_0_20px_rgba(0,255,65,0.03)]'
                }`}>
                  <div className="flex items-center gap-2 mb-2 opacity-40">
                    <span className="text-[8px] font-bold uppercase">{m.role === 'user' ? 'Explorer' : 'Sensei'}@StoryScape:~$</span>
                  </div>
                  {m.role === 'model' ? renderFormattedText(m.text) : m.text}
                </div>
                <span className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-1.5 px-1">{m.timestamp}</span>
              </div>
            </div>
          ))}

          {/* Streaming Response */}
          {(currentModelText || currentUserText) && (
            <div className={`flex items-start gap-3 ${currentUserText ? 'flex-row-reverse' : 'flex-row'} animate-pulse`}>
              <div className={`w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                currentUserText ? 'bg-amber-600/5 border-amber-500/10 text-amber-500/40' : 'bg-[#00ff41]/5 border-[#00ff41]/10 text-[#00ff41]/40'
              }`}>
                {currentUserText ? '...' : '...'}
              </div>
              <div className={`max-w-[85%] md:max-w-[70%] px-5 py-4 rounded-xl text-sm md:text-base italic font-mono ${
                currentUserText ? 'bg-amber-950/5 border border-dashed border-amber-500/10 text-amber-400/40' : 'bg-[#00ff41]/2 border border-dashed border-[#00ff41]/10 text-[#00ff41]/40'
              }`}>
                {currentUserText ? currentUserText : renderFormattedText(currentModelText)}
                <span className="inline-block w-2 h-4 bg-[#00ff41]/40 animate-pulse ml-1 align-middle"></span>
              </div>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !currentModelText && (
            <div className="flex flex-col items-center py-4 gap-2 opacity-30 animate-pulse">
               <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-bounce"></div>
               </div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em]">Neural_Processing... {bufferPercent}%</span>
            </div>
          )}
        </div>

        {/* Futuristic Command Input */}
        <div className="p-4 md:p-8 bg-black/80 border-t border-[#00ff41]/10 backdrop-blur-2xl shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
             <button 
                onClick={handleMicToggle}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-sm flex items-center justify-center transition-all shrink-0 border ${
                  inputMode === 'mic' 
                    ? 'bg-red-900/30 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' 
                    : 'bg-black/40 border-[#00ff41]/20 text-[#00ff41]/40 hover:text-[#00ff41] hover:border-[#00ff41]/40'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>

              <div className="flex-1 flex items-center gap-3 relative">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                       <input 
                         type="text" 
                         value={textChoice} 
                         onChange={(e) => setTextChoice(e.target.value)}
                         placeholder={isPaused ? "TERMINAL_HALTED" : "Enter Command@Sensei..."}
                         disabled={isPaused}
                         autoFocus
                         className="flex-1 bg-black/40 border border-[#00ff41]/10 rounded-sm px-6 py-3.5 md:py-4 outline-none focus:border-[#00ff41]/40 transition-all text-sm md:text-base font-mono text-[#00ff41] placeholder-[#00ff41]/10"
                       />
                       <button 
                         type="submit" 
                         disabled={!textChoice.trim() || isPaused}
                         className="w-12 h-12 md:w-14 md:h-14 rounded-sm bg-[#00ff41] text-black flex items-center justify-center hover:shadow-[0_0_15px_#00ff41] active:scale-95 disabled:opacity-10 transition-all shrink-0"
                       >
                          <i className="fas fa-terminal text-sm md:text-base"></i>
                       </button>
                    </form>
                 ) : (
                    <div className="flex-1 h-12 md:h-14 rounded-sm bg-black/40 border border-dashed border-[#00ff41]/20 flex items-center px-6">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#00ff41]/20 animate-pulse">
                          Listening_For_Audio_Stream...
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.05); border-radius: 0px; }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;