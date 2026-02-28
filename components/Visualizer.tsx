
import React, { useEffect, useRef } from 'react';
import { Genre } from '../types';

interface VisualizerProps {
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  genre: Genre | 'TUTOR';
  isPaused?: boolean;
  customInputColor?: string;
  customOutputColor?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  inputAnalyser, 
  outputAnalyser, 
  genre, 
  isPaused = false,
  customInputColor,
  customOutputColor
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const inputDataArray = new Uint8Array(inputAnalyser?.frequencyBinCount || 0);
    const outputDataArray = new Uint8Array(outputAnalyser?.frequencyBinCount || 0);

    let smoothedInputVol = 0;
    let smoothedOutputVol = 0;

    const render = (now: number) => {
      const deltaTime = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      if (isPaused) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, width, height);

      if (inputAnalyser) inputAnalyser.getByteFrequencyData(inputDataArray);
      if (outputAnalyser) outputAnalyser.getByteFrequencyData(outputDataArray);

      // Average volumes
      const inputVol = inputDataArray.length ? inputDataArray.reduce((a, b) => a + b) / inputDataArray.length : 0;
      const outputVol = outputDataArray.length ? outputDataArray.reduce((a, b) => a + b) / outputDataArray.length : 0;
      
      // Smooth volumes
      smoothedInputVol += (inputVol - smoothedInputVol) * 0.15;
      smoothedOutputVol += (outputVol - smoothedOutputVol) * 0.15;
      
      const mainVol = Math.max(smoothedInputVol, smoothedOutputVol);

      const activityFactor = 1 + (mainVol / 64); 
      timeRef.current += deltaTime * activityFactor;
      const t = timeRef.current;

      if (genre === 'TUTOR') {
        drawTutorWaves(ctx, width, height, inputDataArray, outputDataArray, t);
      } else {
        switch (genre) {
          case Genre.FANTASY:
            drawFantasy(ctx, width, height, mainVol, t);
            break;
          case Genre.SCIFI:
            drawSciFi(ctx, width, height, outputDataArray, inputDataArray, t);
            break;
          case Genre.MYSTERY:
            drawMystery(ctx, width, height, mainVol, t);
            break;
          case Genre.HORROR:
            drawHorror(ctx, width, height, mainVol, t);
            break;
          default:
            drawSciFi(ctx, width, height, outputDataArray, inputDataArray, t);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    function drawTutorWaves(ctx: CanvasRenderingContext2D, w: number, h: number, input: Uint8Array, output: Uint8Array, t: number) {
      // Draw Output (Tutor) - BLUE
      if (output.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = customOutputColor || '#3b82f6'; // Default blue
        ctx.lineWidth = 3;
        const sliceWidth = w / output.length;
        let x = 0;
        for (let i = 0; i < output.length; i++) {
          const v = output[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, h/2 + y);
          else ctx.lineTo(x, h/2 + y);
          x += sliceWidth;
        }
        ctx.stroke();
      }

      // Draw Input (User) - RED
      if (input.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = customInputColor || '#ef4444'; // Default red
        ctx.lineWidth = 3;
        const sliceWidth = w / input.length;
        let x = 0;
        for (let i = 0; i < input.length; i++) {
          const v = input[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, h/2 - y);
          else ctx.lineTo(x, h/2 - y);
          x += sliceWidth;
        }
        ctx.stroke();
      }
    }

    function drawFantasy(ctx: CanvasRenderingContext2D, w: number, h: number, vol: number, t: number) {
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = 60 + vol * 0.5;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 3);
      grad.addColorStop(0, `rgba(251, 191, 36, ${0.05 + vol / 500})`);
      grad.addColorStop(0.5, `rgba(251, 191, 36, ${0.01 + vol / 1000})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawSciFi(ctx: CanvasRenderingContext2D, w: number, h: number, out: Uint8Array, inp: Uint8Array, t: number) {
      const barCount = 60;
      const barWidth = w / barCount;
      ctx.save();
      for (let i = 0; i < barCount; i++) {
        const val = out[i % out.length] || inp[i % inp.length] || 0;
        const barHeight = (val / 255) * h * 0.7;
        const hue = 180 + Math.sin(t * 0.5) * 20;
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${0.1 + val / 512})`;
        ctx.fillRect(i * barWidth, h/2 - barHeight/2, barWidth - 2, barHeight);
      }
      ctx.restore();
    }

    function drawMystery(ctx: CanvasRenderingContext2D, w: number, h: number, vol: number, t: number) {
      const centerX = w / 2;
      const centerY = h / 2;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const rotation = t * (0.2 + i * 0.1);
        const opacity = (0.05 + (vol / 400)) / (i + 1);
        ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
        const rx = (80 + i * 60) + (vol * 0.3);
        const ry = (40 + i * 30) + (vol * 0.15);
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rx, ry, rotation, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawHorror(ctx: CanvasRenderingContext2D, w: number, h: number, vol: number, t: number) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.1 + vol / 200})`;
      ctx.lineWidth = 1 + vol / 100;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x += 10) {
        const noise = (Math.sin(x * 0.05 + t * 5) * Math.cos(x * 0.02 - t * 2)) * vol * 0.8;
        const y = h / 2 + noise;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [inputAnalyser, outputAnalyser, genre, isPaused]);

  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full pointer-events-none mix-blend-screen transition-opacity duration-700 ${isPaused ? 'opacity-20 grayscale' : 'opacity-100'}`} />;
};

export default Visualizer;
