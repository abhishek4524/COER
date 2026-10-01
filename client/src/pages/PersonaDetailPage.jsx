import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import GlassPanel from '../components/ui/GlassPanel';
import SmartImage from '../components/ui/SmartImage';
import Toast from '../components/ui/Toast';
import Skeleton from '../components/ui/Skeleton';
import { getPersonaById, getSessionByPersonaId } from '../services/api';

const EXPRESSION_EMOJI = {
  neutral: '😐', focused: '🎯', happy: '😊', satisfied: '😌',
  confused: '😕', frustrated: '😤', angry: '😠', 'gave-up': '😞',
  blocked: '🚫', distracted: '😵', stuck: '🤔',
};

const TraitBar = ({ label, value, color }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between text-xs">
      <span className="text-[#6B6B70] dark:text-[#98989F] font-medium">{label}</span>
      <span className="font-mono-num font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">{value}</span>
    </div>
    <div className="h-2 w-full bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  </div>
);

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const color = payload.value >= 70 ? '#F08A7E' : payload.value >= 40 ? '#F59E0B' : '#8FB8A8';
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />;
};

export const PersonaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState(null);
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPersonaById(id), getSessionByPersonaId(id)])
      .then(([p, s]) => {
        setPersona(p);
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[PersonaDetailPage] Error loading persona detail:', err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton width="120px" height="20px" className="rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <Card className="p-5 flex flex-col gap-4">
            <Skeleton width="100%" height="240px" className="rounded-2xl" />
            <Skeleton width="70%" height="24px" className="rounded-md" />
            <Skeleton width="100%" height="60px" className="rounded-lg" />
          </Card>
          <div className="flex flex-col gap-6">
            <Card className="p-5 flex flex-col gap-4">
              <Skeleton width="40%" height="24px" className="rounded-md" />
              <Skeleton width="100%" height="200px" className="rounded-xl" />
            </Card>
            <Card className="p-5 flex flex-col gap-3">
              <Skeleton width="30%" height="20px" className="rounded-md" />
              <Skeleton width="100%" height="80px" className="rounded-xl" />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!persona) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#6B6B70] dark:text-[#98989F]">
        <p>Persona not found.</p>
        <Button variant="ghost" pill onClick={() => navigate('/app/personas')}>← Back to Library</Button>
      </div>
    );
  }

  const frustrationChartData = session?.steps?.map((s, i) => ({
    step: i + 1,
    label: s.label || `Step ${i + 1}`,
    value: s.frustration || 0,
  })) ?? [];

  const backstory = `${persona.name} is a ${persona.age}-year-old ${persona.role}. They use ${persona.device} and are ${persona.techSavvy > 70 ? 'highly tech-savvy' : persona.techSavvy > 40 ? 'moderately tech-savvy' : 'not very tech-savvy'}. Their patience level is ${persona.patience > 70 ? 'high' : persona.patience > 35 ? 'moderate' : 'very low'}, and their main friction point was: "${persona.frictionPoint}".`;

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/app/personas')}
        className="flex items-center gap-2 text-sm text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Back to Library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">
          {/* Portrait */}
          <Card className="p-0 overflow-hidden">
            <SmartImage
              src={persona.avatar}
              fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${persona.id}`}
              alt={persona.name}
              className="w-full h-64 object-cover object-top"
            />
            <div className="p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-heading text-xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">{persona.name}</h1>
                <span className="text-[#6B6B70] dark:text-[#98989F] text-sm">{persona.age}</span>
              </div>
              <Badge variant={persona.status === 'converted' ? 'default' : 'friction'} className="mb-3">
                {persona.tag}
              </Badge>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] leading-relaxed">{backstory}</p>
            </div>
          </Card>

          {/* Traits */}
          <Card className="p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase">Traits</p>
            <TraitBar label="Patience" value={persona.patience} color="#8FB8A8" />
            <TraitBar label="Tech Savvy" value={persona.techSavvy} color="#6C63FF" />
            <TraitBar label="Vision Score" value={persona.visionScore} color={persona.visionScore < 50 ? '#F08A7E' : '#6C63FF'} />
          </Card>

          {/* Watch Replay */}
          <Button
            variant="primary" pill size="lg" icon={Play}
            onClick={() => setToast('Replay feature coming soon!')}
            className="w-full"
          >
            Watch Replay
          </Button>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">
          {/* Frustration graph */}
          <Card className="p-5">
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase mb-4">Frustration Over Session</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={frustrationChartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="frustGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F08A7E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F08A7E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE5" vertical={false} />
                  <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#6B6B70' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B6B70' }} axisLine={false} tickLine={false} />
                  <ReTooltip
                    contentStyle={{ background: '#fff', border: '1px solid #ECEAE5', borderRadius: 12, fontSize: 12 }}
                    formatter={(v, _, p) => [`${v}`, p.payload.label]}
                  />
                  <Area
                    type="monotone" dataKey="value"
                    stroke="#F08A7E" strokeWidth={2.5}
                    fill="url(#frustGrad)"
                    dot={<CustomDot />}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Step timeline */}
          <Card className="p-5">
            <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase mb-4">Session Timeline</p>
            <div className="flex flex-col gap-4">
              {session?.steps.map((step, i) => {
                const isLast = i === (session.steps.length - 1);
                const isFailure = isLast && session.persona.status !== 'converted';
                return (
                  <div key={step.id} className="flex gap-3">
                    {/* Step indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0
                        ${isFailure ? 'bg-[#F08A7E]' : 'bg-[#6C63FF]'}`}>
                        {i + 1}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-[#ECEAE5] dark:bg-[#26262F] mt-1 min-h-[16px]" />}
                    </div>

                    {/* Step card */}
                    <Card className="flex-1 p-3 mb-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div className="w-16 h-10 rounded-lg overflow-hidden bg-[#F7F6F3] dark:bg-[#0F0F12] shrink-0">
                          <SmartImage
                            src={step.screenshot}
                            fallbackSrc="/assets/hero-scene.png"
                            alt={step.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">{step.label}</p>
                            <span className="text-xs">{EXPRESSION_EMOJI[step.expression] ?? '😐'}</span>
                            <span className="text-[10px] text-[#6B6B70] dark:text-[#98989F] font-mono-num ml-auto">{step.duration}s</span>
                          </div>
                          <p className="text-[10px] font-mono-num text-[#6B6B70] dark:text-[#98989F] truncate mb-1">{step.url}</p>
                          {/* Frustration bar */}
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${step.frustration}%`,
                                  background: step.frustration > 70 ? '#F08A7E' : step.frustration > 40 ? '#F59E0B' : '#8FB8A8'
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-mono-num text-[#6B6B70] dark:text-[#98989F]">{step.frustration}</span>
                          </div>
                          <p className="text-[11px] italic text-[#6B6B70] dark:text-[#98989F] line-clamp-1">"{step.thought}"</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Final feedback */}
          {session && (
            <GlassPanel className="rounded-2xl p-5">
              <p className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] tracking-widest uppercase mb-2">Final Feedback</p>
              <p className="text-sm text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed italic">
                "{session.finalFeedback}"
              </p>
              <div className="flex gap-4 mt-3 text-xs text-[#6B6B70] dark:text-[#98989F]">
                <span className="font-mono-num">Total: {session.totalTime}s</span>
                <span className="font-mono-num">Clicks: {session.clickCount}</span>
                <span className="font-mono-num text-[#F08A7E]">Rage: {session.rageClickCount}</span>
              </div>
            </GlassPanel>
          )}
        </div>
      </div>

      <Toast message={toast} type="info" isVisible={!!toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PersonaDetailPage;
