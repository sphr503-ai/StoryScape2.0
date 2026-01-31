
import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { Genre, GeminiVoice, AdventureConfig, NarratorMode } from '../types';

export interface LoreData {
  manifest: string;
  sources: Array<{ title: string; uri: string }>;
  verifiedMetadata?: {
    title: string;
    year: string;
    director: string;
    genre: string;
  };
}

export class StoryScapeService {
  private ai: GoogleGenAI;
  private session: any;
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
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Fetches real-world data and cinematic lore using Google Search grounding.
   * Improved for Movie Explainer to ensure the CORRECT movie is identified.
   */
  async fetchLore(config: AdventureConfig): Promise<LoreData> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // For Movie Explainers, we need high precision
    const isExplainer = config.durationMinutes !== undefined; 
    
    const prompt = isExplainer 
      ? `Act as a Professional Film Historian. 
         Step 1: SEARCH and VERIFY the exact movie titled "${config.topic}". 
         Step 2: Provide a comprehensive plot summary, key characters, the ending's meaning, and production details (Year, Director). 
         Ensure you are NOT mixing it up with similarly titled films.
         If there are multiple versions, explain the most popular or the recent one.
         FORMAT the response with clear sections: [METADATA], [PLOT], [ENDING], [THEMES].`
      : `Act as a Cinematic Research Assistant. For a ${config.genre} adventure about "${config.topic}", 
         search for real-world historical facts, scientific data, geographic details, and current events. 
         Summarize into a "Lore Manifest".`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const manifest = response.text || "Standard lore protocols engaged.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((c: any) => c.web)
        .map((c: any) => ({
          title: c.web.title || "Archive Source",
          uri: c.web.uri,
        }));

      // Basic metadata extraction from text if possible
      let verifiedMetadata = undefined;
      if (isExplainer) {
        const yearMatch = manifest.match(/(\b19\d{2}\b|\b20\d{2}\b)/);
        verifiedMetadata = {
          title: config.topic,
          year: yearMatch ? yearMatch[0] : "Unknown Year",
          director: "Various", // Could refine with more complex parsing if needed
          genre: config.genre
        };
      }

      return { manifest, sources, verifiedMetadata };
    } catch (err) {
      console.error("Lore fetch failed:", err);
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
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.outputAnalyser.fftSize = 256;

    const { genre, topic, language, voice, mode } = config;

    const lastTurn = history && history.length > 0 ? history[history.length - 1].text : "";
    const contextSummary = lastTurn 
      ? `The story is in progress. Last event: "${lastTurn}". Resume precisely without repeat.`
      : `Begin a new ${genre} saga about: ${topic}.`;

    const loreInclusion = lore ? `
    LORE MANIFEST (STRICTLY ADHERE TO THESE SEARCHED FACTS):
    ${lore.manifest}
    ` : "";

    const defaultInstruction = `You are a legendary cinematic narrator telling a story in ${language}.
    
    STRICT GRAMMAR & FLOW RULES:
    1. CORRECT SPACING: No merged words.
    2. NO REPETITION: Do not double phrases.
    3. SEAMLESS CONTINUITY: If interrupted, resume smoothly without restating the start.
    4. NO STUTTERING: Professional audiobook quality.
    
    ${loreInclusion}

    Narrative Style: ${mode === NarratorMode.MULTI ? "Distinct character voices and high emotion." : "Atmospheric, deep, and mesmerizing."}
    Genre: ${genre}.
    Topic: ${topic}.`;

    const systemInstruction = customSystemInstruction || defaultInstruction;

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          sessionPromise.then(s => s.sendRealtimeInput({ text: contextSummary }));
        },
        onmessage: async (message: LiveServerMessage) => {
          if (this.isPaused) return;
          const b64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (b64) this.handleAudioOutput(b64);

          if (message.serverContent?.inputTranscription) {
            callbacks.onTranscriptionUpdate('user', message.serverContent.inputTranscription.text || '', !!message.serverContent.turnComplete);
          }
          if (message.serverContent?.outputTranscription) {
            callbacks.onTranscriptionUpdate('model', message.serverContent.outputTranscription.text || '', !!message.serverContent.turnComplete);
          }
          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete?.();
          }
          if (message.serverContent?.interrupted) this.stopAllAudio();
        },
        onerror: (e: any) => callbacks.onError(e),
        onclose: () => callbacks.onClose(),
      },
    });

    this.session = await sessionPromise;
  }

  public async setMicActive(active: boolean) {
    this.isMicActive = active;
    if (active) {
      if (!this.stream) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = this.inputAudioContext!.createMediaStreamSource(this.stream);
          this.scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
          this.scriptProcessor.onaudioprocess = (e) => {
            if (this.isPaused || !this.isMicActive) return;
            if (this.session) {
              this.session.sendRealtimeInput({ media: this.createBlob(e.inputBuffer.getChannelData(0)) });
            }
          };
          source.connect(this.inputAnalyser!);
          this.inputAnalyser!.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioContext!.destination);
        } catch (err) {
          console.error("Mic access error:", err);
          this.isMicActive = false;
          throw err;
        }
      }
    }
  }

  private createBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  }

  public static async generateSummary(genre: Genre, history: Array<{role: 'user' | 'model', text: string}>, retryCount = 0): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const transcript = history.map(h => `${h.role}: ${h.text}`).join('\n');
    const prompt = `Condense this saga into a short legend. Avoid repetitions: \n${transcript}`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || "...";
    } catch (err: any) {
      if ((err.message?.includes('429') || err.message?.toLowerCase().includes('quota')) && retryCount < 3) {
        await new Promise(r => setTimeout(r, 10000));
        return this.generateSummary(genre, history, retryCount + 1);
      }
      return "The chronicle concludes.";
    }
  }

  private async handleAudioOutput(base64: string) {
    if (!this.outputAudioContext || this.isPaused) return;
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
    if (this.session) await this.session.close();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stopAllAudio();
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
  }

  public sendTextChoice(text: string) { 
    if (this.session) {
      this.session.sendRealtimeInput({ text }); 
    }
  }
  
  public setPaused(paused: boolean) { 
    this.isPaused = paused; 
    if (paused) this.stopAllAudio(); 
  }
}
