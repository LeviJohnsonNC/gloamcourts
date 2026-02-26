import React from 'react';
import { motion } from 'framer-motion';
import { Section, Choice, GameState, CombatState, Stance } from '@/rules/types';
import { canMakeGatedChoice } from '@/rules/engine';
import InkPlate from './InkPlate';
import { Shield, Sword, Zap, ArrowRight, Lock, Heart, Brain, Clover, Skull } from 'lucide-react';

interface BookSpreadProps {
  section: Section;
  gameState: GameState;
  combatState: CombatState | null;
  onChoice: (choice: Choice) => void;
  onCombatAction: (action: 'attack' | 'defend' | 'trick' | 'flee') => void;
  onChangeCombatStance: (stance: Stance) => void;
  onDeath: () => void;
  onEnding: () => void;
}

const BookSpread: React.FC<BookSpreadProps> = ({
  section, gameState, combatState, onChoice, onCombatAction, onChangeCombatStance, onDeath, onEnding,
}) => {
  const isDead = section.is_death || gameState.resources.health <= 0;
  const isEnding = section.is_ending;

  React.useEffect(() => {
    if (isDead) onDeath();
    if (isEnding) onEnding();
  }, [isDead, isEnding]);

  return (
    <motion.div
      key={section.section_number}
      initial={{ opacity: 0, rotateY: -3 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Page */}
      <div className="page-parchment rounded-lg border-ornate p-6 sm:p-10 min-h-[60vh]">
        {/* Section number */}
        <div className="text-center mb-6">
          <span className="section-number text-3xl">{section.section_number}</span>
          <h2 className="font-display text-lg text-foreground mt-1">{section.title}</h2>
        </div>

        {/* Plate */}
        {section.has_plate && <InkPlate caption={section.plate_caption} />}

        {/* Narrator text */}
        <div className="text-narrative text-foreground whitespace-pre-line mb-8">
          {section.narrator_text}
        </div>

        {/* Death */}
        {isDead && section.death_epitaph && (
          <div className="border border-destructive/30 bg-destructive/5 rounded p-4 text-center mt-6">
            <Skull className="mx-auto mb-2 text-destructive" size={24} />
            <p className="font-display text-destructive text-sm tracking-wider uppercase mb-2">You Are Dead</p>
            <p className="font-narrative text-muted-foreground italic">{section.death_epitaph}</p>
          </div>
        )}

        {/* Ending */}
        {isEnding && (
          <div className="border border-gold/30 bg-gold/5 rounded p-4 text-center mt-6">
            <p className="font-display text-gold text-sm tracking-wider uppercase">The End</p>
          </div>
        )}

        {/* Combat UI */}
        {combatState && !isDead && (
          <div className="mt-6 border border-border rounded p-4 bg-muted/20">
            <h3 className="font-display text-sm text-destructive tracking-wider uppercase mb-3">
              ⚔ Combat: {combatState.enemy.name}
            </h3>
            <div className="flex gap-4 text-xs text-muted-foreground mb-3">
              <span>Enemy HP: {combatState.enemy_health}/{combatState.enemy.health}</span>
              <span>Round: {combatState.round}</span>
              <span>Stance: {combatState.player_stance}</span>
            </div>

            {/* Stance buttons */}
            <div className="flex gap-2 mb-3">
              {(['Aggressive', 'Guarded', 'Cunning'] as Stance[]).map(s => (
                <button
                  key={s}
                  onClick={() => onChangeCombatStance(s)}
                  className={`text-xs px-3 py-1 rounded border font-display ${
                    combatState.player_stance === s
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onCombatAction('attack')} className="flex items-center gap-2 px-3 py-2 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 text-sm font-display">
                <Sword size={14} /> Attack
              </button>
              <button onClick={() => onCombatAction('defend')} className="flex items-center gap-2 px-3 py-2 rounded border border-gold-dim text-foreground hover:bg-gold/10 text-sm font-display">
                <Shield size={14} /> Defend
              </button>
              <button onClick={() => onCombatAction('trick')} className="flex items-center gap-2 px-3 py-2 rounded border border-accent/50 text-accent hover:bg-accent/10 text-sm font-display">
                <Zap size={14} /> Trick
              </button>
              <button onClick={() => onCombatAction('flee')} className="flex items-center gap-2 px-3 py-2 rounded border border-border text-muted-foreground hover:text-foreground text-sm font-display">
                <ArrowRight size={14} /> Flee
              </button>
            </div>

            {/* Combat log */}
            {combatState.log.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto text-xs text-muted-foreground font-narrative space-y-1">
                {combatState.log.slice(-5).map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Choices */}
        {!combatState && !isDead && !isEnding && section.choices.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="font-display text-xs tracking-widest text-gold-dim uppercase">What do you do?</h3>
            {section.choices.map((choice, i) => {
              const gated = choice.type === 'gated' && !canMakeGatedChoice(gameState, choice);
              return (
                <button
                  key={i}
                  onClick={() => !gated && onChoice(choice)}
                  disabled={gated}
                  className={`w-full text-left p-3 rounded border transition-all font-narrative text-sm ${
                    gated
                      ? 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
                      : 'border-border hover:border-gold-dim hover:bg-muted/30 text-foreground'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {gated && <Lock size={12} className="mt-0.5 text-muted-foreground" />}
                    <div>
                      <span>{choice.label}</span>
                      {choice.type === 'test' && (
                        <span className="ml-2 text-xs text-gold-dim">[{choice.stat_used} test, TN {choice.tn}]</span>
                      )}
                      {choice.type === 'combat' && (
                        <span className="ml-2 text-xs text-destructive">[Combat]</span>
                      )}
                      {choice.stakes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{choice.stakes}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs font-display">
        <span className="flex items-center gap-1 text-destructive"><Heart size={12} /> {gameState.resources.health}/10</span>
        <span className="flex items-center gap-1 text-hex"><Brain size={12} /> {gameState.resources.focus}/6</span>
        <span className="flex items-center gap-1 text-gold"><Clover size={12} /> {gameState.resources.luck}/6</span>
        <span className="text-madness">Mad: {gameState.tracks.madness}/10</span>
        <span className="text-taint">Taint: {gameState.tracks.taint}/10</span>
        <span className="text-muted-foreground">{gameState.stance} · {gameState.range_band}</span>
      </div>
    </motion.div>
  );
};

export default BookSpread;
