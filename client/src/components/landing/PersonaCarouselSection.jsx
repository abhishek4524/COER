import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Chip from '../ui/Chip';
import EmotionMeter from '../ui/EmotionMeter';
import SmartImage from '../ui/SmartImage';
import { personasData } from '../../mock/personas';

export const PersonaCarouselSection = () => {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <section id="personas" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div className="space-y-3 max-w-2xl">
          <Badge variant="accent">Diversity & Inclusion</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
            Meet your testers
          </h2>
          <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F]">
            50 distinct synthetic personalities with unique cognitive profiles, devices, and patience thresholds.
          </p>
        </div>
        <div className="text-xs text-[#6B6B70] dark:text-[#98989F] font-mono-num shrink-0">
          👈 Drag or scroll horizontally
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex gap-6 overflow-x-auto pb-8 pt-2 scrollbar-none snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6">
        {personasData.map((persona) => {
          const isHovered = hoveredCard === persona.id;
          const avatarUrl = isHovered && persona.altAvatar ? persona.altAvatar : persona.avatar;
          const fallbackUrl = isHovered && persona.fallbackAltAvatar ? persona.fallbackAltAvatar : persona.fallbackAvatar;

          return (
            <motion.div
              key={persona.id}
              onMouseEnter={() => setHoveredCard(persona.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="snap-start shrink-0 w-80 sm:w-88"
            >
              <Card className="h-full flex flex-col justify-between border border-[#ECEAE5] dark:border-[#26262F] hover:border-[#6C63FF]/50 transition-all duration-300">
                <div className="space-y-4">
                  
                  {/* Card Header Avatar & Tag */}
                  <div className="flex items-start justify-between">
                    <div className="relative">
                      <SmartImage
                        src={avatarUrl}
                        fallbackSrc={fallbackUrl}
                        alt={persona.name}
                        className="w-20 h-20 rounded-2xl bg-[#F7F6F3] dark:bg-[#202026] border-2 border-white dark:border-[#26262F] shadow-md object-cover transition-all duration-300"
                      />
                      {isHovered && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#F08A7E] text-white rounded-full">
                          Reacting
                        </span>
                      )}
                    </div>
                    <Chip variant={persona.missedCTA ? 'friction' : 'success'}>
                      {persona.tag}
                    </Chip>
                  </div>

                  {/* Name & Age */}
                  <div>
                    <h3 className="text-xl font-bold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
                      {persona.name}, <span className="font-mono-num font-normal text-[#6B6B70]">{persona.age}</span>
                    </h3>
                    <p className="text-xs text-[#6B6B70] dark:text-[#98989F] font-medium">
                      {persona.role} • {persona.device}
                    </p>
                  </div>

                  {/* Quote */}
                  <div className="p-3.5 rounded-2xl bg-[#F7F6F3] dark:bg-[#202026] border border-[#ECEAE5] dark:border-[#26262F]">
                    <p className="text-xs italic text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed">
                      "{persona.quote}"
                    </p>
                  </div>

                  {/* Trait Bars */}
                  <div className="space-y-3 pt-2">
                    <EmotionMeter
                      label="Patience Level"
                      value={persona.patience}
                      color={persona.patience < 40 ? '#F08A7E' : '#8FB8A8'}
                    />
                    <EmotionMeter
                      label="Tech Literacy"
                      value={persona.techSavvy}
                      color="#6C63FF"
                    />
                  </div>
                </div>

                {/* Footer Friction Point */}
                <div className="pt-4 mt-4 border-t border-[#ECEAE5] dark:border-[#26262F] flex items-center justify-between text-xs">
                  <span className="text-[#6B6B70] dark:text-[#98989F]">Observed Friction:</span>
                  <span className={`font-semibold ${persona.missedCTA ? 'text-[#C84536] dark:text-[#F08A7E]' : 'text-[#3D6B58] dark:text-[#8FB8A8]'}`}>
                    {persona.frictionPoint}
                  </span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default PersonaCarouselSection;
