
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Optimized conversion: 1/32768 is approx 0.000030517578125
      channelData[i] = dataInt16[i * numChannels + channel] * 0.000030517578125;
    }
  }
  return buffer;
}

/**
 * Near-instant WAV conversion by direct buffer concatenation.
 * Bypasses OfflineAudioContext for maximum speed.
 */
export async function fastAudioBuffersToWav(buffers: AudioBuffer[]): Promise<Blob> {
  if (buffers.length === 0) return new Blob([], { type: "audio/wav" });

  const numChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;
  let totalFrames = 0;
  for (const b of buffers) totalFrames += b.length;

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = totalFrames * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF Header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, totalSize - 8, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // FMT chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit

  // DATA chunk
  view.setUint32(36, 0x64617461, false); // "data"
  // Fix: Use setUint32 to write the data size correctly.
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const buffer of buffers) {
    const channelData = buffer.getChannelData(0); // Assuming mono for speed/efficiency
    for (let i = 0; i < channelData.length; i++) {
      let sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * IndexedDB Live Cache Implementation
 */
const DB_NAME = 'StoryScapeCache';
const STORE_NAME = 'audioChunks';

export async function saveChunkToCache(sessionId: string, chunkId: number, data: Float32Array) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ id: `${sessionId}_${chunkId}`, sessionId, data });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function downloadOrShareAudio(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'audio/wav' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'StoryScape Export', text: 'Interactive Audio Log' });
      return;
    } catch (err) { console.warn("Share API failed", err); }
  }
  const url = URL.createObjectURL(blob);
  const link = document.body.appendChild(document.createElement('a'));
  link.href = url;
  link.download = filename;
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}