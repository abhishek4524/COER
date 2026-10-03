import React from 'react';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { Link2, Users, BarChart3 } from 'lucide-react';

export const HowItWorksSection = () => {
  const steps = [
    {
      num: '01',
      title: 'Drop your URL or Figma prototype',
      description: 'Paste any public URL or Figma file link. No SDK installation, no event tracking setup, no code changes required.',
      image: '/assets/step1-url.png',
      icon: Link2,
    },
    {
      num: '02',
      title: '50 AI Personas test simultaneously',
      description: 'Autonomous AI browser agents—with distinct age profiles, patience thresholds, tech literacy, and screen readers—browse your site in parallel.',
      image: '/assets/step2-personas.png',
      icon: Users,
    },
    {
      num: '03',
      title: 'Watch recordings & friction heatmaps',
      description: 'Review synchronized video replays, transcriptions of internal thoughts, and coral-highlighted UX bottlenecks in minutes.',
      image: '/assets/step3-analytics.png',
      icon: BarChart3,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <Badge variant="accent">3 Simple Steps</Badge>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
          How VibeTest works
        </h2>
        <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F]">
          From URL input to detailed usability insight in under 3 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
            >
              <Card className="h-full flex flex-col justify-between overflow-hidden border border-[#ECEAE5] dark:border-[#26262F]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num font-bold text-2xl text-[#6C63FF]">
                      {step.num}
                    </span>
                    <div className="p-2.5 rounded-2xl bg-[#6C63FF]/10 text-[#6C63FF]">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-heading text-[#1C1C1E] dark:text-[#F2F2F7]">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#6B6B70] dark:text-[#98989F] leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] bg-[#F7F6F3] dark:bg-[#202026]">
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-48 object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default HowItWorksSection;
