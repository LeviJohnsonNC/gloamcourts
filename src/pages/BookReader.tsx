import React, { useEffect, useState, useCallback } from 'react';
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
import { Book, Scroll, Home, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const BookReader: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    gameState, outline, currentSection, combatState,
    lastRoll, showDiceTray, setShowDiceTray,
    focusSpentThisRoll, embraceBonusDice,
    generatingOutline,
    createNewRun, loadRun, makeChoice, doCombatAction,
    changeCombatStance, recordDeath, completeRun,
    spendLuckReroll, spendFocusReduceTn, doEmbraceDarkness,
    useDeathsJest, goToSection,
  } = useGameState();

  const [showCharCreate, setShowCharCreate] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showRumors, setShowRumors] = useState(false);
  const [seed, setSeed] = useState('');
  const [isSharedReplay, setIsSharedReplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionInput, setSectionInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [cachedNarration, setCachedNarration] = useState<CachedSection | null>(null);
  const [loadingNarration, setLoadingNarration] = useState(false);
  const [aiArtEnabled, setAiArtEnabled] = useState(() => {
    return localStorage.getItem('gloam_ai_art') === 'true';
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
    // Only attempt LLM narration if the section text is empty/stub
    if (currentSection.narrator_text && currentSection.narrator_text.length > 50) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-display text-gold animate-pulse">Loading...</p>
      </div>
    );
  }

  if (generatingOutline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="animate-spin text-gold" size={32} />
        <p className="font-display text-gold tracking-wider">Summoning the Author…</p>
        <p className="text-xs text-muted-foreground font-narrative">Seed: {seed}</p>
      </div>
    );
  }

  if (showCharCreate) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <CharacterCreation onComplete={handleCharCreate} />
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
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground"><Home size={18} /></button>
          <h1 className="font-display text-sm text-gold tracking-wider">{outline?.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {outline?.seed && (
            <button
              onClick={handleCopySeed}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors font-display"
              title={`Run Code: ${outline.seed}`}
            >
              {copied ? <Check size={12} className="text-gold" /> : <Copy size={12} />}
              <span className="hidden sm:inline">{outline.seed}</span>
            </button>
          )}
          <div className="flex items-center gap-1">
            <input
              value={sectionInput}
              onChange={e => setSectionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGoToSection()}
              placeholder="§"
              className="w-12 bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground text-center placeholder:text-muted-foreground"
            />
          </div>
          {/* AI Art toggle */}
          <button
            onClick={toggleAiArt}
            className={`text-xs px-2 py-1 rounded border font-display transition-colors ${
              aiArtEnabled ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-foreground'
            }`}
            title="Toggle AI art plates"
          >
            🎨
          </button>
          <button onClick={() => setShowCodex(true)} className="text-muted-foreground hover:text-gold transition-colors" title="Codex">
            <Book size={18} />
          </button>
          <button onClick={() => setShowRumors(true)} className="text-muted-foreground hover:text-gold transition-colors" title="Rumors">
            <Scroll size={18} />
          </button>
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
    </div>
  );
};

export default BookReader;
