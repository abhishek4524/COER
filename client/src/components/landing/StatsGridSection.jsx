import React, { useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Tooltip from '../ui/Tooltip';
import SmartImage from '../ui/SmartImage';
import { all50Personas } from '../../mock/personas';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const StatsGridSection = () => {
  const [count, setCount] = useState(0);
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = 38;
      const duration = 1500;
      const stepTime = Math.abs(Math.floor(duration / end));
      const timer = setInterval(() => {
        start += 1;
        setCount(start);
        if (start >= end) clearInterval(timer);
      }, stepTime);
      return () => clearInterval(timer);
    }
  }, [isInView]);

  return (
    <section ref={ref} className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Stats Text & Counter */}
        <div className="lg:col-span-5 space-y-6">
          <Badge variant="friction" pulse>
            High Friction Alert
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7] leading-tight">
            <span className="font-mono-num text-[#F08A7E] text-6xl block mb-2">
              {count} of 50
            </span>
            personas missed your primary CTA
          </h2>

          <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
            Standard analytics only show that 76% of visitors bounced. VibeTest shows you exact cognitive profiles: mobile users with low patience missed the button because it was below the fold on 375px screens.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#ECEAE5] dark:border-[#26262F]">
            <div className="p-4 rounded-2xl bg-[#FFF5F4] dark:bg-[#201514] border border-[#F08A7E]/30">
              <div className="flex items-center gap-2 text-[#C84536] dark:text-[#F08A7E] font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                38 Missed CTA
              </div>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-1">76% Abandonment Rate</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#EBF3F0] dark:bg-[#15201B] border border-[#8FB8A8]/30">
              <div className="flex items-center gap-2 text-[#3D6B58] dark:text-[#8FB8A8] font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                12 Converted
              </div>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-1">24% Success Rate</p>
            </div>
          </div>
        </div>

        {/* Right 50 Avatar Grid */}
        <div className="lg:col-span-7">
          <Card className="p-6 border border-[#ECEAE5] dark:border-[#26262F]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#ECEAE5] dark:border-[#26262F]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B70] dark:text-[#98989F]">
                50 Persona Swarm Grid
              </span>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#F08A7E]" />
                  Missed CTA (38)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#8FB8A8]" />
                  Converted (12)
                </span>
              </div>
            </div>

            {/* 50 Grid Avatars */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 sm:gap-3">
              {all50Personas.map((persona, index) => {
                const isFriction = persona.missedCTA;
                return (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                  >
                    <Tooltip content={`${persona.name} (${persona.age}) - ${isFriction ? 'Missed CTA' : 'Converted'}`}>
                      <div
                        className={`relative rounded-xl p-1 transition-all duration-200 hover:scale-110 cursor-pointer ${
                          isFriction
                            ? 'bg-[#F08A7E]/20 border border-[#F08A7E]'
                            : 'bg-[#8FB8A8]/20 border border-[#8FB8A8]'
                        }`}
                      >
                        <SmartImage
                          src={persona.avatar}
                          fallbackSrc={persona.fallbackAvatar}
                          alt={persona.name}
                          className="w-full h-auto rounded-lg bg-white dark:bg-[#17171B] object-cover"
                        />
                        <span
                          className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-[#17171B] ${
                            isFriction ? 'bg-[#F08A7E]' : 'bg-[#8FB8A8]'
                          }`}
                        />
                      </div>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </div>

      </div>
    </section>
  );
};

export default StatsGridSection;
