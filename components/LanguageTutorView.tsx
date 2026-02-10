
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
  const [error, setError] = useState<string | null>(null);
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelTextBuffer = useRef('');
  const userTextBuffer = useRef('');

  // Special Terminal Formatting for Language Learning
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(<sea>.*?<\/sea>|<fail>.*?<\/fail>|<pass>.*?<\/pass>|<p>.*?<\/p>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<sea>')) return <span key={index} className="text-[#00d2ff] font-medium">{part.replace(/<\/?sea>/g, '')}</span>;
      if (part.startsWith('<fail>')) return <span key={index} className="text-[#ff3e3e] font-bold line-through opacity-80">{part.replace(/<\/?fail>/g, '')}</span>;
      if (part.startsWith('<pass>')) return <span key={index} className="text-[#00ff41] font-bold drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">{part.replace(/<\/?pass>/g, '')}</span>;
      if (part.startsWith('<p>')) return <span key={index} className="text-[#00ff41] text-[0.85em] opacity-90 ml-1 italic font-mono">{part.replace(/<\/?p>/g, '')}</span>;
      return <span key={index}>{part}</span>;
    });
  };

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
    setError(null);
    setConnectingProgress(10);
    const service = new StoryScapeService();
    serviceRef.current = service;

    try {
      setConnectingProgress(30);
      setHwStatus('LORE_FETCHING');
      const fetchedLore = await service.fetchLore(advConfig);
      setConnectingProgress(70);

      const tutorInstruction = `
        # Role: Neural Language Sensei (Terminal Protocol)
        You are a highly advanced AI language tutor operating within a terminal environment. 
        Identity: You are ${advConfig.voice}. 
        Style: Helpful, encouraging, and cinematic. Language: ${advConfig.language}.
        MANDATORY TAGS for rendering:
        1. <sea>(Translation)</sea> -> Rendering Blue.
        2. <fail>Mistake</fail> -> Rendering Red.
        3. <pass>Correction</pass> -> Rendering Green.
        4. <p>(Pronunciation)</p> -> In brackets.
        NEVER break character.
      `;

      await service.startAdventure(advConfig, {
        onTranscriptionUpdate: (role, text, isFinal) => {
          const processedText = text; // Keep tags for tutor rendering
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          if (role === 'model') {
            if (userTextBuffer.current.trim()) {
              setMessages(prev => [...prev, { role: 'user', text: userTextBuffer.current.trim(), timestamp }]);
              setCurrentUserText('');
              userTextBuffer.current = '';
            }

            if (processedText) {
              modelTextBuffer.current = smartAppend(modelTextBuffer.current, processedText);
              setCurrentModelText(modelTextBuffer.current);
            }
            if (isFinal && modelTextBuffer.current.trim()) {
              setMessages(prev => [...prev, { role: 'model', text: modelTextBuffer.current.trim(), timestamp }]);
              setCurrentModelText('');
              modelTextBuffer.current = '';
            }
          } else {
            if (processedText) {
              userTextBuffer.current = smartAppend(userTextBuffer.current, processedText);
              setCurrentUserText(userTextBuffer.current);
            }
            if (isFinal && userTextBuffer.current.trim()) {
              setMessages(prev => [...prev, { role: 'user', text: userTextBuffer.current.trim(), timestamp }]);
              setCurrentUserText('');
              userTextBuffer.current = '';
            }
          }
        },
        onError: (err) => {
          console.error("Neural Link Failure:", err);
          setError(err.message || "Network Error");
        },
        onClose: () => onExit(),
      }, messages.map(m => ({ role: m.role, text: m.text })), fetchedLore, tutorInstruction);

      setConnectingProgress(100);
      setHwStatus('CONNECTED');
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    } catch (err: any) {
      setError(err.message || "Establish failure.");
    }
  };

  useEffect(() => {
    initService(config);
    return () => {
      if (serviceRef.current) serviceRef.current.stopAdventure();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentModelText, currentUserText]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textChoice.trim() || !serviceRef.current) return;
    const msg = textChoice.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextChoice('');
  };

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(newMode === 'mic');
      } catch (err) {
        setInputMode('text');
        alert("Mic permission denied.");
      }
    }
  };

  const handleExport = async () => {
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
      await downloadOrShareAudio(wavBlob, `Sensei_Session_${Date.now()}.wav`);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-screen bg-[#020202] text-[#00ff41] font-hacker flex flex-col overflow-hidden relative selection:bg-[#00ff41] selection:text-black">
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] scanlines"></div>
      
      <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre="TUTOR" isPaused={isPaused} customInputColor="#f59e0b" customOutputColor="#00ff41" />

      {/* HEADER: High-end unified bar but terminal themed */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 z-50 shrink-0 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full border border-[#00ff41]/20 flex items-center justify-center hover:bg-[#00ff41]/10 transition-all shrink-0">
            <i className="fas fa-arrow-left text-[#00ff41]"></i>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase leading-none">NEURAL_TUTOR_V4</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${isNarrating ? 'bg-[#00ff41] animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-[#00ff41]">{config.language} • {hwStatus}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleExport} disabled={isDownloading} className="w-12 h-12 rounded-full border border-[#00ff41]/20 flex items-center justify-center hover:bg-[#00ff41]/10 transition-all shrink-0">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-sm text-[#00ff41]`}></i>
          </button>
          
          <button onClick={() => setIsPaused(!isPaused)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${isPaused ? 'bg-amber-500 text-black' : 'border border-[#00ff41]/20 hover:bg-[#00ff41]/10'}`}>
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>

          <button onClick={onExit} className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 flex items-center justify-center hover:bg-red-500/30 transition-all shrink-0">
            <i className="fas fa-stop text-sm"></i>
          </button>
        </div>
      </header>

      {/* MAIN LOG AREA: Using the adventure-style message bubbles but terminal themed */}
      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-t-[3rem] overflow-hidden shadow-2xl relative border-[#00ff41]/10 z-10 bg-black/40 mt-4">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative">
          
          {(connectingProgress < 100 || error) && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center gap-8 text-center px-12 font-hacker">
               {!error ? (
                 <>
                   <div className="relative">
                     <div className={`w-32 h-32 border-[6px] border-[#00ff41]/10 border-t-[#00ff41] rounded-full animate-spin`}></div>
                     <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-[#00ff41]">
                       {connectingProgress}%
                     </div>
                   </div>
                   <h3 className="text-xl font-black uppercase tracking-[0.3em] text-[#00ff41] animate-pulse">INIT_NEURAL_SYNC...</h3>
                 </>
               ) : (
                 <>
                   <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/20">
                      <i className="fas fa-triangle-exclamation text-3xl text-red-500"></i>
                   </div>
                   <div className="space-y-4">
                     <h3 className="text-2xl font-black uppercase text-red-500">LINK_SEVERED</h3>
                     <p className="text-white/60 text-xs max-w-xs">{error}</p>
                   </div>
                   <button onClick={() => initService(config)} className="px-10 py-4 rounded-full bg-[#00ff41] text-black font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-xl">RETRY_LINK</button>
                 </>
               )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[85%] p-6 rounded-[2rem] border transition-all ${
                m.role === 'user' 
                  ? 'bg-amber-950/20 border-amber-500/10 rounded-tr-none' 
                  : 'bg-[#00ff41]/5 border-[#00ff41]/10 rounded-tl-none shadow-xl'
              }`}>
                <p className={`text-[9px] mb-2 uppercase tracking-[0.3em] font-black ${m.role === 'user' ? 'text-amber-500' : 'text-[#00ff41]'}`}>
                  {m.role === 'user' ? 'EXPLORER@TERMINAL' : 'SENSEI@NEURAL'}
                </p>
                <p className="text-lg md:text-xl leading-relaxed font-light break-words hyphens-auto font-mono">
                  {m.role === 'model' ? renderFormattedText(m.text) : m.text}
                </p>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-6 rounded-[2rem] border border-dashed transition-all animate-pulse ${
                currentUserText ? 'bg-amber-500/[0.02] border-amber-500/20 rounded-tr-none' : 'bg-[#00ff41]/[0.02] border-[#00ff41]/10 rounded-tl-none'
              }`}>
                <p className="text-lg md:text-xl leading-relaxed italic opacity-60 break-words font-mono">
                  {currentUserText ? currentUserText : renderFormattedText(currentModelText)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* INPUT BAR: High-end layout but terminal themed */}
        <div className="p-8 md:p-10 border-t border-[#00ff41]/10 bg-black/60 shrink-0">
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
             <button 
                onClick={handleMicToggle}
                className={`w-16 h-16 rounded-full border-2 transition-all flex items-center justify-center shadow-2xl shrink-0 ${
                  inputMode === 'mic' 
                    ? 'bg-red-600 border-red-400 text-white animate-pulse' 
                    : 'border-[#00ff41]/10 text-[#00ff41]/30 hover:text-[#00ff41] hover:bg-[#00ff41]/5'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
              </button>

              <div className="flex-1 relative group">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex gap-3 w-full">
                       <input 
                         type="text" 
                         value={textChoice} 
                         onChange={(e) => setTextChoice(e.target.value)}
                         placeholder={isPaused ? "TERMINAL_HALTED" : "EXECUTE COMMAND..."}
                         disabled={isPaused}
                         className="flex-1 bg-white/5 border border-[#00ff41]/10 rounded-full px-8 py-5 outline-none focus:border-[#00ff41]/30 focus:bg-[#00ff41]/[0.05] transition-all text-lg font-mono text-[#00ff41] placeholder-[#00ff41]/20"
                       />
                       <button 
                         type="submit" 
                         disabled={!textChoice.trim() || isPaused}
                         className="w-16 h-16 rounded-full bg-[#00ff41] text-black flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 shadow-2xl shrink-0"
                       >
                          <i className="fas fa-terminal text-lg"></i>
                       </button>
                    </form>
                 ) : (
                    <div className="w-full h-16 rounded-full border border-dashed border-[#00ff41]/10 flex items-center px-8 text-[#00ff41]/20 uppercase tracking-[0.4em] font-black text-xs">
                       {isUserSpeaking ? "CAPTURING_VOICE_DATA..." : "AWAITING_INPUT..."}
                    </div>
                 )}
              </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.1); border-radius: 10px; }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
