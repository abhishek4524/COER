import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Slider from '../ui/Slider';
import { Layers, Sparkles } from 'lucide-react';

export const HeatmapSliderSection = () => {
  const [sliderVal, setSliderVal] = useState(50);

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <Badge variant="accent">Cognitive Intelligence</Badge>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
          Standard Heatmaps vs Personify AI
        </h2>
        <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F]">
          Drag the slider below to compare traditional click aggregations against Personify's persona-level cognitive friction mapping.
        </p>
      </div>

      <Card className="max-w-4xl mx-auto p-4 sm:p-8 border border-[#ECEAE5] dark:border-[#26262F] overflow-hidden">
        {/* Slider Controls */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={sliderVal < 50 ? 'text-[#6C63FF]' : 'text-[#6B6B70]'}>
              Standard Click Map ({100 - sliderVal}%)
            </span>
          </div>

          <div className="w-full sm:w-72">
            <Slider
              value={sliderVal}
              onChange={setSliderVal}
              label="Reveal Personify Layer"
            />
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-[#F08A7E]">
            <Sparkles className="w-4 h-4" />
            Personify Cognitive Heatmap ({sliderVal}%)
          </div>
        </div>

        {/* Comparison Image Container */}
        <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] select-none bg-white dark:bg-[#17171B]">
          
          {/* Base Layer: Standard Heatmap */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#F7F6F3] dark:bg-[#17171B] p-6">
            <div className="w-full max-w-2xl h-full border border-dashed border-[#6B6B70]/30 rounded-2xl p-6 relative flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <div className="w-32 h-6 rounded-lg bg-[#ECEAE5] dark:bg-[#26262F]" />
                <div className="w-20 h-6 rounded-full bg-[#ECEAE5] dark:bg-[#26262F]" />
              </div>
              
              {/* Standard Clicks (just random blue dots) */}
              <div className="absolute top-1/3 left-1/3 w-16 h-16 rounded-full bg-blue-500/20 blur-md" />
              <div className="absolute bottom-1/3 right-1/3 w-20 h-20 rounded-full bg-blue-500/30 blur-md" />
              
              <div className="text-center font-mono-num text-xs text-[#6B6B70]">
                Standard Analytics: 4,200 clicks recorded (No reason why 76% dropped off)
              </div>
            </div>
          </div>

          {/* Top Overlay Layer: Personify Cognitive Friction Map (Clipped by sliderVal) */}
          <div
            style={{ width: `${sliderVal}%` }}
            className="absolute top-0 bottom-0 right-0 overflow-hidden bg-white dark:bg-[#17171B] border-l-2 border-[#6C63FF] shadow-2xl transition-all duration-75"
          >
            <div className="absolute top-0 bottom-0 right-0 w-[800px] sm:w-[900px] p-6 flex flex-col justify-between h-full bg-[#FFF9F8] dark:bg-[#1D1616]">
              <div className="flex justify-between items-center">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F08A7E] text-white">
                  🔥 Personify Friction AI Activated
                </span>
              </div>

              {/* Coral Friction Hotspots */}
              <div className="absolute top-1/4 right-1/3 w-32 h-32 rounded-full bg-[#F08A7E]/40 blur-xl animate-pulse" />
              <div className="absolute top-1/4 right-1/3 w-16 h-16 rounded-full bg-[#F08A7E]/70 blur-md" />

              <div className="relative z-10 max-w-sm p-3.5 rounded-2xl bg-white/90 dark:bg-[#17171B]/90 border border-[#F08A7E]/40 shadow-lg text-xs font-medium text-[#C84536] dark:text-[#F08A7E]">
                ⚠️ 38 Personas abandoned here: "Phone number required field was invisible on mobile 375px screen."
              </div>

              <div className="text-right font-mono-num text-xs font-semibold text-[#F08A7E]">
                Exact UX Root Cause Identified in 45 seconds
              </div>
            </div>
          </div>

          {/* Divider Handle Bar */}
          <div
            style={{ left: `${100 - sliderVal}%` }}
            className="absolute top-0 bottom-0 w-1 bg-[#6C63FF] -ml-0.5 cursor-ew-resize flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white flex items-center justify-center shadow-lg text-xs font-bold">
              ↔
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default HeatmapSliderSection;
