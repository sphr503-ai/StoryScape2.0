
import React, { useEffect, useState, useRef } from 'react';
import { Genre, AdventureConfig, GeminiVoice } from '../types';
import { StoryScapeService } from '../services/geminiLiveService';
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
  const [secondsRemaining, setSecondsRemaining] = useState((config.durationMinutes || 25) * 60);
  const [inputMode, setInputMode] = useState<'text' | 'mic'>('text');
  
  const [analysers, setAnalysers] = useState<{in: AnalyserNode | null, out: AnalyserNode | null}>({in: null, out: null});
  
  const serviceRef = useRef<StoryScapeService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const bufferIntervalRef = useRef<number | null>(null);

  // Buffers to fix the "only last word" bug
  const modelTextBuffer = useRef('');
  const userTextBuffer = useRef('');

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
        alert("Microphone access denied. Check browser permissions.");
        setInputMode('text');
      }
    }
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(5);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    
    const tutorInstruction = `
# Role: Meta AI Style Language Tutor
You are a friendly, helpful AI tutor. You communicate in a specific bilingual style.

## Interaction Style:
1. **Bilingual Responses**: For every sentence you speak in ${advConfig.language}, provide the Hindi translation in brackets immediately after.
   Example: "Hi! (नमस्ते!) How's your day going so far? (आपका दिन अब तक कैसा चल रहा है?)"

2. **Correction Protocol**: If the user makes a mistake (grammar/spelling/phrasing), follow this format:
   - "Your sentence is almost perfect! Here's a small correction:
   
     Instead of '[User's Mistake]', we can say '[Correct Version]' ([Hindi Translation])
     
     Does that sound better? (क्या यह बेहतर लग रहा है?)"

3. **Tone**: High-tech, empathetic, and encouraging.
4. **Primary Language**: ${advConfig.language}.
5. **Support Language**: Hindi.
`;

    service.startAdventure(advConfig, {
      onTranscriptionUpdate: (role, text, isFinal) => {
        if (!text && !isFinal) return;
        
        if (role === 'model') {
          modelTextBuffer.current += text;
          setCurrentModelText(modelTextBuffer.current);
          
          if (isFinal) {
            const msg = modelTextBuffer.current.trim();
            if (msg) setTranscriptions(prev => [...prev, { role: 'model', text: msg }]);
            setCurrentModelText('');
            modelTextBuffer.current = '';
            stopBuffering();
          }
        } else {
          userTextBuffer.current += text;
          setCurrentUserText(userTextBuffer.current);

          if (isFinal) {
            const msg = userTextBuffer.current.trim();
            if (msg) setTranscriptions(prev => [...prev, { role: 'user', text: msg }]);
            setCurrentUserText('');
            userTextBuffer.current = '';
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gradient-to-b from-indigo-950/40 to-black text-white font-sans flex flex-col p-4 md:p-8 transition-colors duration-1000 overflow-hidden relative">
      <Visualizer 
        inputAnalyser={analysers.in} 
        outputAnalyser={analysers.out} 
        genre="TUTOR" 
        customInputColor="#ef4444" 
        customOutputColor="#3b82f6"
        isPaused={isPaused}
      />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-2">
              Neural Tutor: {config.topic}
              <i className="fas fa-check-circle text-blue-500 text-xs"></i>
            </h1>
            <p className="text-[10px] opacity-60 uppercase tracking-widest font-black mt-0.5">
              Fluency Protocol • {config.language} • {formatTime(secondsRemaining)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => {
              localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions }));
              onExit();
            }} 
            className="px-6 py-3 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <i className="fas fa-save"></i> Save Draft
          </button>
          <button onClick={onExit} className="px-8 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-2xl shrink-0">End Session</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-white/10 z-10 bg-black/20">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8 text-center px-12">
               <div className="relative">
                 <div className="w-32 h-32 border-[6px] border-white/5 border-t-white rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">{isBuffering ? bufferPercent : connectingProgress}%</div>
               </div>
               <h3 className="text-sm font-black uppercase tracking-[0.3em]">Syncing Neural Lab...</h3>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} w-full items-end gap-2`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-[1.8rem] shadow-xl relative ${
                t.role === 'user' 
                  ? 'bg-emerald-600/80 text-white rounded-tr-none border border-white/10' 
                  : 'bg-white/10 text-white rounded-tl-none border border-white/5'
              }`}>
                {/* Bubble Tail for extra chat-app feel */}
                <div className={`absolute top-0 ${t.role === 'user' ? 'right-[-6px]' : 'left-[-6px]'}`}>
                   <svg viewBox="0 0 8 13" className={`w-3 h-4 fill-current ${t.role === 'user' ? 'text-emerald-600/80' : 'text-white/10'}`}>
                     <path d={t.role === 'user' ? "M0 0v13l8-13H0z" : "M8 0v13l-8-13h8z"} />
                   </svg>
                </div>
                <div className="text-[15px] md:text-[17px] leading-relaxed whitespace-pre-wrap break-words">{t.text}</div>
                <div className={`flex items-center gap-1 mt-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <span className="text-[9px] opacity-40 uppercase tracking-widest font-black">
                     {t.role === 'user' ? 'Explorer' : 'Meta AI'}
                   </span>
                   {t.role === 'user' && <i className="fas fa-check-double text-[9px] text-blue-400"></i>}
                </div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-[1.8rem] animate-pulse ${
                currentUserText ? 'bg-emerald-600/30 rounded-tr-none' : 'bg-white/5 rounded-tl-none'
              }`}>
                <div className="text-[15px] md:text-[17px] leading-relaxed italic opacity-60">
                  {currentModelText || currentUserText}
                </div>
              </div>
            </div>
          )}
          <div className="h-4"></div>
        </div>

        {/* Improved Adventure-Style Footer */}
        <div className="p-8 md:p-10 glass border-t border-white/10 flex flex-col gap-6 bg-black/40 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <button 
                onClick={handleMicToggle} 
                className={`flex items-center gap-4 px-8 py-4 rounded-full border transition-all shrink-0 ${
                  inputMode === 'mic' 
                    ? 'bg-red-600 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                }`}
              >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-keyboard'}`}></i>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {inputMode === 'mic' ? 'Mic Active' : 'Text Mode'}
                </span>
              </button>
              
              <div className="h-8 w-px bg-white/10 hidden md:block"></div>
              
              <div className="flex items-center gap-4">
                 <div className={`w-2.5 h-2.5 rounded-full ${!isPaused ? 'bg-blue-500 animate-pulse' : 'bg-white/20'}`}></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-40">System: Ready</span>
              </div>
            </div>

            <button 
              onClick={() => setIsPaused(!isPaused)} 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isPaused ? 'bg-blue-600 text-white shadow-xl' : 'glass border-white/10 hover:bg-white/5'
              }`}
            >
              <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
            </button>
          </div>

          {inputMode === 'text' && (
            <form onSubmit={handleTextSubmit} className="relative flex items-center gap-3">
              <input 
                type="text" 
                value={textChoice} 
                onChange={(e) => setTextChoice(e.target.value)} 
                disabled={isPaused}
                placeholder={isPaused ? "Immersion Paused..." : "Respond to the tutor..."} 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none focus:border-white/30 text-lg font-light transition-all disabled:opacity-30" 
              />
              <button 
                type="submit" 
                disabled={!textChoice.trim() || isPaused} 
                className="px-10 py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shrink-0 transition-transform active:scale-95 disabled:opacity-20"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      ` }} />
    </div>
  );
};

export default LanguageTutorView;
