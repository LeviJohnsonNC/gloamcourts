import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameState } from '@/hooks/useGameState';
import BookSpread from '@/components/BookSpread';
import DiceTray from '@/components/DiceTray';
import BookmarkPanel from '@/components/BookmarkPanel';
import CharacterCreation from '@/components/CharacterCreation';
import { Stats, TRAITS } from '@/rules/types';
import { hasUsedTraitAbility } from '@/rules/engine';
import { playPageFlip } from '@/lib/pageFlipSound';
import { fetchOrGenerateSection, CachedSection } from '@/lib/llmService';
import { Book, Scroll, Home, Copy, Check, Loader2, Lightbulb, MoreVertical, CircleDot, Circle, CheckCircle2 } from 'lucide-react';
import heroBg from '@/assets/hero-bg.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

const RITUAL_STEPS = [
  { key: 'summoning', label: 'Summoning the Author', flavor: 'A quill scratches in the dark…' },
  { key: 'plotting', label: 'Plotting Your Fate', flavor: 'The threads of destiny pull taut…' },
  { key: 'binding', label: 'Binding the Pages', flavor: 'Leather and bone, pressed together…' },
  { key: 'sealing', label: 'Sealing the Cover', flavor: 'Wax drips. The seal is set.' },
] as const;

const LoadingRitual: React.FC<{ stage: string; seed: string }> = ({ stage, seed }) => {
  const activeIndex = RITUAL_STEPS.findIndex(s => s.key === stage);
  const progress = Math.max(0, ((activeIndex) / RITUAL_STEPS.length) * 100);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.h2
        className="font-display text-gold text-lg sm:text-xl tracking-[0.2em] mb-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        ✦ The Author Awakens ✦
      </motion.h2>

      <div className="w-full max-w-sm space-y-3">
        {RITUAL_STEPS.map((step, i) => {
          const status = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <AnimatePresence key={step.key}>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                className="flex items-start gap-3"
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {status === 'done' && (
                    <CheckCircle2 size={18} className="text-gold" />
                  )}
                  {status === 'active' && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    >
                      <CircleDot size={18} className="text-blood" />
                    </motion.div>
                  )}
                  {status === 'pending' && (
                    <Circle size={18} className="text-muted-foreground/40" />
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <p className={`font-display text-sm tracking-wide ${
                    status === 'done' ? 'text-gold-dim line-through' :
                    status === 'active' ? 'text-foreground' :
                    'text-muted-foreground/50'
                  }`}>
                    {step.label}
                  </p>
                  {status === 'active' && (
                    <motion.p
                      className="font-narrative text-xs text-blood/80 italic mt-0.5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      {step.flavor}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mt-8">
        <Progress value={progress} className="h-1.5 bg-muted/30" />
      </div>

      {/* Seed */}
      <motion.p
        className="text-xs text-muted-foreground font-narrative mt-6 tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Seed: {seed}
      </motion.p>
    </div>
  );
};

const BookReader: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    gameState, outline, currentSection, combatState,
    lastRoll, showDiceTray, setShowDiceTray,
    focusSpentThisRoll, embraceBonusDice,
    generatingOutline, outlineStage,
    createNewRun, loadRun, makeChoice, doCombatAction,
    changeCombatStance, recordDeath, completeRun,
    spendLuckReroll, spendFocusReduceTn, doEmbraceDarkness,
    useDeathsJest, goToSection,
  } = useGameState();

  const [showCharCreate, setShowCharCreate] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showRumors, setShowRumors] = useState(false);
  const [showClues, setShowClues] = useState(false);
  const [seed, setSeed] = useState('');
  const [isSharedReplay, setIsSharedReplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionInput, setSectionInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [cachedNarration, setCachedNarration] = useState<CachedSection | null>(null);
  const [loadingNarration, setLoadingNarration] = useState(false);
  const [aiArtEnabled, setAiArtEnabled] = useState(() => {
    return localStorage.getItem('gloam_ai_art') !== 'false';
  });

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (runId === 'new') {
      setShowCharCreate(true);
      setSeed(Date.now().toString(36));
      setIsSharedReplay(false);
      setLoading(false);
    } else if (runId === 'new-seed') {
      setShowCharCreate(true);
      const params = new URLSearchParams(window.location.search);
      setSeed(params.get('seed') || Date.now().toString(36));
      setIsSharedReplay(true);
      setLoading(false);
    } else if (runId) {
      loadRun(runId).then(() => setLoading(false));
    }
  }, [runId, user]);

  // Fetch/generate narration when section changes
  useEffect(() => {
    if (!currentSection || !gameState || !outline) {
      setCachedNarration(null);
      return;
    }
    setLoadingNarration(true);
    fetchOrGenerateSection(gameState.run_id, currentSection, gameState, outline)
      .then(result => {
        setCachedNarration(result);
        setLoadingNarration(false);
      })
      .catch(() => setLoadingNarration(false));
  }, [currentSection?.section_number, gameState?.run_id]);

  // Prefetch next reachable sections while player reads
  useEffect(() => {
    if (!currentSection || !gameState || !outline || loadingNarration) return;

    const targets = new Set<number>();
    for (const c of currentSection.choices) {
      if (c.next_section) targets.add(c.next_section);
      if (c.success_section) targets.add(c.success_section);
      if (c.fail_section) targets.add(c.fail_section);
    }

    targets.forEach(sn => {
      const sec = outline.sections.find((s: any) => s.section_number === sn);
      if (sec) {
        fetchOrGenerateSection(gameState.run_id, sec, gameState, outline);
      }
    });
  }, [currentSection?.section_number, loadingNarration]);

  const handleCharCreate = async (stats: Stats, traitKey: string, description: string) => {
    if (!user) return;
    const newRunId = await createNewRun(user.id, seed, stats, traitKey, description, isSharedReplay);
    setShowCharCreate(false);
    navigate(`/book/${newRunId}`, { replace: true });
  };

  const handleChoice = useCallback((choice: any) => {
    playPageFlip();
    makeChoice(choice);
  }, [makeChoice]);

  const handleDeath = useCallback(() => {
    if (currentSection?.is_death && currentSection.death_cause && currentSection.death_epitaph) {
      recordDeath(currentSection.section_number, currentSection.death_cause, currentSection.death_epitaph);
    }
  }, [currentSection, recordDeath]);

  const handleEnding = useCallback(() => {
    if (currentSection?.ending_key) {
      completeRun(currentSection.ending_key, currentSection.is_true_ending || false);
    }
  }, [currentSection, completeRun]);

  const handleGoToSection = () => {
    const num = parseInt(sectionInput);
    if (isNaN(num)) return;
    playPageFlip();
    goToSection(num);
    setSectionInput('');
  };

  const handleCopySeed = () => {
    if (outline?.seed) {
      navigator.clipboard.writeText(outline.seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied!', description: 'Run code copied to clipboard.' });
    }
  };

  const toggleAiArt = () => {
    const next = !aiArtEnabled;
    setAiArtEnabled(next);
    localStorage.setItem('gloam_ai_art', String(next));
  };

  const canUseTrait = gameState?.trait_key === 'deaths_jest' && !hasUsedTraitAbility(gameState, 'deaths_jest')
    ? { key: 'deaths_jest', name: "Death's Jest" }
    : null;

  const playerClues = gameState?.inventory.filter(i => i.is_clue) || [];
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-display text-gold animate-pulse">Loading...</p>
      </div>
    );
  }

  if (generatingOutline) {
    return <LoadingRitual stage={outlineStage} seed={seed} />;
  }

  if (showCharCreate) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* Hero background layers (same as Index) */}
        <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, hsl(30 15% 10% / 0.55) 0%, hsl(30 15% 6% / 0.88) 60%, hsl(0 0% 0% / 0.95) 100%)' }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay">
          <svg width="100%" height="100%">
            <filter id="grain-cc"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
            <rect width="100%" height="100%" filter="url(#grain-cc)" />
          </svg>
        </div>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute animate-candle-flicker" style={{ width: '800px', height: '800px', top: '-15%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at center, hsl(40 50% 45% / 0.08) 0%, hsl(30 40% 30% / 0.03) 40%, transparent 70%)' }} />
        </div>
        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-8">
          <CharacterCreation onComplete={handleCharCreate} />
        </div>
      </div>
    );
  }

  if (!currentSection || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-narrative">No adventure found.</p>
      </div>
    );
  }

  const endingDetails = currentSection.is_ending && currentSection.ending_key
    ? { ending_key: currentSection.ending_key, is_true_ending: currentSection.is_true_ending || false }
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground p-1.5 touch-manipulation"><Home size={18} /></button>
          <h1 className="font-display text-sm text-gold tracking-wider truncate max-w-[120px] sm:max-w-none">{outline?.title}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {playerClues.length > 0 && (
            <button onClick={() => setShowClues(true)} className="text-muted-foreground hover:text-gold transition-colors relative p-1.5 touch-manipulation" title="Clues">
              <Lightbulb size={18} />
              <span className="absolute -top-0.5 -right-0.5 bg-gold text-background text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-display">{playerClues.length}</span>
            </button>
          )}
          <button onClick={() => setShowCodex(true)} className="text-muted-foreground hover:text-gold transition-colors p-1.5 touch-manipulation" title="Codex">
            <Book size={18} />
          </button>
          <button onClick={() => setShowRumors(true)} className="text-muted-foreground hover:text-gold transition-colors p-1.5 touch-manipulation" title="Rumors">
            <Scroll size={18} />
          </button>

          {/* Desktop: inline controls */}
          {!isMobile && (
            <>
              {outline?.seed && (
                <button
                  onClick={handleCopySeed}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors font-display p-1.5"
                  title={`Run Code: ${outline.seed}`}
                >
                  {copied ? <Check size={12} className="text-gold" /> : <Copy size={12} />}
                  <span>{outline.seed}</span>
                </button>
              )}
              <input
                value={sectionInput}
                onChange={e => setSectionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGoToSection()}
                placeholder="§"
                className="w-12 bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground text-center placeholder:text-muted-foreground"
              />
              <button
                onClick={toggleAiArt}
                className={`text-xs px-2 py-1 rounded border font-display transition-colors ${
                  aiArtEnabled ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-foreground'
                }`}
                title="Toggle AI art plates"
              >
                🎨
              </button>
            </>
          )}

          {/* Mobile: overflow menu */}
          {isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-1.5 touch-manipulation">
                  <MoreVertical size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                {outline?.seed && (
                  <DropdownMenuItem onClick={handleCopySeed} className="text-xs font-display gap-2">
                    {copied ? <Check size={12} className="text-gold" /> : <Copy size={12} />}
                    Copy Run Code
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="p-0">
                  <input
                    value={sectionInput}
                    onChange={e => setSectionInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleGoToSection(); }}
                    placeholder="Go to section §"
                    className="w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                    onClick={e => e.stopPropagation()}
                  />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleAiArt} className="text-xs font-display gap-2">
                  🎨 AI Art {aiArtEnabled ? '(On)' : '(Off)'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 sm:p-8 pb-24">
        <BookSpread
          section={currentSection}
          gameState={gameState}
          combatState={combatState}
          onChoice={handleChoice}
          onCombatAction={doCombatAction}
          onChangeCombatStance={changeCombatStance}
          onDeath={handleDeath}
          onEnding={handleEnding}
          onNewRun={() => navigate('/book/new')}
          onReturnHome={() => navigate('/')}
          onEmbraceDarkness={doEmbraceDarkness}
          focusSpent={focusSpentThisRoll}
          onSpendFocus={spendFocusReduceTn}
          embraceBonusDice={embraceBonusDice}
          endingDetails={endingDetails}
          cachedNarration={cachedNarration}
          loadingNarration={loadingNarration}
          aiArtEnabled={aiArtEnabled}
          runId={gameState.run_id}
          openingPlatePrompt={outline?.opening_plate_prompt}
          startSection={outline?.start_section}
        />
      </main>

      {/* Dice Tray */}
      <DiceTray
        rollOutcome={lastRoll}
        visible={showDiceTray}
        onClose={() => setShowDiceTray(false)}
        luck={gameState.resources.luck}
        focus={gameState.resources.focus}
        focusSpent={focusSpentThisRoll}
        canUseTrait={canUseTrait}
        onSpendLuck={spendLuckReroll}
        onSpendFocus={spendFocusReduceTn}
        onUseDeathsJest={useDeathsJest}
      />

      {/* Bookmark panels */}
      <BookmarkPanel type="codex" visible={showCodex} onClose={() => setShowCodex(false)} />
      <BookmarkPanel type="rumors" visible={showRumors} onClose={() => setShowRumors(false)} />
      <BookmarkPanel type="clues" visible={showClues} onClose={() => setShowClues(false)} clues={playerClues} />
    </div>
  );
};

export default BookReader;
