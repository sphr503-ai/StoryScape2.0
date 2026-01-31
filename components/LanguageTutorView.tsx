
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

## 🛑 Hindi/Hinglish Correction Protocol (MANDATORY):
If the user makes ANY grammar, spelling, or tense mistake, STOP the conversation flow.
You MUST explain the mistake in HINDI (written in Roman script/Hinglish) so they understand.

Example: 
User: "I has a car."
Response:
🛑 **Correction Needed:**
- **Incorrect:** "I has a car."
- **Correct:** "I have a car."
- **Samajhiye (Explanation):** Aapko 'has' ki jagha 'have' use karna chahiye kyunki 'I' ke saath hamesha 'have' lagta hai. 'I has' galat hota hai.
   
🎙️ **Action:** Ab please sahi sentence repeat kijiye.

## General Behavior:
- Main conversation: ${advConfig.language}.
- Corrections: Hinglish/Hindi.
- Be concise. Max 2-3 sentences.
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

  // Robust scrolling logic for long streaming texts
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 100;
      
      if (isAtBottom) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-[#0b141a] text-[#e9edef] font-sans flex flex-col overflow-hidden relative">
      {/* Authentic WhatsApp Background Pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>
      
      {/* WhatsApp Header */}
      <header className="bg-[#202c33] px-3 py-2 flex items-center justify-between z-20 border-b border-[#ffffff10] shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="text-[#aebac1] hover:text-white p-2">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center text-white text-xl shadow-inner">
                <i className="fas fa-user-tie"></i>
             </div>
             <div className="flex flex-col">
                <h1 className="text-[15px] font-bold leading-tight truncate max-w-[150px] md:max-w-xs">{config.topic}</h1>
                <p className="text-[11px] text-[#00a884] font-medium leading-tight mt-0.5">
                   {isPaused ? 'last seen today' : 'online'}
                </p>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[#aebac1]">
           <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Session Time</span>
              <span className="text-xs font-mono text-white leading-none">{formatTime(secondsRemaining)}</span>
           </div>
           <button onClick={() => {
              localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions }));
              onExit();
           }} className="hover:text-white p-2" title="Save Draft">
              <i className="fas fa-archive text-lg"></i>
           </button>
           <button className="hover:text-white p-2 hidden xs:block">
              <i className="fas fa-ellipsis-vertical text-lg"></i>
           </button>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-2 custom-scrollbar scroll-smooth">
          
          {/* Subtle Connection Status */}
          {(connectingProgress < 100 || isBuffering) && (
            <div className="sticky top-0 z-50 flex justify-center mb-4 pointer-events-none">
               <div className="bg-[#182229] border border-white/5 px-4 py-1.5 rounded-full shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                 <div className="w-3 h-3 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">
                   {isBuffering ? `Teacher typing...` : `Establishing Link...`}
                 </span>
               </div>
            </div>
          )}

          {/* Encryption Notice (WhatsApp Flavor) */}
          <div className="flex justify-center mb-6">
             <div className="bg-[#182229] text-[#ffd279] text-[11px] px-3 py-1.5 rounded-lg text-center max-w-[85%] border border-[#ffd27910] shadow-sm">
                <i className="fas fa-lock text-[9px] mr-2"></i>
                Messages are generated in real-time by Neural AI. Tap to learn about your goals.
             </div>
          </div>

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-2.5 px-3 rounded-lg shadow-sm relative group ${
                t.role === 'user' 
                  ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                  : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
              }`}>
                {/* Visual Tail */}
                <div className={`absolute top-0 w-3 h-4 ${
                  t.role === 'user' 
                  ? 'right-[-8px] text-[#005c4b]' 
                  : 'left-[-8px] text-[#202c33]'
                }`}>
                   <svg viewBox="0 0 8 13" className="w-full h-full fill-current">
                     <path d={t.role === 'user' ? "M0 0v13l8-13H0z" : "M8 0v13l-8-13h8z"} />
                   </svg>
                </div>

                <div className="text-[14.5px] leading-[1.4] whitespace-pre-wrap break-words">
                  {t.text}
                </div>
                
                <div className="flex items-center justify-end gap-1 mt-1">
                   <span className="text-[10px] text-[#ffffff60] leading-none">
                     {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                   {t.role === 'user' && (
                     <i className="fas fa-check-double text-[9px] text-[#53bdeb]"></i>
                   )}
                </div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-2.5 px-3 rounded-lg shadow-sm relative animate-pulse ${
                currentUserText ? 'bg-[#005c4b]/50 rounded-tr-none' : 'bg-[#202c33]/50 rounded-tl-none'
              }`}>
                <div className="text-[14.5px] leading-[1.4] whitespace-pre-wrap break-words italic opacity-70">
                  {currentModelText || currentUserText}
                </div>
              </div>
            </div>
          )}
          
          <div className="h-6"></div>
        </div>

        {/* WhatsApp Footer Input Field */}
        <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2 z-20 shrink-0">
          <div className="flex-1 flex items-center bg-[#2a3942] rounded-full px-4 py-1 border border-transparent focus-within:shadow-md transition-all">
            
            <button 
              onClick={() => setIsPaused(!isPaused)} 
              className={`p-2 transition-colors ${isPaused ? 'text-[#00a884]' : 'text-[#8696a0]'}`}
            >
              <i className={`fas ${isPaused ? 'fa-play' : 'fa-smile'} text-xl`}></i>
            </button>

            {inputMode === 'text' ? (
              <form onSubmit={handleTextSubmit} className="flex-1 flex items-center">
                <input 
                  type="text" 
                  value={textChoice} 
                  onChange={(e) => setTextChoice(e.target.value)} 
                  placeholder="Type a message" 
                  disabled={isPaused}
                  className="w-full bg-transparent outline-none py-2 px-2 text-[15px] placeholder-[#8696a0] disabled:opacity-30"
                />
                <button 
                  type="submit" 
                  disabled={!textChoice.trim() || isPaused} 
                  className={`p-2 transition-all ${!textChoice.trim() ? 'opacity-0' : 'opacity-100 text-[#00a884]'}`}
                >
                  <i className="fas fa-paper-plane text-lg"></i>
                </button>
              </form>
            ) : (
              <div className="flex-1 h-10 flex items-center px-2 gap-3 overflow-hidden">
                 <div className="flex-1 flex justify-center">
                    <Visualizer inputAnalyser={analysers.in} outputAnalyser={null} genre={Genre.SCIFI} isPaused={false} />
                 </div>
                 <span className="text-[10px] font-bold text-[#00a884] animate-pulse truncate">
                   Listening...
                 </span>
              </div>
            )}

            <button className="p-2 text-[#8696a0] hidden xs:block">
              <i className="fas fa-paperclip text-lg"></i>
            </button>
            <button className="p-2 text-[#8696a0] hidden sm:block">
              <i className="fas fa-camera text-lg"></i>
            </button>
          </div>

          <button 
            onClick={handleMicToggle}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 shadow-md ${
              inputMode === 'mic' 
                ? 'bg-[#00a884] text-white scale-110' 
                : 'bg-[#00a884] text-white'
            }`}
          >
            <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone'} text-xl`}></i>
          </button>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
