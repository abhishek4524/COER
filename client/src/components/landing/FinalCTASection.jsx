import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import SmartImage from '../ui/SmartImage';
import { personasData } from '../../mock/personas';
import { Sparkles, ArrowRight } from 'lucide-react';

export const FinalCTASection = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative rounded-3xl bg-gradient-to-br from-[#6C63FF] via-[#5A52E0] to-[#3B34B0] p-8 sm:p-16 text-center text-white overflow-hidden shadow-2xl">
        
        {/* Soft decorative background circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#F08A7E]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          
          {/* Avatar Crowd looking toward button */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center -space-x-4">
              {personasData.slice(0, 6).map((persona, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 0 }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                >
                  <SmartImage
                    src={persona.avatar}
                    fallbackSrc={persona.fallbackAvatar}
                    alt={persona.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-[#6C63FF] bg-white shadow-lg object-cover"
                  />
                </motion.div>
              ))}
            </div>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">
              50 Testers Are Waiting For Your URL
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading leading-tight tracking-tight">
            Stop guessing. <br />
            Start testing with 50 AI personas.
          </h2>

          <p className="text-base sm:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
            Uncover conversion-killing usability bugs before your real users leave for competitors.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              variant="secondary"
              size="lg"
              pill
              icon={Sparkles}
              onClick={() => navigate('/app/new-run')}
              className="w-full sm:w-auto text-[#6C63FF] hover:bg-white"
            >
              Start testing free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              pill
              icon={ArrowRight}
              onClick={() => navigate('/app/live')}
              className="w-full sm:w-auto text-white hover:bg-white/10"
            >
              Book a live demo
            </Button>
          </div>

          <p className="text-xs text-white/70 pt-4">
            Free tier includes 5 full persona runs • No credit card required
          </p>
        </div>
      </div>
    </section>
  );
};

export default FinalCTASection;
