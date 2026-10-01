import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SmartImage from '../components/ui/SmartImage';
import { all50Personas } from '../mock/personas';

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'gen-z',   label: 'Gen-Z' },
  { key: 'senior',  label: 'Seniors' },
  { key: 'mobile',  label: 'Mobile' },
  { key: 'a11y',    label: 'Accessibility' },
  { key: 'power',   label: 'Power Users' },
  { key: 'casual',  label: 'Casual' },
];

const tagFilter = {
  'gen-z':   p => p.age < 25,
  'senior':  p => p.age >= 55,
  'mobile':  p => p.device?.toLowerCase().includes('mobile') || p.device?.toLowerCase().includes('android') || p.device?.toLowerCase().includes('iphone'),
  'a11y':    p => p.tag?.toLowerCase().includes('impair') || p.role?.toLowerCase().includes('screen'),
  'power':   p => p.techSavvy >= 90,
  'casual':  p => p.techSavvy < 50,
};

const TraitBar = ({ label, value, color }) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="w-20 text-[#6B6B70] dark:text-[#98989F] truncate">{label}</span>
    <div className="flex-1 h-1.5 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
    </div>
    <span className="w-6 font-mono-num text-right text-[#6B6B70] dark:text-[#98989F]">{value}</span>
  </div>
);

const PersonaCard = ({ persona, index, onView }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card className="p-0 overflow-hidden group hover:shadow-float transition-shadow duration-300">
        {/* Portrait */}
        <div
          className="relative h-44 overflow-hidden bg-[#F7F6F3] dark:bg-[#0F0F12] cursor-pointer"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <SmartImage
            src={hovered && persona.altAvatar ? persona.altAvatar : persona.avatar}
            fallbackSrc={`https://api.dicebear.com/8.x/thumbs/svg?seed=${persona.id}`}
            alt={persona.name}
            className="w-full h-full object-cover object-top transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <Badge variant={persona.status === 'converted' ? 'default' : 'friction'} className="text-[10px]">
              {persona.status}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col gap-2.5">
          <div>
            <p className="font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">{persona.name}</p>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">{persona.age} · {persona.tag}</p>
          </div>

          <p className="text-xs text-[#6B6B70] dark:text-[#98989F] italic line-clamp-2 leading-relaxed">
            "{persona.quote}"
          </p>

          <div className="flex flex-col gap-1">
            <TraitBar label="Patience" value={persona.patience} color="#8FB8A8" />
            <TraitBar label="Tech Savvy" value={persona.techSavvy} color="#6C63FF" />
            <TraitBar label="Vision" value={persona.visionScore} color={persona.visionScore < 50 ? '#F08A7E' : '#6C63FF'} />
          </div>

          <Button variant="ghost" size="sm" pill onClick={() => onView(persona.id)} className="w-full mt-1">
            View Detail →
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const CreateCustomCard = ({ onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    onClick={onClick}
    className="cursor-pointer rounded-[24px] border-2 border-dashed border-[#ECEAE5] dark:border-[#26262F]
      hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 dark:hover:bg-[#6C63FF]/10
      flex flex-col items-center justify-center gap-3 p-8 min-h-[340px] transition-all duration-300 group"
  >
    <div className="w-12 h-12 rounded-2xl bg-[#6C63FF]/10 flex items-center justify-center group-hover:bg-[#6C63FF]/20 transition-colors">
      <Plus size={22} className="text-[#6C63FF]" />
    </div>
    <div className="text-center">
      <p className="font-heading font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">Create Custom Persona</p>
      <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mt-1">Define exact traits & behaviors</p>
    </div>
  </motion.div>
);

export const PersonaLibraryPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Custom persona form
  const [customName, setCustomName] = useState('');
  const [customAge, setCustomAge] = useState(30);
  const [customPatience, setCustomPatience] = useState(50);
  const [customTech, setCustomTech] = useState(50);
  const [customVision, setCustomVision] = useState(80);
  const [customDevice, setCustomDevice] = useState('Desktop Chrome');

  const filtered = useMemo(() => {
    let list = all50Personas;
    if (activeFilter !== 'all' && tagFilter[activeFilter]) {
      list = list.filter(tagFilter[activeFilter]);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tag?.toLowerCase().includes(q) ||
        p.role?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeFilter, search]);

  const SliderField = ({ label, value, onChange, min = 0, max = 100 }) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#6B6B70] dark:text-[#98989F]">{label}</span>
        <span className="font-mono-num font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        className="accent-[#6C63FF] w-full cursor-pointer" />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B70] dark:text-[#98989F]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search personas…"
            className="w-full pl-8 pr-4 py-2.5 rounded-full border border-[#ECEAE5] dark:border-[#26262F]
              bg-white dark:bg-[#17171B] text-sm text-[#1C1C1E] dark:text-[#F2F2F7]
              focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
                ${activeFilter === f.key
                  ? 'bg-[#6C63FF] text-white border-[#6C63FF]'
                  : 'bg-white dark:bg-[#17171B] border-[#ECEAE5] dark:border-[#26262F] text-[#6B6B70] dark:text-[#98989F] hover:border-[#6C63FF]/40'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#6B6B70] dark:text-[#98989F] sm:ml-auto whitespace-nowrap">
          {filtered.length} persona{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p, i) => (
          <PersonaCard
            key={p.id}
            persona={p}
            index={i}
            onView={id => navigate(`/app/personas/${id}`)}
          />
        ))}
        <CreateCustomCard onClick={() => setShowCreateModal(true)} />
      </div>

      {/* Create custom persona modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Custom Persona"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-1 block">Name</label>
            <Input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Tanya M."
            />
          </div>
          <SliderField label="Age" value={customAge} onChange={setCustomAge} min={18} max={80} />
          <SliderField label="Patience" value={customPatience} onChange={setCustomPatience} />
          <SliderField label="Tech Savvy" value={customTech} onChange={setCustomTech} />
          <SliderField label="Vision Score" value={customVision} onChange={setCustomVision} />
          <div>
            <label className="text-xs font-semibold text-[#6B6B70] dark:text-[#98989F] mb-1 block">Primary Device</label>
            <select
              value={customDevice}
              onChange={e => setCustomDevice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECEAE5] dark:border-[#26262F]
                bg-white dark:bg-[#17171B] text-sm text-[#1C1C1E] dark:text-[#F2F2F7]
                focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40"
            >
              {['Desktop Chrome', 'Mobile Safari', 'Android Chrome', 'Screen Reader / VoiceOver', 'Slow 3G Mobile'].map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <Button variant="primary" pill onClick={() => setShowCreateModal(false)} className="mt-2">
            Save Persona
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default PersonaLibraryPage;
