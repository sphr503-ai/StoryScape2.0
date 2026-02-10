
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import Visualizer from './Visualizer';
import { Genre } from '../types';

// Workaround for JSX intrinsic elements errors in strictly typed environments
// By defining these as components, we bypass the JSX.IntrinsicElements lookup
const Primitive = 'primitive' as any;
const Group = 'group' as any;
const Mesh = 'mesh' as any;
const TorusGeometry = 'torusGeometry' as any;
const MeshBasicMaterial = 'meshBasicMaterial' as any;
const AmbientLight = 'ambientLight' as any;
const SpotLight = 'spotLight' as any;
const PointLight = 'pointLight' as any;

// A high-quality placeholder robot model from a public repository
const ROBOT_MODEL_URL = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/robot-girl/model.gltf';

// Separate 3D components to ensure hooks are used within <Canvas>
const SceneContent = () => {
  const { scene } = useGLTF(ROBOT_MODEL_URL);
  const robotRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (robotRef.current) {
      robotRef.current.rotation.y = t * 0.2; // Slow elegant rotation
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      ringRef.current.rotation.x = t * 0.2;
    }
  });

  return (
    <Suspense fallback={null}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        {/* Robotic Model */}
        <Primitive 
          ref={robotRef}
          object={scene} 
          scale={2.5} 
          position={[0, -1.8, 0]} 
        />
        
        {/* Holographic Neural Rings */}
        <Group ref={ringRef}>
          <Mesh rotation={[Math.PI / 2, 0, 0]}>
            <TorusGeometry args={[3, 0.015, 16, 100]} />
            <MeshBasicMaterial color="#22d3ee" transparent opacity={0.3} />
          </Mesh>
          <Mesh rotation={[0, Math.PI / 4, 0]}>
            <TorusGeometry args={[3.2, 0.01, 16, 100]} />
            <MeshBasicMaterial color="#d946ef" transparent opacity={0.2} />
          </Mesh>
        </Group>
      </Float>

      <ContactShadows 
        position={[0, -2.5, 0]} 
        opacity={0.4} 
        scale={20} 
        blur={2.4} 
        far={4.5} 
      />
      <Environment preset="city" />
    </Suspense>
  );
};

const VisionView: React.FC = () => {
  const [sysLog, setSysLog] = useState<string[]>([]);

  useEffect(() => {
    const logInterval = setInterval(() => {
      const logs = [
        "UPLINK_STABLE", "SYNC_ACTIVE", "DATA_STREAM_OK", "NEURAL_LINK_LOADED", 
        "OPTIC_ARRAY_READY", "CORE_HEAT_NOMINAL", "BIOMETRIC_CHECK_PASS", 
        "LATENCY_0.01ms", "MANIFEST_READY", "VISION_INIT_OK", "3D_RECON_SUCCESS"
      ];
      setSysLog(prev => [logs[Math.floor(Math.random() * logs.length)], ...prev].slice(0, 8));
    }, 1200);

    return () => clearInterval(logInterval);
  }, []);

  return (
    <div className="w-full max-w-6xl flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-1000 relative">
      <div className="relative w-full aspect-[4/5] md:aspect-[16/9] flex items-center justify-center overflow-hidden rounded-[3rem] md:rounded-[5rem] glass border-white/10 shadow-2xl bg-black/40 backdrop-blur-3xl">
        
        {/* Background Visualizer Layer */}
        <div className="absolute inset-0 z-0 opacity-30">
           <Visualizer 
            inputAnalyser={null} 
            outputAnalyser={null} 
            genre={Genre.SCIFI} 
            isPaused={false} 
            customOutputColor="#d946ef" 
            customInputColor="#22d3ee"
          />
        </div>

        {/* 3D Neural Viewport */}
        <div className="absolute inset-0 z-10">
          <Canvas shadows camera={{ position: [0, 0, 8], fov: 45 }}>
            <AmbientLight intensity={0.4} />
            <SpotLight 
              position={[10, 10, 10]} 
              angle={0.15} 
              penumbra={1} 
              intensity={2} 
              castShadow 
            />
            <PointLight position={[-10, -10, -10]} intensity={1} color="#d946ef" />
            <PointLight position={[0, 5, 0]} intensity={1.5} color="#22d3ee" />
            
            <SceneContent />
            
            <OrbitControls 
              enableZoom={false} 
              enablePan={false} 
              minPolarAngle={Math.PI / 3} 
              maxPolarAngle={Math.PI / 1.5} 
            />
          </Canvas>
        </div>

        {/* HUD UI Elements */}
        <div className="absolute inset-0 pointer-events-none z-20">
          
          {/* Vertical Data Stream Left */}
          <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col gap-2 font-hacker text-[7px] text-cyan-500/40 hidden md:flex">
             {sysLog.map((log, idx) => (
               <div key={idx} className="animate-in slide-in-from-left-2 fade-in">
                 <span className="opacity-40 mr-2">[{idx}]</span>
                 <span className="font-black">{log}</span>
               </div>
             ))}
          </div>

          {/* Vertical Data Stream Right */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col gap-2 font-hacker text-[7px] text-fuchsia-500/40 text-right hidden md:flex">
             {sysLog.map((log, idx) => (
               <div key={idx} className="animate-in slide-in-from-right-2 fade-in">
                 <span className="font-black">{log}</span>
                 <span className="opacity-40 ml-2">[{idx}]</span>
               </div>
             ))}
          </div>

          {/* HUD Corner Accents */}
          <div className="absolute top-10 left-10 w-16 h-16 border-t-2 border-l-2 border-cyan-500/30"></div>
          <div className="absolute top-10 right-10 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30"></div>
          <div className="absolute bottom-10 left-10 w-16 h-16 border-b-2 border-l-2 border-cyan-500/30"></div>
          <div className="absolute bottom-10 right-10 w-16 h-16 border-b-2 border-r-2 border-cyan-500/30"></div>

          {/* Bottom HUD Badges */}
          <div className="absolute bottom-12 left-12 space-y-4">
             <div className="flex items-center gap-4 bg-black/60 p-5 rounded-3xl border border-white/10 backdrop-blur-xl">
               <div className="flex gap-1.5">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="w-1.5 h-4 bg-cyan-500 shadow-[0_0_8px_#22d3ee] animate-pulse" style={{animationDelay: `${i*0.15}s`}}></div>)}
               </div>
               <div>
                 <p className="text-sm font-black text-white tracking-widest uppercase">MODEL_ALPHA_X</p>
                 <p className="text-[7px] font-black text-cyan-400 uppercase tracking-[0.4em] mt-0.5">NEURAL_MANIFEST: READY</p>
               </div>
             </div>
          </div>

          <div className="absolute bottom-12 right-12 text-right">
             <div className="bg-black/60 p-5 rounded-3xl border border-white/10 backdrop-blur-xl">
               <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 mb-1">Architecture_Log</p>
               <p className="text-lg font-black text-white tracking-tighter">HUMANOID_RBT_0.9.1</p>
             </div>
          </div>

          {/* Screen Overlay (Scanlines) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]"></div>
        </div>
      </div>

      <div className="mt-8 text-center max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Interaction Protocol</p>
        <p className="text-xs text-white/40 mt-2 font-medium">Click and drag to orbit model • Mouse scroll disabled for stability</p>
      </div>
    </div>
  );
};

export default VisionView;