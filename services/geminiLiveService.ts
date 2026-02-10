
import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { Genre, GeminiVoice, AdventureConfig, NarratorMode, LoreData } from '../types';

export class StoryScapeService {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isPaused: boolean = false;
  private isMicActive: boolean = false;
  
  public recordedBuffers: AudioBuffer[] = [];
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;

  constructor() {
    // ai will be initialized in startAdventure to ensure fresh API key
  }

  async fetchTrendingTopic(genre: Genre, mode: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Find a single, currently popular or trending ${genre} ${mode === 'explainer' ? 'movie' : 'topic for a podcast'}. 
    Return ONLY the title or name, nothing else. No punctuation, no quotes. 
    Make it interesting and randomized. Pull from recent news or classic viral mysteries.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }],
          temperature: 1.0 
        },
      });
      const text = response.text || "";
      return text.trim().replace(/^"|"$/g, '') || "The Unknown Anomaly";
    } catch (err) {
      const fallbackTopics = ["The Dyatlov Pass", "Interstellar", "Ancient Mars Structures", "The Matrix", "Cicada 3301"];
      return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    }
  }

  async fetchLore(config: AdventureConfig): Promise<LoreData> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isExplainer = config.durationMinutes !== undefined; 
    const prompt = isExplainer 
      ? `Act as a Professional Film Historian. Verify movie: "${config.topic}". Provide summary, key characters, ending meaning, Year, Director. Format: [METADATA], [PLOT], [ENDING], [THEMES].`
      : `Act as a Cinematic Research Assistant. For a ${config.genre} about "${config.topic}", search real-world facts. Lore Manifest format.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const manifest = response.text || "Standard lore protocols engaged.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title || "Archive Source", uri: c.web.uri }));
      let verifiedMetadata = undefined;
      if (isExplainer) {
        const yearMatch = manifest.match(/(\b19\d{2}\b|\b20\d{2}\b)/);
        verifiedMetadata = { title: config.topic, year: yearMatch ? yearMatch[0] : "Unknown Year", director: "Verified Director", genre: config.genre };
      }
      return { manifest, sources, verifiedMetadata };
    } catch (err) {
      return { manifest: "Standard lore protocols engaged.", sources: [] };
    }
  }

  async startAdventure(
    config: AdventureConfig,
    callbacks: {
      onTranscriptionUpdate: (role: 'user' | 'model', text: string, isFinal: boolean) => void;
      onError: (err: any) => void;
      onClose: () => void;
      onTurnComplete?: () => void;
    },
    history?: Array<{role: 'user' | 'model', text: string}>,
    lore?: LoreData,
    customSystemInstruction?: string
  ) {
    // Initialize fresh AI client right before connection
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.outputAnalyser.fftSize = 256;

    const { genre, topic, language, voice } = config;
    const lastTurn = history && history.length > 0 ? history[history.length - 1].text : "";
    const contextSummary = lastTurn 
      ? `Resume session: ${topic} in ${language}. Previous state: "${lastTurn}".`
      : `Begin session: ${topic} in ${language}. Welcome the user.`;

    const systemInstruction = customSystemInstruction || `You are a Narrator for a ${genre} tale in ${language}. Voice: ${voice}.`;

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log("WebSocket link opened.");
        },
        onmessage: async (message: LiveServerMessage) => {
          if (this.isPaused) return;
          
          const modelTurn = message.serverContent?.modelTurn;
          const inputTranscription = message.serverContent?.inputTranscription;
          const outputTranscription = message.serverContent?.outputTranscription;
          const turnComplete = !!message.serverContent?.turnComplete;
          const interrupted = !!message.serverContent?.interrupted;

          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData?.data) {
                this.handleAudioOutput(part.inlineData.data);
              }
              if (part.text) {
                callbacks.onTranscriptionUpdate('model', part.text, turnComplete);
              }
            }
          }

          // Crucial: Pass transcription even if text is empty to signal the UI to flush its buffers if isFinal/turnComplete
          if (inputTranscription) {
            callbacks.onTranscriptionUpdate('user', inputTranscription.text || '', turnComplete);
          }
          
          if (outputTranscription) {
            callbacks.onTranscriptionUpdate('model', outputTranscription.text || '', turnComplete);
          }

          if (turnComplete) {
            callbacks.onTurnComplete?.();
          }

          if (interrupted) this.stopAllAudio();
        },
        onerror: (e: any) => callbacks.onError(e),
        onclose: () => callbacks.onClose(),
      },
    });

    const session = await this.sessionPromise;
    session.sendRealtimeInput({ text: contextSummary });
  }

  public async setMicActive(active: boolean) {
    this.isMicActive = active;
    if (!this.inputAudioContext || !this.sessionPromise) return;
    
    if (this.inputAudioContext.state === 'suspended') {
      await this.inputAudioContext.resume();
    }
    if (this.outputAudioContext && this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }

    if (active) {
      if (!this.stream) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = this.inputAudioContext.createMediaStreamSource(this.stream);
          this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          this.scriptProcessor.onaudioprocess = (e) => {
            if (this.isPaused || !this.isMicActive || !this.sessionPromise) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = this.createBlob(inputData);
            
            this.sessionPromise!.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          source.connect(this.inputAnalyser!);
          this.inputAnalyser!.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioContext.destination);
        } catch (err) {
          this.isMicActive = false;
          throw err;
        }
      }
    } else {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }
    }
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
    }
    return { 
      data: encode(new Uint8Array(int16.buffer)), 
      mimeType: 'audio/pcm;rate=16000' 
    };
  }

  public static async generateSummary(genre: Genre, history: Array<{role: 'user' | 'model', text: string}>): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const transcript = history.map(h => `${h.role}: ${h.text}`).join('\n');
    try {
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Provide a cinematic closing statement for this adventure: \n${transcript}` 
      });
      return response.text || "The journey ends.";
    } catch (err) {
      return "The chronicle concludes.";
    }
  }

  private async handleAudioOutput(base64: string) {
    if (!this.outputAudioContext || this.isPaused) return;
    
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }

    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    const buf = await decodeAudioData(decode(base64), this.outputAudioContext, 24000, 1);
    this.recordedBuffers.push(buf);
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buf;
    if (this.outputAnalyser) {
      source.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);
    }
    source.start(this.nextStartTime);
    this.nextStartTime += buf.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  private stopAllAudio() {
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.nextStartTime = 0;
  }

  async stopAdventure() {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      await session.close();
    }
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stopAllAudio();
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
  }

  public sendTextChoice(text: string) { 
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.sendRealtimeInput({ text }));
    }
  }
  
  public setPaused(paused: boolean) { 
    this.isPaused = paused; 
    if (paused) this.stopAllAudio(); 
  }
}
