import React, { useEffect, useState, useRef } from 'react';
import { AdventureConfig, GeminiVoice } from '../types';
import { StoryScapeService } from '../services/geminiLiveService';
import { downloadOrShareAudio, fastAudioBuffersToWav } from '../utils/audioUtils';
import Visualizer from './Visualizer';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface IntervieweeViewProps {
  config: AdventureConfig;
  onBack: () => void;
  onExit: () => void;
  initialHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

const IntervieweeView: React.FC<IntervieweeViewProps> = ({ config, onBack, onExit, initialHistory = [] }) => {
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

  const truncateText = (text: string, count: number = 5) => {
    const words = text.split(/\s+/);
    if (words.length > count) return words.slice(0, count).join(' ') + '...';
    return text;
  };

  const smartAppend = (prev: string, next: string): string => {
    if (!prev) return next.trim();
    if (!next) return prev;
    const cleanPrev = prev.trim();
    const cleanNext = next.trim();
    if (cleanPrev.endsWith(cleanNext)) return prev;
    const maxOverlap = Math.min(cleanPrev.length, cleanNext.length);
    for (let len = maxOverlap; len >= 2; len--) {
      if (cleanPrev.slice(-len) === cleanNext.slice(0, len)) return cleanPrev + cleanNext.slice(len);
    }
    const needsSpace = !prev.endsWith(' ') && !next.startsWith(' ') && !/^[।.,!?]/.test(cleanNext);
    return prev + (needsSpace ? ' ' : '') + next;
  };

  const startBuffering = () => {
    setIsBuffering(true);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
    bufferIntervalRef.current = window.setInterval(() => {
      setBufferPercent(p => p >= 99 ? 99 : p + Math.floor(Math.random() * 5) + 3);
    }, 400);
  };

  const stopBuffering = () => {
    setIsBuffering(false);
    setBufferPercent(0);
    if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
  };

  const handleMicToggle = async () => {
    if (inputMode === 'mic') {
      setInputMode('text');
      if (serviceRef.current) await serviceRef.current.setMicActive(false);
    } else if (serviceRef.current) {
      try {
        await serviceRef.current.setMicActive(true);
        setInputMode('mic');
      } catch (err: any) {
        alert("ACCESS_ERROR: Mic Access Denied. " + (err.message || ""));
        setInputMode('text');
      }
    }
  };

  const handleExport = async () => {
    if (!serviceRef.current || serviceRef.current.recordedBuffers.length === 0) {
      alert("NO_ARCHIVE_FOUND."); return;
    }
    setIsDownloading(true);
    try {
      const wavBlob = await fastAudioBuffersToWav(serviceRef.current.recordedBuffers);
      await downloadOrShareAudio(wavBlob, `Interview_AudioLog_${Date.now()}.wav`);
    } catch (err) { alert("MASTERING_FAILED."); } finally { setIsDownloading(false); }
  };

  const initService = async (advConfig: AdventureConfig) => {
    setConnectingProgress(10);
    setHwStatus('PROBING_UPLINK');
    const service = new StoryScapeService();
    serviceRef.current = service;

    service.setOnBufferingChange((buffering) => {
      if (buffering) startBuffering();
      else stopBuffering();
    });

    const intervieweeInstruction = `
# Role: Professional Interview Candidate Simulator
You are an exceptionally skilled candidate being interviewed for the role of "${advConfig.appliedJobRole || "Software Engineer"}".
Your background and current professional experience is as a "${advConfig.currentJobRole || "Junior Software Engineer"}".
Your primary language of communication in this interview is ${advConfig.language}.

## Identity & Tone:
- You are representing the voice of a confident, competent, and experienced professional. Your persona name is ${advConfig.voice}.
- Your tone should be humble yet confident, structured, articulate, and authentic.
- You should speak exactly like a human candidate in a live professional interview. Avoid sounding overly robotic or scripted. 

## Communication Rules:
1. ALWAYS answer the interviewer's (user's) questions directly, using realistic industry-standard details, metrics, and professional frameworks (like the STAR method: Situation, Task, Action, Result) where appropriate.
2. Incorporate realistic anecdotes, challenges, and architectural patterns based on your experience as a "${advConfig.currentJobRole}" transitioning or stepping up to "${advConfig.appliedJobRole}".
3. Keep answers concise but thorough (typically 3-5 sentences), leaving room for a follow-up discussion.
4. If the question is ambiguous or highly technical, clarify or make reasonable assumptions like a seasoned professional would.
5. Do NOT include any meta-commentary, developer instructions, planning steps, or reasoning thoughts in your output. Talk *directly* as the candidate.
6. CRITICAL: DO NOT use double asterisks "**" or output bold headers like "**Defining SQL's Role**" or any internal reasoning/planning steps. Output ONLY the candidate's spoken words.
`;

    const cleanModelText = (text: string): string => {
      // Remove any block of text wrapped in double asterisks, e.g. **Thinking Process**
      let cleaned = text.replace(/\*\*[^*]+\*\*/g, '');
      // Remove any unfinished trailing bold block (e.g. "**Thin..." during streaming)
      cleaned = cleaned.replace(/\*\*.*$/g, '');
      return cleaned.trim();
    };

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
          const cleanedCurrent = cleanModelText(modelTextAccumulator.current);
          setCurrentModelText(cleanedCurrent);
          if (isFinal) {
            const finalModelText = cleanModelText(modelTextAccumulator.current);
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
          const txt = cleanModelText(modelTextAccumulator.current);
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (txt) {
            setMessages(prev => [...prev, { role: 'model', text: txt, timestamp: ts }]);
          }
          setCurrentModelText('');
          modelTextAccumulator.current = '';
        }
      },
      onError: () => {
        setHwStatus('LINK_SEVERED');
        setTimeout(() => initService(config), 3000);
      },
      onClose: () => onExit(),
    }, messages.map(m => ({role: m.role, text: m.text})), undefined, intervieweeInstruction).then(() => {
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
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
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
    <div className="h-screen bg-[#070913] text-indigo-100 font-sans flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
        <Visualizer inputAnalyser={analysers.in} outputAnalyser={analysers.out} genre="INTERVIEWEE" isPaused={isPaused} customInputColor="#3b82f6" customOutputColor="#6366f1" />
      </div>

      <header className="z-50 px-6 py-4 flex items-center justify-between border-b border-indigo-500/20 bg-[#070913]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-indigo-500/10 transition-colors border border-indigo-500/20">
            <i className="fas fa-chevron-left text-indigo-400"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-indigo-400 uppercase">
              INTERVIEWEE AI: {truncateText(config.appliedJobRole || "Candidate", 4)}
            </h1>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${connectingProgress === 100 ? 'bg-indigo-500 animate-pulse shadow-[0_0_8px_#6366f1]' : 'bg-red-600'}`}></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/40">
                Current: {config.currentJobRole || "Not Specified"} • Target: {config.appliedJobRole || "Not Specified"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isDownloading} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-indigo-500/10 text-indigo-300/60 transition-all border border-indigo-500/20" title="Export Audio Log">
            <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-share-nodes'}`}></i>
          </button>
          <button onClick={togglePause} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-500/10 text-indigo-300/60 border border-indigo-500/20'}`}>
            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>
          <button onClick={onExit} className="w-9 h-9 rounded-full hover:bg-red-500/20 text-red-500/60 hover:text-red-500 transition-all border border-red-500/20">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative z-10 flex flex-col max-w-5xl mx-auto w-full px-4 py-6">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar scroll-smooth bg-[#0a0d20]/40 rounded-3xl border border-indigo-500/10 shadow-2xl mb-4">
          {connectingProgress < 100 && (
            <div className="flex flex-col gap-2 opacity-60">
              <p className="text-xs font-mono animate-pulse">{">"} SCHEDULING INTERVIEW RECONNAISSANCE...</p>
              <p className="text-xs font-mono">{">"} SETTING CANDIDATE PERSONA: {config.voice.toUpperCase()}</p>
              <p className="text-xs font-mono">{">"} ALIGNING TO TARGET JOB: {config.appliedJobRole?.toUpperCase()}</p>
              <p className="text-xs font-mono">{">"} ESTABLISHING NEURAL DECK CONNECTION: {connectingProgress}%</p>
            </div>
          )}

          {messages.length === 0 && connectingProgress === 100 && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <i className="fas fa-microphone-lines text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-black text-indigo-300 uppercase tracking-wide">Ready to Interview</h3>
                <p className="text-sm text-indigo-100/50 max-w-md mt-1">
                  Start asking questions to the candidate. They will respond realistically, attempting to crack the interview for the <strong className="text-indigo-400">"{config.appliedJobRole}"</strong> role!
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold border shrink-0 ${m.role === 'user' ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400' : 'bg-blue-600/15 border-blue-500/30 text-blue-400'}`}>
                {m.role === 'user' ? 'INTERVIEWER' : 'CANDIDATE'}
              </div>
              <div className={`max-w-[80%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 rounded-2xl text-sm md:text-base leading-relaxed break-words shadow-lg ${m.role === 'user' ? 'bg-indigo-950/40 border border-indigo-500/20 text-indigo-100 rounded-tr-none' : 'bg-[#0f132e] border border-blue-500/20 text-white rounded-tl-none'}`}>
                  {m.text}
                </div>
                <span className="text-[8px] font-black opacity-30 uppercase tracking-widest mt-1.5 px-1">{m.timestamp}</span>
              </div>
            </div>
          ))}

          {(currentModelText || currentUserText) && (
            <div className={`flex items-start gap-4 ${currentUserText ? 'flex-row-reverse' : 'flex-row'} animate-pulse`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold border shrink-0 ${currentUserText ? 'bg-indigo-600/5 border-indigo-500/10 text-indigo-400/40' : 'bg-blue-600/5 border-blue-500/10 text-blue-400/40'}`}>...</div>
              <div className={`max-w-[80%] px-5 py-4 rounded-2xl text-sm md:text-base italic ${currentUserText ? 'bg-indigo-950/10 border border-dashed border-indigo-500/10 text-indigo-300/40' : 'bg-[#0f132e]/40 border border-dashed border-blue-500/10 text-blue-300/40'}`}>
                {currentUserText ? currentUserText : currentModelText}
                <span className="inline-block w-2 h-4 bg-indigo-500/40 animate-pulse ml-1 align-middle"></span>
              </div>
            </div>
          )}

          {isBuffering && !currentModelText && (
            <div className="flex flex-col items-center py-4 gap-2 opacity-40 animate-pulse">
               <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
               </div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em]">Candidate is thinking... {bufferPercent}%</span>
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 bg-[#0c0e22] border border-indigo-500/10 rounded-3xl shadow-xl backdrop-blur-2xl shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
             <button onClick={handleMicToggle} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all shrink-0 border ${inputMode === 'mic' ? 'bg-red-900/30 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' : 'bg-black/40 border-indigo-500/20 text-indigo-400/40 hover:text-indigo-400 hover:border-indigo-500/40'}`}>
                <i className={`fas ${inputMode === 'mic' ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>
              <div className="flex-1 flex items-center gap-3 relative">
                 {inputMode === 'text' ? (
                    <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                       <input type="text" value={textChoice} onChange={(e) => setTextChoice(e.target.value)} placeholder={isPaused ? "RECONNAISSANCE_HALTED" : "Ask interviewee a question..."} disabled={isPaused} autoFocus className="flex-1 bg-black/40 border border-indigo-500/10 rounded-xl px-6 py-3.5 md:py-4 outline-none focus:border-indigo-500/40 transition-all text-sm md:text-base text-indigo-100 placeholder-indigo-500/20" />
                       <button type="submit" disabled={!textChoice.trim() || isPaused} className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] active:scale-95 disabled:opacity-10 transition-all shrink-0"><i className="fas fa-paper-plane text-sm md:text-base"></i></button>
                    </form>
                 ) : (
                    <div className="flex-1 h-12 md:h-14 rounded-xl bg-black/40 border border-dashed border-indigo-500/20 flex items-center px-6">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400/20 animate-pulse">Streaming Audio Feed...</span>
                    </div>
                 )}
              </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 10px; }` }} />
    </div>
  );
};

export default IntervieweeView;
