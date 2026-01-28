
import React from 'react';

interface FeedbackViewProps {
  onBack: () => void;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0a] relative overflow-hidden font-hacker">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full"></div>

      <div className="max-w-2xl w-full glass p-8 md:p-12 rounded-[3.5rem] border-white/10 space-y-10 z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">
            Transmissions
          </h2>
          <p className="text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">Feedback Loop & Support</p>
        </div>

        <form 
          action="https://formsubmit.co/sphr504@gmail.com" 
          method="POST"
          className="space-y-6"
        >
          {/* FormSubmit.co Config */}
          <input type="hidden" name="_next" value="https://spapk.vercel.app/" />
          <input type="hidden" name="_subject" value="New StoryScape Feedback!" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_captcha" value="false" />

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Identify Yourself</label>
            <input 
              type="text" 
              name="name" 
              required 
              placeholder="Explorer Name"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all text-sm placeholder:opacity-20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Return Frequency (Email)</label>
            <input 
              type="email" 
              name="email" 
              required 
              placeholder="explorer@cosmos.com"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all text-sm placeholder:opacity-20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black opacity-40 ml-4 tracking-widest">Your Narrative Feedback</label>
            <textarea 
              name="message" 
              required 
              placeholder="Tell us about your experience in the StoryScape..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 min-h-[150px] outline-none focus:border-white/30 transition-all text-sm placeholder:opacity-20 leading-relaxed"
            ></textarea>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button" 
              onClick={onBack} 
              className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-2xl active:scale-95"
            >
              Send Transmission
            </button>
          </div>
        </form>

        <p className="text-center text-[9px] opacity-20 uppercase tracking-widest">
          Secured via FormSubmit.co • Redirects to spapk.vercel.app
        </p>
      </div>
    </div>
  );
};

export default FeedbackView;
