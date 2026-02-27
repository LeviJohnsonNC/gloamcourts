import React, { useState } from 'react';
import { Stats, STAT_NAMES, STAT_DESCRIPTIONS, TRAITS, Trait } from '@/rules/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Shield } from 'lucide-react';

interface CharacterCreationProps {
  onComplete: (stats: Stats, traitKey: string, description: string) => void;
}

const TRAIT_CATEGORIES: Record<string, string[]> = {
  silver_tongue: ['Social'],
  lucky_fool: ['Survival'],
  iron_constitution: ['Combat'],
  shadow_step: ['Combat'],
  third_eye: ['Investigation'],
  hexblood: ['Occult'],
  deaths_jest: ['Occult'],
  court_bred: ['Social'],
};

const CharacterCreation: React.FC<CharacterCreationProps> = ({ onComplete }) => {
  const [stats, setStats] = useState<Stats>({ STEEL: 2, GUILE: 2, WITS: 2, GRACE: 2, HEX: 2 });
  const [selectedTrait, setSelectedTrait] = useState<string>('');
  const [description, setDescription] = useState('');
  const pointsRemaining = 5 - (Object.values(stats).reduce((a, b) => a + b, 0) - 10);

  const adjustStat = (stat: keyof Stats, delta: number) => {
    const newVal = stats[stat] + delta;
    if (newVal < 1 || newVal > 5) return;
    if (delta > 0 && pointsRemaining <= 0) return;
    setStats({ ...stats, [stat]: newVal });
  };

  const canSubmit = pointsRemaining === 0 && selectedTrait !== '';
  const spotlightTrait = TRAITS.find(t => t.key === selectedTrait) || TRAITS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-5xl mx-auto backdrop-blur-md rounded-lg border border-border/40 overflow-hidden"
      style={{
        background: 'hsl(var(--background) / 0.82)',
        boxShadow: 'inset 0 0 40px hsl(0 0% 0% / 0.4), 0 0 60px hsl(0 0% 0% / 0.3)',
      }}
    >
      {/* Two-page folio grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr]">
        {/* ===== LEFT PAGE ===== */}
        <div className="p-5 sm:p-8 flex flex-col">
          {/* Header */}
          <div className="mb-6 text-center lg:text-left">
            <h2
              className="font-display text-2xl sm:text-3xl tracking-wider mb-1"
              style={{
                color: 'hsl(var(--gold))',
                textShadow: '0 0 25px hsl(40 50% 45% / 0.35), 0 0 50px hsl(40 50% 45% / 0.12)',
              }}
            >
              Create Your Character
            </h2>
            <p className="text-muted-foreground font-narrative text-sm sm:text-base leading-relaxed">
              You are about to enter the Gloam Courts. Choose your strengths wisely.<br className="hidden sm:inline" />
              The Courts do not forgive weakness. Or strength, for that matter.
            </p>
          </div>

          {/* Points stamp */}
          <div className="mb-4 flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border font-display text-xs tracking-[0.2em] uppercase transition-all duration-500 ${
                pointsRemaining === 0
                  ? 'border-gold/60 text-gold bg-gold/10'
                  : 'border-border text-muted-foreground'
              }`}
              style={pointsRemaining === 0 ? { boxShadow: '0 0 12px hsl(var(--gold) / 0.2)' } : {}}
            >
              {pointsRemaining === 0 ? (
                <motion.span
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  ✦ SEALED
                </motion.span>
              ) : (
                <span>Points Remaining: {pointsRemaining}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 mb-6">
            {STAT_NAMES.map(stat => (
              <div
                key={stat}
                className="flex items-center justify-between rounded px-3 py-2.5 gap-3 transition-colors"
                style={{ background: 'hsl(var(--muted) / 0.45)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm text-foreground">{stat}</div>
                  <div className="text-xs text-muted-foreground font-narrative">{STAT_DESCRIPTIONS[stat]}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => adjustStat(stat, -1)}
                    aria-label={`Decrease ${stat}`}
                    className="w-10 h-10 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-lg touch-manipulation flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <span
                    className="font-display w-8 text-center text-xl"
                    style={{ color: 'hsl(var(--gold))' }}
                  >
                    {stats[stat]}
                  </span>
                  <button
                    onClick={() => adjustStat(stat, 1)}
                    aria-label={`Increase ${stat}`}
                    className="w-10 h-10 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-lg touch-manipulation flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Margin note */}
          <div className="mt-auto" style={{ borderLeft: '2px solid hsl(var(--gold-dim) / 0.3)' }}>
            <div className="pl-3">
              <label className="font-display text-xs tracking-[0.15em] uppercase text-muted-foreground">
                Margin Note <span className="text-muted-foreground/60">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A brief description of the fool about to enter the Courts…"
                className="w-full mt-1 bg-transparent border border-border/40 rounded p-3 text-base text-foreground placeholder:text-muted-foreground font-narrative resize-none h-20 focus:outline-none focus:border-gold-dim/60 transition-colors"
              />
              <p className="text-xs text-muted-foreground/60 font-narrative italic mt-1">
                The Courts may quote this back at you later.
              </p>
            </div>
          </div>
        </div>

        {/* ===== SPINE CREASE ===== */}
        <div className="hidden lg:block w-px folio-spine" />

        {/* ===== RIGHT PAGE ===== */}
        <div className="p-5 sm:p-8 flex flex-col border-t lg:border-t-0 border-border/20">
          {/* Trait Spotlight */}
          <div className="mb-5">
            <h3 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <Shield size={12} style={{ color: 'hsl(var(--gold-dim))' }} />
              Trait Spotlight
            </h3>
            <AnimatePresence mode="wait">
              <motion.div
                key={spotlightTrait.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="rounded-lg p-5 border"
                style={{
                  background: 'hsl(var(--muted) / 0.55)',
                  borderColor: 'hsl(var(--gold-dim) / 0.4)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4
                    className="font-display text-lg"
                    style={{ color: 'hsl(var(--gold))' }}
                  >
                    {spotlightTrait.name}
                  </h4>
                  <div className="flex gap-1.5 shrink-0">
                    {(TRAIT_CATEGORIES[spotlightTrait.key] || []).map(cat => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="text-[10px] px-2 py-0 border-gold-dim/40 text-gold-dim font-display tracking-wider"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="font-narrative italic text-foreground/80 text-sm leading-relaxed mb-2">
                  "{spotlightTrait.flavor}"
                </p>
                <p className="text-sm font-display" style={{ color: 'hsl(var(--gold-dim))' }}>
                  {spotlightTrait.effect}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Trait Grid */}
          <h3 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Choose a Trait
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {TRAITS.map(trait => {
              const isSelected = selectedTrait === trait.key;
              return (
                <button
                  key={trait.key}
                  onClick={() => setSelectedTrait(trait.key)}
                  role="radio"
                  aria-checked={isSelected}
                  className={`relative text-left p-3 rounded-lg border transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                    isSelected
                      ? 'border-gold bg-gold/10 scale-[1.02]'
                      : 'border-border/40 hover:-translate-y-0.5 hover:border-gold-dim/50'
                  }`}
                  style={
                    isSelected
                      ? {
                          boxShadow: '0 0 12px hsl(var(--gold) / 0.15)',
                          background: 'hsl(var(--gold) / 0.08)',
                        }
                      : { background: 'hsl(var(--muted) / 0.3)' }
                  }
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2"
                    >
                      <Check size={14} style={{ color: 'hsl(var(--gold))' }} />
                    </motion.div>
                  )}
                  <div className="font-display text-sm text-foreground pr-5">{trait.name}</div>
                  <div className="text-xs text-muted-foreground italic font-narrative line-clamp-1 mt-0.5">
                    {trait.flavor}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'hsl(var(--gold-dim))' }}>
                    {trait.effect}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {(TRAIT_CATEGORIES[trait.key] || []).map(cat => (
                      <span
                        key={cat}
                        className="text-[9px] px-1.5 py-0 rounded-full border font-display tracking-wider"
                        style={{
                          borderColor: 'hsl(var(--gold-dim) / 0.3)',
                          color: 'hsl(var(--gold-dim) / 0.7)',
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== SEAL BAR ===== */}
      <div
        className="sticky bottom-0 border-t px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-lg"
        style={{
          borderColor: 'hsl(var(--border) / 0.4)',
          background: 'hsl(var(--background) / 0.85)',
        }}
      >
        <div className="flex items-center gap-4 text-xs font-display tracking-wider text-muted-foreground">
          <span>
            Points: <span style={{ color: pointsRemaining === 0 ? 'hsl(var(--gold))' : undefined }}>{pointsRemaining}</span>
          </span>
          {selectedTrait && (
            <span>
              Trait: <span style={{ color: 'hsl(var(--gold))' }}>{TRAITS.find(t => t.key === selectedTrait)?.name}</span>
            </span>
          )}
        </div>
        <Button
          onClick={() => canSubmit && onComplete(stats, selectedTrait, description)}
          disabled={!canSubmit}
          className="font-display tracking-[0.15em] uppercase px-8 py-3 transition-all duration-300"
          style={
            canSubmit
              ? {
                  borderColor: 'hsl(var(--gold))',
                  background: 'hsl(var(--gold) / 0.15)',
                  color: 'hsl(var(--gold))',
                  boxShadow: '0 0 20px hsl(var(--gold) / 0.15)',
                }
              : {}
          }
          variant={canSubmit ? 'outline' : 'default'}
        >
          {canSubmit ? '⚜ Seal This Fate' : 'Allocate Your Doom'}
        </Button>
      </div>
    </motion.div>
  );
};

export default CharacterCreation;
