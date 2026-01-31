
import React, { useEffect, useState, useRef } from 'react';
import { AdventureConfig } from '../types';
import { StoryScapeService } from '../services/geminiLiveService';
import Visualizer from './Visualizer';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface LanguageTutorViewProps {
  config: AdventureConfig;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const LanguageTutorView: React.FC<LanguageTutorViewProps> = ({ config, onExit, initialHistory = [] }) => {
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
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelTextBuffer = useRef('');
  const userTextBuffer = useRef('');

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(newMode === 'mic');
      } catch (err) {
        alert("TERMINAL ERROR: Microphone access denied.");
        setInputMode('text');
      }
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

## Communication Protocol:
- Speak in a friendly but precise manner.
- Primary language: ${advConfig.language}.
- Support language: Hindi/Hinglish for explanations.

## 🛑 CORRECTION LOGIC (Mandatory):
If the user makes a mistake (grammar, word choice, or tense), explain it in natural Hindi/Hinglish like this:
"Aapko '[User's Wrong Word]' ki jagah '[Correct Word]' use karna chahiye.
Iska matlab ye hai: [Explanation in Hindi/Hinglish].
Incorrect sentence: '[User's Original]'
Correct sentence: '[Fixed Version]' (इसका मतलब है: [Hindi translation])"

Example: "Aapko 'have' ki jagah 'had' use karna chahiye kyunki ye past action hai. 'Have' bolne se ye present tense ho jata hai jo yahan sahi nahi hai."

## Response Format:
- If correct, acknowledge briefly in Hinglish and continue in ${advConfig.language}.
- Keep sentences concise and optimized for a terminal display.
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
      onError: () => setTimeout(() => initService(config), 3000),
      onClose: () => onExit(),
    }, messages.map(m => ({role: m.role, text: m.text})), undefined, tutorInstruction).then(() => {
      setConnectingProgress(100);
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
      {/* SCANLINE OVERLAY */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] scanlines"></div>

      {/* TERMINAL HEADER */}
      <header className="bg-[#0a0a0a] border-b border-[#00ff41]/20 px-4 py-3 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-[#00ff41] hover:bg-[#00ff41]/10 px-2 py-1 rounded transition-colors text-xs">
            [ESC] EXIT
          </button>
          <div className="h-4 w-px bg-[#00ff41]/20 mx-2"></div>
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase flex items-center gap-2">
              <span className="animate-pulse">●</span> SESSION_TERMINAL: {config.topic}
            </h2>
            <p className="text-[10px] opacity-60 uppercase">Protocol: {config.language} • Status: Connected</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <button onClick={() => setIsPaused(!isPaused)} className={`text-xs ${isPaused ? 'text-amber-500' : 'text-[#00ff41]'}`}>
             [{isPaused ? 'RESUME' : 'PAUSE'}]
           </button>
           <div className="hidden md:flex items-center gap-2 text-[10px] opacity-40">
             <span>CPU: 12%</span>
             <span>MEM: 256MB</span>
           </div>
        </div>
      </header>

      {/* CHAT TERMINAL AREA */}
      <main className="flex-1 min-h-0 relative flex flex-col p-2 md:p-4 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          
          <div className="text-[10px] opacity-40 border-b border-[#00ff41]/10 pb-2 mb-4">
            *** INITIALIZING LANGUAGE_TUTOR_V3.1.5 ***<br/>
            *** ENCRYPTED_CHANNEL: ACTIVE ***<br/>
            *** TARGET_LANG: {config.language.toUpperCase()} ***
          </div>

          {connectingProgress < 100 && (
             <div className="py-4 font-bold text-xs">
                {">"} SYNCING_NEURAL_LINK: [{Array(Math.floor(connectingProgress/5)).fill('█').join('')}{Array(20-Math.floor(connectingProgress/5)).fill('░').join('')}] {connectingProgress}%
             </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-1 duration-300`}>
              <div className={`max-w-[90%] md:max-w-[80%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={`text-[10px] font-bold ${m.role === 'user' ? 'text-amber-500' : 'text-blue-400'}`}>
                    {m.role === 'user' ? 'Explorer' : 'Sensei'}@StoryScape:~$
                  </span>
                  <span className="text-[8px] opacity-30">[{m.timestamp}]</span>
                </div>
                
                <div className={`p-3 md:p-4 border ${
                  m.role === 'user' ? 'bg-amber-950/10 border-amber-500/30 text-amber-100' : 'bg-blue-950/10 border-blue-500/30 text-blue-100'
                } rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                  <p className="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">
                    {m.text}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* STREAMING OUTPUT */}
          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'} w-full`}>
               <div className="max-w-[90%] p-3 border border-dashed border-[#00ff41]/20 bg-[#00ff41]/5">
                  <span className="text-[10px] block mb-1 animate-pulse">{currentUserText ? 'USER_INPUT_BUFFERING...' : 'SENSEI_THINKING...'}</span>
                  <p className="text-sm md:text-base italic opacity-70">
                    {currentModelText || currentUserText}<span className="inline-block w-2 h-4 bg-[#00ff41] animate-blink ml-1"></span>
                  </p>
               </div>
            </div>
          )}
          <div className="h-20"></div> {/* Visualizer Space */}
        </div>

        {/* VISUALIZER DOCKED */}
        <div className="absolute bottom-2 left-0 right-0 h-16 pointer-events-none z-20 flex items-center justify-center opacity-40">
           <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre="TUTOR" customInputColor="#f59e0b" customOutputColor="#60a5fa" />
        </div>
      </main>

      {/* COMMAND LINE INPUT */}
      <div className="bg-[#0a0a0a] border-t border-[#00ff41]/20 p-2 md:p-4 z-40 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#00ff41]/50 tracking-tighter">MODE: {inputMode.toUpperCase()}</span>
            {inputMode === 'mic' && <span className="text-[10px] text-red-500 animate-pulse font-bold tracking-tighter">● RECORDING</span>}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:block text-[#00ff41] text-sm font-bold opacity-60">
              user@storyscape:~$
            </div>
            
            <div className="flex-1 relative">
              {inputMode === 'text' ? (
                <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-2">
                  <input 
                    type="text" 
                    value={textChoice} 
                    onChange={(e) => setTextChoice(e.target.value)} 
                    disabled={isPaused}
                    autoFocus
                    placeholder={isPaused ? "PROCESS_HALTED" : "Type command or response..."} 
                    className="w-full bg-transparent text-[#00ff41] border-b border-[#00ff41]/20 px-2 py-2 outline-none focus:border-[#00ff41] placeholder-[#00ff41]/20 text-sm md:text-base" 
                  />
                  <button 
                    type="submit" 
                    disabled={!textChoice.trim() || isPaused} 
                    className="px-4 py-2 border border-[#00ff41]/30 hover:bg-[#00ff41]/10 text-[#00ff41] text-xs font-bold transition-all disabled:opacity-20"
                  >
                    SEND
                  </button>
                </form>
              ) : (
                <div className="w-full bg-[#00ff41]/5 border border-dashed border-[#00ff41]/30 px-4 py-2 flex items-center justify-between">
                   <span className="text-[10px] font-bold animate-pulse text-[#00ff41]">LISTENING_FOR_VOICE_INPUT...</span>
                   <div className="flex gap-1">
                     <div className="w-1 h-3 bg-[#00ff41] animate-bounce [animation-delay:0.1s]"></div>
                     <div className="w-1 h-5 bg-[#00ff41] animate-bounce [animation-delay:0.2s]"></div>
                     <div className="w-1 h-3 bg-[#00ff41] animate-bounce [animation-delay:0.3s]"></div>
                   </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleMicToggle}
              className={`w-10 h-10 md:w-12 md:h-12 border flex items-center justify-center transition-all ${
                inputMode === 'mic' ? 'bg-red-900/40 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10'
              }`}
              title="Toggle Mic Input"
            >
              <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone'} text-sm md:text-base`}></i>
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 255, 65, 0.05); } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.2); }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
