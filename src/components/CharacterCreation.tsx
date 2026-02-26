import React, { useState } from 'react';
import { Stats, STAT_NAMES, STAT_DESCRIPTIONS, TRAITS, Trait } from '@/rules/types';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface CharacterCreationProps {
  onComplete: (stats: Stats, traitKey: string, description: string) => void;
}

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto p-4 sm:p-8 page-parchment rounded-lg border-ornate w-full"
    >
      <h2 className="font-display text-xl sm:text-2xl text-gold mb-2 text-center">Create Your Character</h2>
      <p className="text-muted-foreground text-center mb-6 font-narrative text-sm sm:text-base">
        You are about to enter the Gloam Courts. Choose your strengths wisely. The Courts do not forgive weakness. Or strength, for that matter.
      </p>

      {/* Stats */}
      <div className="mb-6">
        <h3 className="font-display text-sm tracking-widest text-gold-dim uppercase mb-3">
          Attributes <span className="text-foreground">({pointsRemaining} points remaining)</span>
        </h3>
        <div className="space-y-2">
          {STAT_NAMES.map(stat => (
            <div key={stat} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2 gap-2">
              <div className="min-w-0">
                <span className="font-display text-sm text-foreground">{stat}</span>
                <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{STAT_DESCRIPTIONS[stat]}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => adjustStat(stat, -1)} className="w-8 h-8 rounded border border-border text-muted-foreground hover:text-foreground text-sm touch-manipulation flex items-center justify-center">−</button>
                <span className="font-display w-6 text-center text-gold">{stats[stat]}</span>
                <button onClick={() => adjustStat(stat, 1)} className="w-8 h-8 rounded border border-border text-muted-foreground hover:text-foreground text-sm touch-manipulation flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traits */}
      <div className="mb-6">
        <h3 className="font-display text-sm tracking-widest text-gold-dim uppercase mb-3">Choose a Trait</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TRAITS.map(trait => (
            <button
              key={trait.key}
              onClick={() => setSelectedTrait(trait.key)}
              className={`text-left p-3 rounded border transition-colors touch-manipulation ${
                selectedTrait === trait.key
                  ? 'border-gold bg-gold/10'
                  : 'border-border bg-muted/20 hover:border-gold-dim'
              }`}
            >
              <div className="font-display text-sm text-foreground">{trait.name}</div>
              <div className="text-xs text-muted-foreground italic font-narrative">{trait.flavor}</div>
              <div className="text-xs text-gold-dim mt-1">{trait.effect}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="font-display text-sm tracking-widest text-gold-dim uppercase mb-2">Describe Yourself (optional)</h3>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A brief description of the fool about to enter the Courts..."
          className="w-full bg-muted/30 border border-border rounded p-3 text-base text-foreground placeholder:text-muted-foreground font-narrative resize-none h-20"
        />
      </div>

      <Button
        onClick={() => canSubmit && onComplete(stats, selectedTrait, description)}
        disabled={!canSubmit}
        className="w-full bg-primary hover:bg-blood-glow text-primary-foreground font-display tracking-wider py-3 touch-manipulation"
      >
        Enter the Gloam Courts
      </Button>
    </motion.div>
  );
};

export default CharacterCreation;
