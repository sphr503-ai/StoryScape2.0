/// <reference types="@react-three/fiber" />
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import Visualizer from './Visualizer';
import { Genre } from '../types';

// A high-quality placeholder robot model from a public repository
const ROBOT_MODEL_URL = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/robot-girl/model.gltf';

const RobotModel = () => {
  const { scene } = useGLTF(ROBOT_MODEL_URL);
  const robotRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (robotRef.current) {
      robotRef.current.rotation.y += 0.005; // Continuous rotation
    }
  });

  return (
    /* Use primitive to inject the GLTF scene into the Three.js hierarchy */
    <primitive 
      ref={robotRef}
      object={scene} 
      scale={2.5} 
      position={[0, -1.5, 0]} 
      rotation={[0, 0, 0]}
    />
  );
};

const HolographicRings = () => {
  const ringRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.01;
      ringRef.current.rotation.x += 0.005;
    }
  });

  return (
    <group ref={ringRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.02, 16, 100]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.2} />
      </mesh>
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <torusGeometry args={[3.2, 0.01, 16, 100]} />
        <meshBasicMaterial color="#d946ef" transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

const VisionView: React.FC = () => {
  const [sysLog, setSysLog] = useState<string[]>([]);

  useEffect(() => {
    const logInterval = setInterval(() => {
      const logs = [
        "UPLINK_STABLE", "SYNC_ACTIVE", "DATA_STREAM_OK", "NEURAL_LINK_LOADED", 
        "OPTIC_ARRAY_READY", "CORE_HEAT_NOMINAL", "BIOMETRIC_CHECK_PASS", 
        "LATENCY_0.02ms", "BUFFER_CLEAN", "MANIFEST_READY", "VISION_INIT_OK"
      ];
      setSysLog(prev => [logs[Math.floor(Math.random() * logs.length)], ...prev].slice(0, 8));
    }, 1200);

    return () => clearInterval(logInterval);
  }, []);

  return (
    <div className="w-full max-w-6xl flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-1000 relative">
      <div className="relative w-full aspect-[4/5] md:aspect-[16/9] flex items-center justify-center overflow-hidden rounded-[3rem] md:rounded-[5rem] glass border-white/10 shadow-2xl bg-black/40 backdrop-blur-3xl">
        
        {/* Cinematic Visualizer Background Layer */}
        <div className="absolute inset-0 z-0 opacity-40">
           <Visualizer 
            inputAnalyser={null} 
            outputAnalyser={null} 
            genre={Genre.SCIFI} 
            isPaused={false} 
            customOutputColor="#d946ef" 
            customInputColor="#22d3ee"
          />
        </div>

        {/* 3D Scene Container */}
        <div className="absolute inset-0 z-10">
          <Canvas shadows camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#d946ef" />
            <pointLight position={[0, 5, 0]} intensity={1.5} color="#22d3ee" />
            
            <Suspense fallback={null}>
              <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                <RobotModel />
                <HolographicRings />
              </Float>
              <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
              <Environment preset="city" />
            </Suspense>
            
            <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.5} />
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

          {/* Bottom Left Status */}
          <div className="absolute bottom-12 left-12 space-y-4">
             <div className="flex items-center gap-4 bg-black/60 p-5 rounded-3xl border border-white/10 backdrop-blur-xl">
               <div className="flex gap-1.5">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="w-1.5 h-4 bg-cyan-500 shadow-[0_0_8px_#22d3ee] animate-pulse" style={{animationDelay: `${i*0.15}s`}}></div>)}
               </div>
               <div>
                 <p className="text-sm font-black text-white tracking-widest uppercase">V_SAGA_UNIT_71</p>
                 <p className="text-[7px] font-black text-cyan-400 uppercase tracking-[0.4em] mt-0.5">3D_NEURAL_MANIFEST: ACTIVE</p>
               </div>
             </div>
          </div>

          {/* Bottom Right HUD */}
          <div className="absolute bottom-12 right-12 text-right">
             <div className="bg-black/60 p-5 rounded-3xl border border-white/10 backdrop-blur-xl">
               <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 mb-1">Architecture_Manifest</p>
               <p className="text-lg font-black text-white tracking-tighter">HUMANOID_RBT_0.9.1</p>
             </div>
          </div>

          {/* Scanline Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]"></div>
          
          {/* Corner Decors */}
          <div className="absolute top-10 left-10 w-16 h-16 border-t-2 border-l-2 border-cyan-500/30"></div>
          <div className="absolute top-10 right-10 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30"></div>
          <div className="absolute bottom-10 left-10 w-16 h-16 border-b-2 border-l-2 border-cyan-500/30"></div>
          <div className="absolute bottom-10 right-10 w-16 h-16 border-b-2 border-r-2 border-cyan-500/30"></div>
        </div>
      </div>

      <div className="mt-8 text-center max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Interaction Protocol</p>
        <p className="text-xs text-white/40 mt-2 font-medium">Mouse click and drag to orbit model • Neural sync active</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanner {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        @keyframes gridmove {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
      ` }} />
    </div>
  );
};

export default VisionView;