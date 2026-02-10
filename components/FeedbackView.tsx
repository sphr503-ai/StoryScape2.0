
import React, { useState, useEffect } from 'react';

interface FeedbackViewProps {
  onBack: () => void;
  onSecretAccess: () => void;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ onBack, onSecretAccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let timer: number;
    if (showSuccess && countdown > 0) {
      timer = window.setTimeout(() => setCountdown(prev => prev - 1), 1000);
    } else if (showSuccess && countdown === 0) {
      window.location.href = 'https://spapk.vercel.app/';
    }
    return () => clearTimeout(timer);
  }, [showSuccess, countdown]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    // SECRET CODE CHECK: Name + Email + Comment/Message (Case Insensitive)
    const secretName = 'codered#';
    const secretEmail = 'iambro@gm.com';
    const secretComment = 'bhai';

    if (
      String(data.name).toLowerCase().trim() === secretName && 
      String(data.email).toLowerCase().trim() === secretEmail && 
      String(data.message).toLowerCase().trim() === secretComment
    ) {
      setIsSubmitting(false);
      onSecretAccess();
      return;
    }

    try {
      await fetch("https://formsubmit.co/ajax/sphr504@gmail.com", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      setShowSuccess(true);
    } catch (err) {
      alert("Transmission failed. Please try again or check your neural link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020202] relative overflow-hidden font-hacker">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-red-500/5 blur-[120px] rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>

      {/* SUCCESS MODAL */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500">
           <div className="max-w-md w-full p-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full border-2 border-[#00ff41] flex items-center justify-center shadow-[0_0_30px_#00ff41]">
                   <i className="fas fa-check text-4xl text-[#00ff41]"></i>
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-[#00ff41] animate-ping opacity-20"></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black uppercase tracking-tighter text-white">Transmission Sealed</h3>
                <p className="text-[#00ff41] font-bold text-xs tracking-widest uppercase opacity-80">Data Packet Verified & Sent</p>
              </div>
              <div className="pt-4 space-y-6">
                <p className="text-white/40 text-[10px] uppercase tracking-[0.4em]">Redirecting to Neural Hub in {countdown}s...</p>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-[#00ff41] transition-all duration-1000 ease-linear shadow-[0_0_10px_#00ff41]" 
                     style={{ width: `${(countdown / 3) * 100}%` }}
                   ></div>
                </div>
              </div>
           </div>
        </div>
      )}

      <div className="max-w-2xl w-full glass-dark p-8 md:p-12 rounded-[3.5rem] border-white/10 space-y-10 z-10 animate-in fade-in zoom-in-95 duration-700 shadow-2xl relative">
        
        {/* Developer Profile Header */}
        <div className="flex flex-col items-center gap-6">
           <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-blue-600 rounded-full blur-[20px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-white/10 p-1.5 relative overflow-hidden bg-black/40 backdrop-blur-xl">
                 <img 
                   src="https://raw.githubusercontent.com/TechnoholicSP/CDN/main/tech_logo.png" 
                   alt="Technoholic$P Profile" 
                   className="w-full h-full object-contain rounded-full brightness-110 contrast-125"
                   onError={(e) => {
                     e.currentTarget.style.display = 'none';
                     const parent = e.currentTarget.parentElement;
                     if (parent) {
                        const icon = document.createElement('i');
                        icon.className = 'fas fa-shield-virus text-4xl text-blue-400 opacity-60';
                        parent.appendChild(icon);
                        parent.className += ' flex items-center justify-center';
                     }
                   }}
                 />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl">
                 Root_Dev
              </div>
           </div>
           
           <div className="text-center space-y-2">
             <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white leading-none">
               TECHNOHOLIC$P
             </h2>
             <p className="text-blue-400 uppercase tracking-[0.6em] text-[8px] font-black opacity-80">Follow The Truth</p>
           </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <form 
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <input type="text" name="_honey" style={{ display: 'none' }} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Subject Identifier</label>
              <input 
                type="text" 
                name="name" 
                required 
                placeholder="Name"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500/30 transition-all text-sm placeholder:opacity-20 shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Echo Frequency (Email)</label>
              <input 
                type="email" 
                name="email" 
                required 
                placeholder="Email Address"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500/30 transition-all text-sm placeholder:opacity-20 shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Narrative Feedback Packet</label>
            <textarea 
              name="message" 
              required 
              placeholder="Record your transmission here..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 min-h-[180px] outline-none focus:border-blue-500/30 transition-all text-sm placeholder:opacity-20 leading-relaxed shadow-inner resize-none"
            ></textarea>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full py-5 rounded-[1.5rem] md:rounded-[2rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] transition-all shadow-2xl active:scale-95 relative overflow-hidden group ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="absolute inset-0 bg-black/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
              <span className="relative">
                {isSubmitting ? 'Transmitting...' : 'Initiate Send'}
              </span>
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="w-full py-5 rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 text-white/40"
            >
              Abort Link
            </button>
          </div>
        </form>

        <div className="text-center pt-4">
          <p className="text-[8px] opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">
            Encrypted transmission via FormSubmit Protocol • Dest: sphr504@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;
