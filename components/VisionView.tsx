
import React, { useState, useEffect } from 'react';

const VisionView: React.FC = () => {
  const [isScanning, setIsScanning] = useState(true);
  const [glitchFactor, setGlitchFactor] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchFactor(Math.random() > 0.95 ? Math.random() : 0);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-6xl flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-1000 relative">
      <div className="relative w-full aspect-[4/5] md:aspect-[16/9] flex items-center justify-center overflow-hidden rounded-[3rem] md:rounded-[5rem] glass border-white/10 shadow-2xl">
        
        {/* Animated Background Grids */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        </div>

        {/* The Model Container */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          
          {/* Main Visual: Highly Stylized Robotic Figure */}
          <div className="relative w-full h-full max-w-2xl max-h-[80%] flex items-center justify-center group">
            
            {/* Holographic Glow Rings */}
            <div className="absolute w-[120%] h-[120%] border border-blue-500/10 rounded-full animate-[spin_20s_linear_infinite]"></div>
            <div className="absolute w-[110%] h-[110%] border border-fuchsia-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
            
            {/* The Image (Robotic Girl Visual) */}
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src="https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=1000"
                alt="Neural Vision Model"
                className={`w-auto h-full max-h-[90vh] object-contain object-center mix-blend-screen transition-all duration-700 brightness-110 contrast-125
                  ${glitchFactor > 0 ? 'skew-x-2' : ''} 
                  group-hover:scale-[1.02]
                `}
                style={{
                  filter: `drop-shadow(0 0 30px rgba(192, 38, 211, 0.4)) hue-rotate(${glitchFactor * 360}deg)`
                }}
              />

              {/* Scanline Overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                   <div className="w-full h-1 bg-cyan-400/30 shadow-[0_0_20px_#22d3ee] absolute top-0 animate-[scanner_4s_ease-in-out_infinite]"></div>
                </div>
              )}

              {/* Data Node Tags (Floating UI) */}
              <div className="absolute top-[20%] left-[-10%] glass-dark px-4 py-2 rounded-full border border-blue-500/30 animate-float">
                <span className="text-[8px] font-black tracking-widest text-blue-400 uppercase">Neural_Core: 98%</span>
              </div>
              <div className="absolute bottom-[30%] right-[-5%] glass-dark px-4 py-2 rounded-full border border-fuchsia-500/30 animate-float" style={{animationDelay: '-2s'}}>
                <span className="text-[8px] font-black tracking-widest text-fuchsia-400 uppercase">Optic_Sync: Active</span>
              </div>
              <div className="absolute top-[50%] right-[-15%] glass-dark px-4 py-2 rounded-full border border-white/20 animate-float" style={{animationDelay: '-4s'}}>
                <span className="text-[8px] font-black tracking-widest text-white/40 uppercase">Vocal_Path: Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* UI HUD Elements */}
        <div className="absolute bottom-12 left-12 z-30 space-y-2 pointer-events-none">
           <div className="flex items-center gap-3">
             <div className="w-10 h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
             <span className="text-[10px] font-black uppercase tracking-widest opacity-40">System_Health</span>
           </div>
           <p className="text-xl font-black uppercase text-white/80">V_MODEL_092_PROTO</p>
        </div>

        <div className="absolute bottom-12 right-12 z-30 text-right pointer-events-none">
           <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Architecture</p>
           <p className="text-xs font-bold text-white/40 uppercase">Quantum_Neural_Network</p>
        </div>

        {/* Aesthetic Glitch Text */}
        <div className="absolute top-12 left-12 z-30 opacity-20 pointer-events-none">
          <p className="text-[6px] font-mono leading-tight">
            RUN_SCAN_START<br/>
            MEMORY_BUFFER_LOAD: OK<br/>
            NEURAL_WEIGHTS_SYNC: 1.0.4<br/>
            EMOTION_CHIP_STATUS: STANDBY<br/>
            DIRECT_UPLINK: ESTABLISHED
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanner {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-15px) translateX(10px); }
        }
      ` }} />
    </div>
  );
};

export default VisionView;
