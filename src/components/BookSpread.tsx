import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Section, Choice, GameState, CombatState, Stance, CombatAction, RangeBand, getActiveTwist } from '@/rules/types';
import { canMakeGatedChoice } from '@/rules/engine';
import InkPlate from './InkPlate';
import { CachedSection } from '@/lib/llmService';
import { generatePlate } from '@/lib/llmService';
import { computeGutFeel, GUT_FEEL_COLORS, GutFeelLevel } from '@/lib/gutFeel';
import { Shield, Sword, Zap, ArrowRight, Lock, Heart, Brain, Clover, Skull, Home, ArrowUp, ArrowDown, BookOpen, Flame, Loader2, AlertTriangle } from 'lucide-react';

interface BookSpreadProps {
  section: Section;
  gameState: GameState;
  combatState: CombatState | null;
  onChoice: (choice: Choice) => void;
  onCombatAction: (action: CombatAction) => void;
  onChangeCombatStance: (stance: Stance) => void;
  onDeath: () => void;
  onEnding: () => void;
  onNewRun?: () => void;
  onReturnHome?: () => void;
  onEmbraceDarkness?: (track: 'madness' | 'taint') => void;
  focusSpent?: boolean;
  onSpendFocus?: () => void;
  embraceBonusDice?: number;
  endingDetails?: { ending_key: string; is_true_ending: boolean };
  cachedNarration?: CachedSection | null;
  loadingNarration?: boolean;
  aiArtEnabled?: boolean;
  runId?: string;
  openingPlatePrompt?: string;
  startSection?: number;
}

const BookSpread: React.FC<BookSpreadProps> = ({
  section, gameState, combatState, onChoice, onCombatAction, onChangeCombatStance, onDeath, onEnding,
  onNewRun, onReturnHome, onEmbraceDarkness, focusSpent, onSpendFocus, embraceBonusDice = 0, endingDetails,
  cachedNarration, loadingNarration, aiArtEnabled, runId, openingPlatePrompt, startSection = 1,
}) => {
  const isDead = section.is_death || gameState.resources.health <= 0;
  const isEnding = section.is_ending;
  const [generatingPlate, setGeneratingPlate] = useState(false);
  const [plateUrl, setPlateUrl] = useState<string | null>(cachedNarration?.plate_url || null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const activeTwist = getActiveTwist(gameState.status_effects);

  React.useEffect(() => {
    if (isDead) onDeath();
    if (isEnding) onEnding();
  }, [isDead, isEnding]);

  React.useEffect(() => {
    setPlateUrl(cachedNarration?.plate_url || null);
    setSelectedChoice(null);
  }, [cachedNarration?.plate_url, section.section_number]);

  // Auto-generate plate when AI art is enabled and section has a plate
  React.useEffect(() => {
    if (aiArtEnabled && section.has_plate && !plateUrl && !generatingPlate && runId) {
      handleGeneratePlate();
    }
  }, [aiArtEnabled, section.section_number, plateUrl, runId]);

  const displayTitle = cachedNarration?.title || section.title;
  const displayText = cachedNarration?.narrator_text || section.narrator_text;
  const plateCaption = cachedNarration?.plate_caption || section.plate_caption;

  const handleGeneratePlate = async () => {
    if (!runId || generatingPlate) return;
    setGeneratingPlate(true);
    
    // For the start section, prefer opening_plate_prompt
    const isStart = section.section_number === startSection;
    const prompt = isStart && openingPlatePrompt
      ? openingPlatePrompt
      : (cachedNarration?.plate_prompt || undefined);
    
    if (isStart) {
      console.log('[Telemetry] section1_plate_requested_at:', Date.now());
    }
    
    const url = await generatePlate(
      runId,
      section.section_number,
      prompt,
      plateCaption || section.title,
    );
    if (url) {
      setPlateUrl(url);
      if (isStart) {
        console.log('[Telemetry] section1_plate_ready_at:', Date.now());
      }
    }
    setGeneratingPlate(false);
  };

  // Get focus cost label based on twist
  const focusCost = activeTwist?.type === 'HollowContract' ? 2 : 1;
  const focusTnReduction = activeTwist?.type === 'HollowContract' ? 2 : 1;

  return (
    <motion.div
      key={section.section_number}
      initial={{ opacity: 0, rotateY: -3 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="page-parchment rounded-lg border-ornate p-6 sm:p-10 min-h-[60vh] relative overflow-hidden">
        {/* Codex unlock ink stamp */}
        {section.codex_unlock && (
          <div className="absolute top-4 right-4 animate-ink-stamp pointer-events-none">
            <div className="w-16 h-16 rounded-full border-2 border-gold/60 flex items-center justify-center rotate-[-12deg]">
              <span className="font-display text-[10px] text-gold/80 text-center leading-tight uppercase tracking-wider">Codex<br/>Updated</span>
            </div>
          </div>
        )}

        {/* Twist proclamation banner */}
        {section.is_twist && (
          <div className="mb-6 animate-proclamation border-y border-gold/40 py-3 bg-destructive/5">
            <p className="font-display text-xs text-center text-gold tracking-[0.3em] uppercase">⚡ A Proclamation Has Been Nailed to the Door ⚡</p>
          </div>
        )}

        {/* Section number + act tag */}
        <div className="text-center mb-6">
          <span className="section-number text-3xl">{section.section_number}</span>
          <h2 className="font-display text-lg text-foreground mt-1">{displayTitle}</h2>
          {section.act_tag && (
            <span className="text-xs text-muted-foreground font-display tracking-widest">{section.act_tag.replace('_', ' ')}</span>
          )}
        </div>

        {/* Twist badge */}
        {activeTwist && (
          <div className="mb-4 flex items-center justify-center gap-2 py-1.5 px-3 rounded border border-destructive/30 bg-destructive/5 text-xs font-display text-destructive">
            <AlertTriangle size={12} />
            <span>Twist Active: {activeTwist.name}</span>
            <span className="text-muted-foreground ml-1">— {activeTwist.description}</span>
          </div>
        )}

        {/* Plate */}
        {section.has_plate && (
          <div className="my-6">
            {plateUrl ? (
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                <img
                  src={plateUrl}
                  alt={plateCaption || 'Ink plate illustration'}
                  className="w-full max-w-md rounded border border-gold-dim"
                  loading="lazy"
                />
                {plateCaption && <p className="mt-2 text-sm text-muted-foreground italic font-narrative text-center">{plateCaption}</p>}
              </motion.div>
            ) : (
              <div>
                <InkPlate caption={plateCaption || undefined} />
                {generatingPlate && (
                  <div className="text-center mt-2 flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin text-gold" />
                    <span className="text-xs text-muted-foreground font-display">Illustration is being inked…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Narrator text or loading state */}
        {loadingNarration ? (
          <div className="flex items-center gap-2 mb-8 py-8">
            <Loader2 size={14} className="animate-spin text-gold" />
            <span className="text-xs text-muted-foreground font-display">The Narrator composes…</span>
          </div>
        ) : (
          <div className="text-narrative text-foreground whitespace-pre-line mb-8">
            {displayText}
          </div>
        )}

        {/* Death */}
        {isDead && (
          <div className="border border-destructive/30 bg-destructive/5 rounded p-6 text-center mt-6">
            <Skull className="mx-auto mb-2 text-destructive" size={24} />
            <p className="font-display text-destructive text-sm tracking-wider uppercase mb-2">You Are Dead</p>
            {section.death_epitaph && (
              <p className="font-narrative text-muted-foreground italic mb-4">{section.death_epitaph}</p>
            )}
            {section.death_cause && (
              <p className="text-xs text-muted-foreground mb-4">Cause: {section.death_cause.replace(/_/g, ' ')}</p>
            )}
            <div className="flex gap-3 justify-center mt-4">
              {onNewRun && (
                <button onClick={onNewRun} className="flex items-center gap-2 px-4 py-2 rounded border border-gold bg-gold/10 text-gold font-display text-sm hover:bg-gold/20 transition-colors">
                  <BookOpen size={14} /> New Run
                </button>
              )}
              {onReturnHome && (
                <button onClick={onReturnHome} className="flex items-center gap-2 px-4 py-2 rounded border border-border text-foreground font-display text-sm hover:bg-muted/30 transition-colors">
                  <Home size={14} /> Return Home
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ending */}
        {isEnding && (
          <div className="border border-gold/30 bg-gold/5 rounded p-6 text-center mt-6">
            <Flame className="mx-auto mb-2 text-gold" size={24} />
            <p className="font-display text-gold text-sm tracking-wider uppercase mb-2">
              {endingDetails?.is_true_ending ? 'TRUE ENDING' : 'The End'}
            </p>
            {endingDetails && (
              <p className="text-xs text-muted-foreground mb-2">
                Ending: {endingDetails.ending_key.replace(/_/g, ' ')}
                {endingDetails.is_true_ending && ' ★'}
              </p>
            )}
            <div className="flex gap-3 justify-center mt-4">
              {onNewRun && (
                <button onClick={onNewRun} className="flex items-center gap-2 px-4 py-2 rounded border border-gold bg-gold/10 text-gold font-display text-sm hover:bg-gold/20 transition-colors">
                  <BookOpen size={14} /> New Run
                </button>
              )}
              {onReturnHome && (
                <button onClick={onReturnHome} className="flex items-center gap-2 px-4 py-2 rounded border border-border text-foreground font-display text-sm hover:bg-muted/30 transition-colors">
                  <Home size={14} /> Return Home
                </button>
              )}
            </div>
          </div>
        )}

        {/* Combat UI */}
        {combatState && !isDead && (
          <div className="mt-6 border border-border rounded p-4 bg-muted/20">
            <h3 className="font-display text-sm text-destructive tracking-wider uppercase mb-3">
              ⚔ Combat: {combatState.enemy.name}
            </h3>
            <div className="grid grid-cols-2 gap-1 sm:flex sm:gap-4 text-xs text-muted-foreground mb-3">
              <span>Enemy HP: {combatState.enemy_health}/{combatState.enemy.health}</span>
              <span>Round: {combatState.round}</span>
              <span>Stance: {combatState.player_stance}</span>
              <span>Range: {combatState.player_range}</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {(['Aggressive', 'Guarded', 'Cunning'] as Stance[]).map(s => (
                <button
                  key={s}
                  onClick={() => onChangeCombatStance(s)}
                  className={`text-xs px-3 py-2 rounded border font-display touch-manipulation ${
                    combatState.player_stance === s
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button onClick={() => onCombatAction('attack')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 text-sm font-display touch-manipulation">
                <Sword size={14} /> Attack
              </button>
              <button onClick={() => onCombatAction('defend')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-gold-dim text-foreground hover:bg-gold/10 text-sm font-display touch-manipulation">
                <Shield size={14} /> Defend
              </button>
              <button onClick={() => onCombatAction('trick')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-accent/50 text-accent hover:bg-accent/10 text-sm font-display touch-manipulation">
                <Zap size={14} /> Trick
              </button>
              <button onClick={() => onCombatAction('advance')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground text-sm font-display touch-manipulation">
                <ArrowUp size={14} /> Advance
              </button>
              <button onClick={() => onCombatAction('withdraw')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground text-sm font-display touch-manipulation">
                <ArrowDown size={14} /> Withdraw
              </button>
              <button onClick={() => onCombatAction('flee')} className="flex items-center gap-2 px-3 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground text-sm font-display touch-manipulation">
                <ArrowRight size={14} /> Flee
              </button>
            </div>

            {combatState.log.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto text-xs text-muted-foreground font-narrative space-y-1">
                {combatState.log.slice(-5).map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Choices */}
        {!combatState && !isDead && !isEnding && section.choices.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="font-display text-xs tracking-widest text-gold-dim uppercase">What do you do?</h3>
            {section.choices.map((choice, i) => {
              const gated = choice.type === 'gated' && !canMakeGatedChoice(gameState, choice);
              const isClueGated = choice.required_clue_tags && choice.required_clue_tags.length > 0;
              const flavorKey = `choice_${i}`;
              const flavor = cachedNarration?.choice_flavor?.[flavorKey];
              const isTest = choice.type === 'test';
              const isCombat = choice.type === 'combat';
              const gutFeel = isTest && choice.tn ? computeGutFeel(choice.tn, choice.opposing_pool, choice.base_pool) : null;
              const isSelected = selectedChoice === i;

              return (
                <motion.div
                  key={i}
                  layout
                  className={`rounded-lg border transition-all overflow-hidden ${
                    gated
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'border-gold/60 bg-muted/30 ring-1 ring-gold/20'
                        : 'border-border hover:border-gold-dim/60 hover:bg-muted/10 cursor-pointer'
                  }`}
                  onClick={() => {
                    if (gated) return;
                    if (!isTest || isSelected) {
                      // Free choices or second click on test → execute
                      if (!isTest) onChoice(choice);
                      else setSelectedChoice(isSelected ? null : i);
                    } else {
                      setSelectedChoice(i);
                    }
                  }}
                >
                  {/* Card header */}
                  <div className="p-3 flex items-start gap-3">
                    {gated && <Lock size={14} className="mt-0.5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-narrative text-sm text-foreground leading-snug">{choice.label}</p>
                      {flavor && (
                        <p className="text-xs text-gold-dim/70 mt-1">{flavor}</p>
                      )}
                      {isClueGated && gated && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Needs leverage — {choice.min_clues_required || choice.required_clue_tags!.length} clues required
                        </p>
                      )}
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {isTest && choice.stat_used && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[11px] font-display text-gold tracking-wide">
                          {choice.stat_used} test
                        </span>
                      )}
                      {isCombat && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-[11px] font-display text-destructive tracking-wide">
                          <Sword size={10} /> Combat
                        </span>
                      )}
                      {gutFeel && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-display tracking-wide border ${
                          gutFeel === 'Feels safe' ? 'bg-accent/10 border-accent/30 text-accent'
                          : gutFeel === 'Risky' ? 'bg-gold/10 border-gold/30 text-gold'
                          : 'bg-destructive/10 border-destructive/30 text-destructive'
                        }`}>
                          {gutFeel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded state for test choices */}
                  <AnimatePresence>
                    {isSelected && isTest && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                          {choice.stakes && (
                            <p className="text-xs text-muted-foreground">{choice.stakes}</p>
                          )}

                          {/* Roll tools inline */}
                          <div className="flex flex-wrap gap-2">
                            {gameState.resources.focus >= focusCost && !focusSpent && onSpendFocus && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onSpendFocus(); }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-hex-blue/50 text-foreground text-xs font-display hover:bg-muted/30 transition-colors touch-manipulation"
                              >
                                <Brain size={11} className="text-hex" /> Spend {focusCost} Focus (-{focusTnReduction} TN)
                              </button>
                            )}
                            {focusSpent && <span className="text-xs text-gold font-display py-1.5">TN -{focusTnReduction} ✓</span>}
                            {embraceBonusDice > 0 && <span className="text-xs text-destructive font-display py-1.5">+{embraceBonusDice} dice ✓</span>}
                            {embraceBonusDice === 0 && onEmbraceDarkness && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onEmbraceDarkness('madness'); }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-madness-green/50 text-foreground text-xs font-display hover:bg-muted/30 transition-colors touch-manipulation"
                                >
                                  <Skull size={11} className="text-madness" /> Madness (+2 dice)
                                  {activeTwist?.type === 'GreyNotice' && <span className="text-destructive text-[10px]">⚡</span>}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onEmbraceDarkness('taint'); }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-taint-purple/50 text-foreground text-xs font-display hover:bg-muted/30 transition-colors touch-manipulation"
                                >
                                  <Skull size={11} className="text-taint" /> Taint (+2 dice)
                                  {activeTwist?.type === 'GreyNotice' && <span className="text-destructive text-[10px]">⚡</span>}
                                </button>
                              </>
                            )}
                          </div>

                          {/* Confirm roll button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onChoice(choice); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-gold/15 border border-gold/40 text-gold font-display text-sm hover:bg-gold/25 transition-colors touch-manipulation"
                          >
                            <ArrowRight size={14} /> Roll the Bones
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs font-display pb-[env(safe-area-inset-bottom)]">
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
