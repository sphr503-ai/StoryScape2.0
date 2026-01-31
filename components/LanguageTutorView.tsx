
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig } from '../types';
import { StoryScapeService, LoreData } from '../services/geminiLiveService';
import { audioBufferToWav } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface LanguageTutorViewProps {
  config: AdventureConfig;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const LanguageTutorView: React.FC<LanguageTutorViewProps> = ({ config, onExit, initialHistory = [] }) => {
  const [transcriptions, setTranscriptions] = useState<Array<{ role: 'user' | 'model'; text: string }>>(initialHistory);
  const [currentModelText, setCurrentModelText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [textChoice, setTextChoice] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [connectingProgress, setConnectingProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [isOutputActive, setIsOutputActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState((config.durationMinutes || 25) * 60);
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('text');
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);

  const startBuffering = () => {
    setIsBuffering(true);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    bufferIntervalRef.current = window.setInterval(() => {
      setBufferPercent(p => (p >= 99 ? 99 : p + Math.floor(Math.random() * 5) + 3));
    }, 400);
  };

  const stopBuffering = () => {
    setIsBuffering(false);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
  };

  const handleMicToggle = async () => {
    const newMode = inputMode === 'text' ? 'mic' : 'text';
    setInputMode(newMode);
    if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(newMode === 'mic');
      } catch (err) {
        alert("Microphone access denied. Please check browser permissions.");
        setInputMode('text');
      }
    }
  };

  const cleanText = (text: string): string => {
    return text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(5);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    const tutorInstruction = `
# Role: AI Language Teacher (Hinglish Support)
You are an advanced, empathetic, and interactive AI Language Tutor.

## Objective
Engage the user in conversation in ${advConfig.language}. 
STRICTLY follow these rules:

1. **Onboarding:** If history is empty, greet and ask for their native language, current level, and goal (Business/Personal/Travel).

2. **🛑 Hindi/Hinglish Correction Protocol:**
   If the user makes ANY mistake (grammar, tense, word choice), STOP the conversation flow immediately.
   You MUST explain the mistake in HINDI (written in Roman script/Hinglish) so they understand clearly.
   
   Example format:
   🛑 **Correction Needed:**
   - **Incorrect:** "[User's sentence]"
   - **Correct:** "[Corrected sentence]"
   - **Samajhiye (Explanation):** Aapko yahan '[word]' ki jagha '[word]' use karna chahiye tha kyunki [short reason in Hindi]. 
   
   **🎙️ Action:** Ab please sahi sentence repeat kijiye.

3. **General Behavior:**
   - Use ${advConfig.language} for the main conversation.
   - Use Hinglish/Hindi ONLY for explaining corrections.
   - Keep replies short (1-2 sentences).
`;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        const processedText = cleanText(text);
        if (role === 'model') {
          if (isFinal) {
            setTranscriptions(prev => [...prev, { role: 'model', text: processedText }]);
            setCurrentModelText('');
            stopBuffering();
          } else {
            setCurrentModelText(processedText);
          }
        } else {
          if (isFinal) {
            setTranscriptions(prev => [...prev, { role: 'user', text: processedText }]);
            setCurrentUserText('');
          } else {
            setCurrentUserText(processedText);
          }
        }
      },
      onError: () => {
        startBuffering();
        setTimeout(() => initService(config), 5000);
      },
      onClose: () => onExit(),
    }, transcriptions, undefined, tutorInstruction).then(() => {
      setConnectingProgress(100);
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
    if (connectingProgress === 100 && !isPaused && secondsRemaining > 0) {
      timerRef.current = window.setInterval(() => setSecondsRemaining(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [connectingProgress, isPaused, secondsRemaining]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, currentModelText, currentUserText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    const msg = textChoice.trim();
    setTranscriptions(prev => [...prev, { role: 'user', text: msg }]);
    serviceRef.current.sendTextChoice(msg);
    setTextChoice('');
    startBuffering();
  };

  const handleSaveDraft = () => {
    localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions }));
    onExit();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-[#0b141a] text-[#e9edef] font-sans flex flex-col overflow-hidden relative">
      {/* WhatsApp Doodle Background */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>
      
      {/* WhatsApp Style Header */}
      <header className="bg-[#202c33] px-4 py-3 flex items-center justify-between z-20 border-b border-[#ffffff10] shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-[#aebac1] hover:text-white transition-colors">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center text-white text-lg border border-white/10">
                <i className="fas fa-graduation-cap"></i>
             </div>
             <div>
                <h1 className="text-[15px] font-bold leading-tight">{config.topic}</h1>
                <p className="text-[11px] text-[#00a884] font-medium leading-tight">
                   {isPaused ? 'Paused' : 'Online'} • {config.language}
                </p>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
           <div className="text-[11px] font-black bg-white/5 px-3 py-1 rounded-md text-[#8696a0] border border-white/5">
             {formatTime(secondsRemaining)}
           </div>
           <button onClick={handleSaveDraft} className="text-[#aebac1] hover:text-white transition-colors" title="Save & Exit">
              <i className="fas fa-floppy-disk text-lg"></i>
           </button>
        </div>
      </header>

      {/* Chat Viewport */}
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar scroll-smooth">
          
          {/* Status Message Overlay */}
          {(connectingProgress < 100 || isBuffering) && (
            <div className="sticky top-0 z-50 flex justify-center mb-6 pointer-events-none">
               <div className="bg-[#182229] border border-white/5 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                 <div className="w-3.5 h-3.5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">
                   {isBuffering ? `Sensei is thinking...` : `Syncing Neural Teacher (${connectingProgress}%)`}
                 </span>
               </div>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-3 px-4 rounded-xl shadow-md relative group ${
                t.role === 'user' 
                  ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                  : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
              }`}>
                {/* Bubble Tail */}
                <div className={`absolute top-0 w-3 h-4 ${
                  t.role === 'user' 
                  ? 'right-[-8px] text-[#005c4b]' 
                  : 'left-[-8px] text-[#202c33]'
                }`}>
                   <svg viewBox="0 0 8 13" className="w-full h-full fill-current">
                     <path d={t.role === 'user' ? "M0 0v13l8-13H0z" : "M8 0v13l-8-13h8z"} />
                   </svg>
                </div>

                <div className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">
                  {t.text}
                </div>
                <div className="flex justify-end mt-1 h-3 opacity-40">
                   <span className="text-[9px] uppercase font-bold">
                     {t.role === 'user' ? 'Sent' : 'Teacher'}
                   </span>
                </div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-3 px-4 rounded-xl shadow-sm animate-pulse ${
                currentUserText ? 'bg-[#005c4b]/40 rounded-tr-none' : 'bg-[#202c33]/40 rounded-tl-none'
              }`}>
                <div className="text-[14.5px] leading-[1.45] italic opacity-60">
                  {currentModelText || currentUserText}
                </div>
              </div>
            </div>
          )}
          
          <div className="h-4"></div>
        </div>

        {/* WhatsApp Style Footer Input */}
        <div className="bg-[#202c33] px-3 py-3 flex items-center gap-2 z-20 shrink-0 border-t border-white/5">
          <button 
            onClick={handleMicToggle}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              inputMode === 'mic' 
                ? 'bg-[#00a884] text-[#111b21] shadow-lg scale-110' 
                : 'text-[#8696a0] hover:text-[#e9edef] bg-white/5'
            }`}
          >
            <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
          </button>

          {inputMode === 'text' ? (
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2 items-center">
              <div className="flex-1 bg-[#2a3942] rounded-full px-5 py-3 border border-transparent focus-within:border-[#00a88440] transition-all">
                <input 
                  type="text" 
                  value={textChoice} 
                  onChange={(e) => setTextChoice(e.target.value)} 
                  placeholder="Type a message" 
                  disabled={isPaused}
                  className="w-full bg-transparent outline-none text-[15px] placeholder-[#8696a0] disabled:opacity-30"
                />
              </div>
              <button 
                type="submit" 
                disabled={!textChoice.trim() || isPaused} 
                className="w-12 h-12 rounded-full bg-[#00a884] text-[#111b21] flex items-center justify-center shadow-md disabled:opacity-30 disabled:bg-[#8696a0] transition-all active:scale-90 shrink-0"
              >
                <i className="fas fa-paper-plane text-lg ml-0.5"></i>
              </button>
            </form>
          ) : (
            <div className="flex-1 h-12 bg-[#2a3942] rounded-full flex items-center px-6 gap-4 overflow-hidden border border-[#00a88420]">
               <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00a884] animate-pulse">
                 Listening to you...
               </span>
               <div className="flex-1 flex justify-end">
                  <Visualizer inputAnalyser={analysers.in} outputAnalyser={null} genre={Genre.SCIFI} isPaused={false} />
               </div>
            </div>
          )}
          
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/5 ${
              isPaused ? 'text-[#00a884]' : 'text-[#8696a0]'
            }`}
          >
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-lg`}></i>
          </button>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374045; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a555c; }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
