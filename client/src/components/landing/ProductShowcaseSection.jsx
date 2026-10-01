import React from 'react';
import { motion } from 'framer-motion';
import GlassPanel from '../ui/GlassPanel';
import Badge from '../ui/Badge';
import SpeechBubble from '../ui/SpeechBubble';
import SmartImage from '../ui/SmartImage';
import { personasData } from '../../mock/personas';
import { AlertCircle, Flame, Video } from 'lucide-react';

export const ProductShowcaseSection = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <Badge variant="friction" pulse>
          Friction Detection Engine
        </Badge>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
          Cinematic dashboard for full UX clarity
        </h2>
        <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F]">
          Watch 50 AI testers navigate simultaneously. Coral hotspots show where users abandon, get confused, or misclick.
        </p>
      </div>

      {/* Tilted Floating Dashboard Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 10 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="perspective-1000 relative flex justify-center"
      >
        <GlassPanel className="w-full max-w-5xl p-4 sm:p-8 shadow-2xl border border-[#ECEAE5]/90 dark:border-[#26262F]/90 rounded-3xl overflow-hidden">
          
          {/* Dashboard Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[#ECEAE5] dark:border-[#26262F] gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#F08A7E]/15 text-[#F08A7E]">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
                  Checkout UX Usability Run #842
                </h3>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  Tested 4 minutes ago • 50 Autonomous Agents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F08A7E]/15 text-[#C84536] dark:text-[#F08A7E] border border-[#F08A7E]/30 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                38 Friction Hotspots
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/30 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                50 Video Replays
              </span>
            </div>
          </div>

          {/* Graphic Dashboard Body */}
          <div className="relative rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F]">
            <img
              src="/assets/dashboard-mockup.png"
              alt="Personify Dashboard Heatmap"
              className="w-full h-auto object-cover"
            />

            {/* Overlay Interactive Speech Bubbles */}
            <div className="absolute top-12 left-8 hidden md:block">
              <SpeechBubble
                personaName="Aisha (41)"
                avatar={personasData[5].avatar}
                fallbackAvatar={personasData[5].fallbackAvatar}
                text="The coupon code box hid the total order price."
                variant="friction"
              />
            </div>

            <div className="absolute bottom-12 right-8 hidden md:block">
              <SpeechBubble
                personaName="Uncle Sharma (58)"
                avatar={personasData[1].avatar}
                fallbackAvatar={personasData[1].fallbackAvatar}
                text="I couldn't read the light grey text on white background."
                variant="friction"
              />
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    </section>
  );
};

export default ProductShowcaseSection;
