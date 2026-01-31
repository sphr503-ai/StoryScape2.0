
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
  const [isInputActive, setIsInputActive] = useState(false);
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
        alert("Microphone access denied or unavailable.");
        setInputMode('text');
      }
    }
  };

  const cleanText = (text: string): string => {
    return text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(5);
    if (serviceRef.current) await serviceRef.current.stopAdventure();
    
    const service = new StoryScapeService();
    serviceRef.current = service;

    setConnectingProgress(15);
    const tutorInstruction = `
# Role: AI Language Speaking Tutor
You are an advanced, empathetic, and interactive AI Language Tutor.

## Objective
Engage the user in spoken-style conversation based on their goals. 
STRICTLY follow these rules for EVERY turn:

1. **Onboarding (Phase 1):** If the history is empty, ask:
   - What is your Target Language?
   - What is your Native Language?
   - Level: [ Beginner ] [ Intermediate ] [ Advanced ]
   - Goal: [ Partner/Dating ] [ Personal ] [ Academic ] [ Business ] [ Interview ]

2. **Correction Needed Protocol (Phase 2):** 
   IF the user makes any grammar, tense, or vocabulary mistake, STOP the flow and output EXACTLY:
   > **🛑 Correction Needed:**
   > * **Your Input:** "[Quote mistake]"
   > * **Correction:** "[Correct version]"
   > * **Analysis:** [Brief explanation of error]
   > * **Meaning (in Native Language):** [Translation]
   >
   > **🎙️ Action:** Please repeat the correct sentence.

3. **General Behavior:**
   - Tone: Encouraging but strict.
   - Reply naturally but concise (1-2 sentences).
   - If user is correct, occasionally explain an advanced vocab word.
   - Target Language: ${advConfig.language}. Focus: ${advConfig.topic}.
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcriptions, currentModelText]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textChoice.trim() || !serviceRef.current || isPaused) return;
    setTranscriptions(prev => [...prev, { role: 'user', text: textChoice.trim() }]);
    serviceRef.current.sendTextChoice(textChoice.trim());
    setTextChoice('');
    startBuffering();
  };

  const handleSaveDraft = () => {
    localStorage.setItem('storyscape_saved_session', JSON.stringify({ config, transcriptions }));
    onExit();
  };

  const handleExitAndClear = () => {
    localStorage.removeItem('storyscape_saved_session');
    onExit();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-[#020512] text-indigo-50 font-sans flex flex-col p-4 md:p-8 overflow-hidden relative">
      <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre={Genre.DOCUMENTARY} isPaused={isPaused} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-400 uppercase">TUTOR: {config.topic}</h1>
          <p className="text-[10px] opacity-60 uppercase tracking-widest font-black text-indigo-300">Target: {config.language} • {formatTime(secondsRemaining)} Remaining</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveDraft} className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
            <i className="fas fa-save text-[10px]"></i> Save Draft
          </button>
          <button onClick={handleExitAndClear} className="px-6 py-2.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/10 font-black text-xs uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-stop text-[10px]"></i> Exit
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full glass rounded-[3rem] overflow-hidden shadow-2xl relative border-indigo-500/10 z-10 bg-black/40">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth custom-scrollbar relative bg-black/20">
          
          {(connectingProgress < 100 || isBuffering) && (
            <div className="absolute inset-x-0 top-0 bottom-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8 text-center px-12 pointer-events-none">
               <div className="relative">
                 <div className="w-36 h-36 border-[6px] border-indigo-900/20 border-t-indigo-500 rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-3xl text-indigo-400">
                   {isBuffering ? bufferPercent : connectingProgress}%
                 </div>
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black uppercase tracking-[0.3em] text-indigo-400">
                   {connectingProgress < 100 ? 'Calibrating Neural Voice...' : 'Analyzing Speech Context...'}
                 </h3>
                 <p className="text-[10px] opacity-40 uppercase tracking-widest">Ensuring stable linguistic connection</p>
               </div>
            </div>
          )}

          {transcriptions.length === 0 && connectingProgress === 100 && (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center space-y-4">
               <i className="fas fa-comment-dots text-6xl"></i>
               <p className="text-xs font-black uppercase tracking-widest">Waiting for Sensei to Begin...</p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] shadow-xl ${t.role === 'user' ? 'bg-indigo-500/10 border border-indigo-500/20 rounded-tr-none' : 'bg-black/40 border border-indigo-500/10 rounded-tl-none'}`}>
                <p className="text-[9px] text-indigo-500 opacity-60 mb-2 uppercase tracking-[0.4em] font-black">{t.role === 'user' ? 'Student' : 'Sensei'}</p>
                <div className="text-lg md:text-xl leading-relaxed font-light whitespace-pre-wrap">{t.text}</div>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex ${currentUserText ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] ${currentUserText ? 'bg-indigo-500/5' : 'bg-black/20'} animate-pulse`}>
                <p className="text-lg md:text-xl italic opacity-50">{currentModelText || currentUserText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 glass border-t border-indigo-500/10 flex flex-col gap-6 bg-black/60 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <button 
                onClick={handleMicToggle}
                className={`flex items-center gap-4 px-8 py-4 rounded-full border transition-all ${inputMode === 'mic' ? 'bg-indigo-600 text-white' : 'glass border-indigo-500/20 text-indigo-400 hover:bg-white/5'}`}
            >
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-keyboard'}`}></i>
                <span className="text-xs font-black uppercase">{inputMode === 'mic' ? 'Mic Active' : 'Switch to Mic'}</span>
            </button>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${inputMode === 'mic' ? 'bg-indigo-500 animate-pulse shadow-[0_0_15px_#6366f1]' : 'bg-white/10'}`}></div>
              <button onClick={() => setIsPaused(!isPaused)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-indigo-600 text-white' : 'glass border-indigo-500/20 hover:bg-white/5'}`}>
                  <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
              </button>
            </div>
          </div>

          {inputMode === 'text' && (
            <form onSubmit={handleTextSubmit} className="flex gap-4">
              <input 
                type="text" 
                value={textChoice} 
                onChange={(e) => setTextChoice(e.target.value)} 
                placeholder="Practice your Target Language here..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none focus:border-indigo-500/30 text-lg transition-all"
              />
              <button type="submit" disabled={!textChoice.trim()} className="px-10 rounded-2xl bg-indigo-500 text-white font-black uppercase text-xs hover:bg-indigo-400 transition-all disabled:opacity-30">Send</button>
            </form>
          )}
          
          {inputMode === 'mic' && (
            <div className="py-6 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex flex-col items-center gap-2 animate-pulse">
               <i className="fas fa-waveform text-indigo-400"></i>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Streaming Real-time Vocal Input</span>
            </div>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default LanguageTutorView;
