import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import GlassPanel from '../ui/GlassPanel';
import SpeechBubble from '../ui/SpeechBubble';
import CursorTag from '../ui/CursorTag';
import Toast from '../ui/Toast';
import SmartImage from '../ui/SmartImage';
import { ArrowRight, Globe, Play, Sparkles } from 'lucide-react';
import { personasData } from '../../mock/personas';

export const HeroSection = () => {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Mouse Parallax logic
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set((clientX - innerWidth / 2) / 30);
    mouseY.set((clientY - innerHeight / 2) / 30);
  };

  const parallaxX = useTransform(mouseX, (val) => val);
  const parallaxY = useTransform(mouseY, (val) => val);

  const handleSendTesters = (e) => {
    e.preventDefault();
    const targetUrl = urlInput.trim() || 'https://your-app.com';
    setToastMessage(`🚀 50 AI Personas deployed to test ${targetUrl}!`);
    setTimeout(() => {
      navigate('/app/live');
    }, 1200);
  };

  // 4-5 multiplayer cursors paths
  const cursorPaths = [
    { name: 'Riya 17', color: '#F08A7E', x: [50, 180, 120, 50], y: [120, 240, 320, 120], duration: 7 },
    { name: 'Uncle Sharma 58', color: '#6C63FF', x: [420, 310, 480, 420], y: [260, 350, 210, 260], duration: 9 },
    { name: 'Priya (Mobile)', color: '#8FB8A8', x: [260, 380, 290, 260], y: [80, 160, 220, 80], duration: 8 },
    { name: 'Devin (Power User)', color: '#3B82F6', x: [600, 480, 560, 600], y: [150, 280, 100, 150], duration: 6.5 },
  ];

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Soft blurred gradient background blobs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-[#6C63FF]/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-96 h-96 bg-[#F08A7E]/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#8FB8A8]/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        
        {/* Left Content Column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="lg:col-span-6 flex flex-col gap-6 text-left"
        >
          <div className="inline-flex items-center gap-2">
            <Badge variant="accent" pulse>
              Introducing VibeTest 2.0
            </Badge>
            <span className="text-xs text-[#6B6B70] dark:text-[#98989F] font-medium">
              50 AI Testers Ready
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-heading text-[#1C1C1E] dark:text-[#F2F2F7] leading-[1.1] tracking-tight">
            Real people. <br />
            <span className="bg-gradient-to-r from-[#6C63FF] via-[#8FB8A8] to-[#F08A7E] bg-clip-text text-transparent">
              Real reactions.
            </span> <br />
            Before you launch.
          </h1>

          <p className="text-base sm:text-lg text-[#6B6B70] dark:text-[#98989F] leading-relaxed max-w-xl">
            Deploy 50 autonomous AI personas—from impatient teenagers to confused seniors—to navigate your web app, spot UX friction, and report exactly where they got stuck.
          </p>

          {/* URL Input Form */}
          <form onSubmit={handleSendTesters} className="flex flex-col sm:flex-row gap-3 max-w-lg mt-2">
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://your-website.com"
              startIcon={Globe}
              pill
              className="shadow-md"
            />
            <Button type="submit" variant="primary" size="md" pill icon={Sparkles} className="shrink-0">
              Send the testers
            </Button>
          </form>

          {/* Social Proof Stats */}
          <div className="pt-6 border-t border-[#ECEAE5]/80 dark:border-[#26262F]/80 flex items-center gap-6 text-xs text-[#6B6B70] dark:text-[#98989F]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8FB8A8]" />
              <span>Zero setup code required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6C63FF]" />
              <span>50 parallel browser streams</span>
            </div>
          </div>
        </motion.div>

        {/* Right Interactive Mockup Column with Parallax */}
        <motion.div
          style={{ x: parallaxX, y: parallaxY }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="lg:col-span-6 relative flex justify-center items-center"
        >
          {/* Main Floating Glass Browser Window — no overflow-hidden so speech bubbles can escape */}
          <GlassPanel className="relative w-full max-w-xl p-3 sm:p-5 shadow-2xl border border-[#ECEAE5]/80 dark:border-[#26262F]/80 rounded-3xl">
            {/* Window Controls Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#ECEAE5] dark:border-[#26262F] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F08A7E]" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span className="w-3 h-3 rounded-full bg-[#8FB8A8]" />
              </div>
              <div className="px-4 py-1 text-xs font-mono-num bg-white/70 dark:bg-[#17171B]/70 rounded-full text-[#6B6B70] dark:text-[#98989F] border border-[#ECEAE5] dark:border-[#26262F]">
                https://checkout.shop.com/step-2
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#8FB8A8] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#8FB8A8] animate-ping" />
                50 Live
              </div>
            </div>

            {/* Main Scene Image */}
            <div className="relative rounded-2xl overflow-hidden border border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B]">
              <img
                src="/assets/hero-scene.png"
                alt="Personify Live Testing Session"
                className="w-full h-auto object-cover"
              />

              {/* Multiplayer Cursors Moving across Scene */}
              {cursorPaths.map((cursor, i) => (
                <CursorTag
                  key={i}
                  name={cursor.name}
                  color={cursor.color}
                  animatePath={{ x: cursor.x, y: cursor.y, duration: cursor.duration }}
                />
              ))}
            </div>
          </GlassPanel>

          {/* ── Speech Bubbles OUTSIDE GlassPanel ── */}
          {/* They are siblings of GlassPanel inside the parent motion.div (overflow-visible) */}
          {/* This gives the 3D "popping out" depth effect */}

          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-6 -left-6 sm:-left-10 shadow-2xl z-50 hidden sm:flex pointer-events-none"
          >
            <SpeechBubble
              personaName="Riya (17)"
              avatar={personasData[0].avatar}
              fallbackAvatar={personasData[0].fallbackAvatar}
              text="Why is there no Apple Pay option? Closing app."
              variant="friction"
            />
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="absolute -bottom-6 -right-4 sm:-right-10 shadow-2xl z-50 pointer-events-none"
          >
            <SpeechBubble
              personaName="Uncle Sharma (58)"
              avatar={personasData[1].avatar}
              fallbackAvatar={personasData[1].fallbackAvatar}
              text="Is this text clickable? Can't find buy button."
              variant="friction"
            />
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute top-1/3 -right-8 sm:-right-14 shadow-2xl z-50 hidden md:flex pointer-events-none"
          >
            <SpeechBubble
              personaName="Marcus (Screen Reader)"
              avatar={personasData[3].avatar}
              fallbackAvatar={personasData[3].fallbackAvatar}
              text="Focus lost on popup menu."
              variant="default"
            />
          </motion.div>
        </motion.div>
      </div>

      <Toast
        message={toastMessage}
        type="info"
        isVisible={!!toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </section>
  );
};

export default HeroSection;
