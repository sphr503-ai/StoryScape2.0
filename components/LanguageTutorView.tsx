
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelTextBuffer = useRef('');
  const userTextBuffer = useRef('');

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

  // APK Fix: Aggressive mic permission check
  const checkMicPermission = async () => {
    try {
      setHwStatus('PROMPTING_MIC...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermissionError(null);
      setHwStatus('MIC_READY');
      return true;
    } catch (err: any) {
      setMicPermissionError(err.name || err.message || 'Unknown Error');
      setHwStatus('MIC_BLOCKED');
      return false;
    }
  };

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    
    if (newMode === 'mic') {
      const granted = await checkMicPermission();
      if (!granted) {
        alert("PERM_DENIED: Microphone access is blocked. In APK settings, ensure 'Record Audio' permission is enabled.");
        return;
      }
    }

    setInputMode(newMode);
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(newMode === 'mic');
      } catch (err) {
        setHwStatus('HARDWARE_FAILURE');
        setInputMode('text');
      }
    }
  };

  const handleExport = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("NO_DATA: Wait for more conversation before exporting.");
      return;
    }
    setIsDownloading(true);
    setHwStatus('ENCODING_WAV...');
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
      setHwStatus('TRIGGERING_SHARE...');
      await downloadOrShareAudio(wavBlob, `Sensei_Session_${Date.now()}.wav`);
      setHwStatus('EXPORT_SENT');
    } catch (err) {
      alert("EXPORT_ERROR: Compile failed.");
      setHwStatus('EXPORT_FAILED');
    } finally {
      setIsDownloading(false);
    }
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
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
## 🛑 CORRECTION LOGIC (Mandatory):
Whenever the user makes a mistake (grammar, vocab, tense):
"Aapko <fail>[User's Mistake]</fail> ki jagah <pass>[Correct Word]</pass> <p>([Pronunciation])</p> use karna chahiye. 
Iska matlab ye hai: <sea>([Simple Hindi Explanation])</sea>.
Incorrect: <fail>'[Full Original User Sentence]'</fail>
Correct: <pass>'[Fixed Full Sentence]'</pass> <sea>([Full Hindi Translation])</sea>
Ab please correct word repeat kijiye: <pass>[Correct Word]</pass> <p>([Pronunciation])</p>"
## Regular Dialogue Rules:
- For every sentence you speak in ${advConfig.language}, follow it immediately with its translation in <sea>(Hindi)</sea>.
- Stay in character as a futuristic neural tutor. Keep responses concise and focused.
`;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (role === 'model') {
          modelTextBuffer.current += text;
          setCurrentModelText(modelTextBuffer.current);
          if (isFinal) {
            const msg = modelTextBuffer.current.trim();
            if (msg) setMessages(prev => [...prev, { role: 'model', text: msg, timestamp }]);
            setCurrentModelText('');
            modelTextBuffer.current = '';
          }
        } else {
          userTextBuffer.current += text;
          setCurrentUserText(userTextBuffer.current);
          if (isFinal) {
            const msg = userTextBuffer.current.trim();
            if (msg) setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
            setCurrentUserText('');
            userTextBuffer.current = '';
          }
        }
      },
      onError: () => {
        setHwStatus('CONNECTION_LOST');
        setTimeout(() => initService(config), 3000);
      },
      onClose: () => onExit(),
    }, messages.map(m => ({role: m.role, text: m.text})), undefined, tutorInstruction).then(() => {
      setConnectingProgress(100);
      setHwStatus('LINK_ESTABLISHED');
      setAnalysers({ in: service.inputAnalyser, out: service.outputAnalyser });
    });
  };

  useEffect(() => {
    initService(config);
    return () => { if (serviceRef.current) serviceRef.current.stopAdventure(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentModelText, currentUserText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    const msg = textChoice.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp }]);
    serviceRef.current.sendTextChoice(msg);
    setTextChoice('');
  };

  return (
    <div className="h-screen bg-[#020202] text-[#00ff41] font-hacker flex flex-col overflow-hidden relative selection:bg-[#00ff41] selection:text-black">
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] scanlines"></div>

      <header className="bg-[#0a0a0a] border-b border-[#00ff41]/20 px-4 py-3 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[#00ff41] hover:bg-[#00ff41]/10 px-2 py-1 rounded transition-colors text-xs font-bold">
            [BACK]
          </button>
          <div className="h-4 w-px bg-[#00ff41]/20 mx-2"></div>
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase flex items-center gap-2">
              <span className="animate-pulse text-red-500">●</span> SESSION_TERMINAL: {config.topic}
            </h2>
            <div className="flex gap-2 items-center">
              <p className="text-[8px] opacity-60 uppercase tracking-tighter">Status: {hwStatus}</p>
              {micPermissionError && <p className="text-[8px] text-red-500 font-bold uppercase">ERROR: {micPermissionError}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleExport} 
             disabled={isDownloading} 
             className="w-8 h-8 rounded glass flex items-center justify-center border-[#00ff41]/20 hover:bg-[#00ff41]/10 transition-all"
             title="Share/Download Session"
           >
             <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-[10px]`}></i>
           </button>
           <button onClick={() => setIsPaused(!isPaused)} className={`text-xs font-bold tracking-widest ${isPaused ? 'text-amber-500' : 'text-[#00ff41]'}`}>
             [{isPaused ? 'RESUME' : 'PAUSE'}]
           </button>
           <button onClick={onExit} className="text-[#00ff41] hover:bg-[#00ff41]/10 px-2 py-1 rounded transition-colors text-xs font-bold">
            [ESC] EXIT
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative flex flex-col p-2 md:p-6 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
          
          <div className="text-[10px] opacity-30 border-b border-[#00ff41]/10 pb-2 mb-6 font-mono leading-relaxed">
            *** INITIALIZING_NEURAL_LINK ***<br/>
            *** HW_STATUS: {hwStatus} ***<br/>
            *** TARGET_LANG: {config.language.toUpperCase()} ***<br/>
            *** READY. ***
          </div>

          {connectingProgress < 100 && (
             <div className="py-4 font-bold text-xs">
                {">"} SYNCING_NEURAL_LINK: [{Array(Math.floor(connectingProgress/5)).fill('█').join('')}{Array(20-Math.floor(connectingProgress/5)).fill('░').join('')}] {connectingProgress}%
             </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[95%] md:max-w-[85%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className={`text-[10px] font-bold tracking-tight ${m.role === 'user' ? 'text-amber-500' : 'text-blue-400'}`}>
                    {m.role === 'user' ? 'Explorer' : 'Sensei'}@StoryScape:~$
                  </span>
                  <span className="text-[8px] opacity-25 font-mono">[{m.timestamp}]</span>
                </div>
                
                <div className={`p-4 md:p-5 border shadow-2xl ${
                  m.role === 'user' ? 'bg-amber-950/5 border-amber-500/20 text-amber-100' : 'bg-blue-950/5 border-blue-500/20 text-[#e9edef]'
                } rounded-sm`}>
                  <p className="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap font-mono">
                    {m.role === 'model' ? renderFormattedText(m.text) : m.text}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'} w-full`}>
               <div className="max-w-[95%] md:max-w-[85%] p-4 border border-dashed border-[#00ff41]/30 bg-[#00ff41]/5 rounded-sm">
                  <span className="text-[10px] font-black block mb-3 animate-pulse text-[#00ff41]">
                    {currentUserText ? 'USER_INPUT_BUFFERING...' : 'SENSEI_THINKING_NEURAL_RESPONSE...'}
                  </span>
                  <p className="text-sm md:text-base italic opacity-80 font-mono leading-relaxed break-words">
                    {currentUserText ? currentUserText : renderFormattedText(currentModelText)}
                    <span className="inline-block w-2.5 h-5 bg-[#00ff41] animate-blink ml-1 align-middle"></span>
                  </p>
               </div>
            </div>
          )}
          <div className="h-32"></div>
        </div>

        <div className="absolute bottom-4 left-0 right-0 h-16 pointer-events-none z-20 flex items-center justify-center opacity-40">
           <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre="TUTOR" customInputColor="#f59e0b" customOutputColor="#60a5fa" />
        </div>
      </main>

      <div className="bg-[#0a0a0a] border-t border-[#00ff41]/20 p-3 md:p-5 z-40 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          
          <div className="flex items-center gap-3 mb-1 px-1 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-[#00ff41]/40 tracking-widest uppercase">INPUT_MODE: {inputMode.toUpperCase()}</span>
              {inputMode === 'mic' && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                  <span className="text-[10px] text-red-500 font-black tracking-widest uppercase">CAPTURING_VOICE_DATA</span>
                </div>
              )}
            </div>
            <button 
              onClick={checkMicPermission} 
              className="text-[8px] font-bold border border-[#00ff41]/20 px-2 py-0.5 rounded hover:bg-[#00ff41]/10 uppercase"
            >
              Sync Hardware
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:block text-[#00ff41]/60 text-sm font-bold font-mono">
              user@storyscape:~$
            </div>
            
            <div className="flex-1 relative">
              {inputMode === 'text' ? (
                <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-3">
                  <input 
                    type="text" 
                    value={textChoice} 
                    onChange={(e) => setTextChoice(e.target.value)} 
                    disabled={isPaused}
                    autoFocus
                    placeholder={isPaused ? "TERMINAL_HALTED" : "Type neural response command..."} 
                    className="w-full bg-transparent text-[#00ff41] border-b border-[#00ff41]/20 px-3 py-3 outline-none focus:border-[#00ff41] placeholder-[#00ff41]/20 text-sm md:text-base font-mono" 
                  />
                  <button 
                    type="submit" 
                    disabled={!textChoice.trim() || isPaused} 
                    className="px-6 py-3 border border-[#00ff41]/30 hover:bg-[#00ff41]/10 text-[#00ff41] text-xs font-black tracking-widest transition-all disabled:opacity-10 active:scale-95 text-center"
                  >
                    EXECUTE
                  </button>
                </form>
              ) : (
                <div className="w-full bg-[#00ff41]/10 border border-dashed border-[#00ff41]/40 px-5 py-3 flex items-center justify-between rounded-sm">
                   <div className="flex items-center gap-3">
                      <i className="fas fa-satellite-dish text-xs animate-bounce text-[#00ff41]"></i>
                      <span className="text-[10px] font-black text-[#00ff41] tracking-[0.2em]">LISTENING_FOR_VOCAL_SYNTHESIS...</span>
                   </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleMicToggle}
              className={`w-12 h-12 md:w-14 md:h-14 border flex items-center justify-center transition-all duration-300 rounded-sm ${
                inputMode === 'mic' 
                  ? 'bg-red-900/30 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                  : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10 hover:border-[#00ff41]/60'
              }`}
            >
              <i className="fas fa-microphone text-base md:text-lg"></i>
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s step-end infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 255, 65, 0.02); } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.15); border-radius: 2px; }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
