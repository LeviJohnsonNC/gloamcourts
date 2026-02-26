import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameState } from '@/hooks/useGameState';
import BookSpread from '@/components/BookSpread';
import DiceTray from '@/components/DiceTray';
import BookmarkPanel from '@/components/BookmarkPanel';
import CharacterCreation from '@/components/CharacterCreation';
import { Stats } from '@/rules/types';
import { playPageFlip } from '@/lib/pageFlipSound';
import { Book, Scroll, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const BookReader: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    gameState, outline, currentSection, combatState,
    lastRoll, showDiceTray, setShowDiceTray,
    createNewRun, loadRun, makeChoice, doCombatAction,
    changeCombatStance, recordDeath, completeRun,
  } = useGameState();

  const [showCharCreate, setShowCharCreate] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showRumors, setShowRumors] = useState(false);
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(true);
  const [sectionInput, setSectionInput] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (runId === 'new') {
      setShowCharCreate(true);
      setSeed(Date.now().toString(36));
      setLoading(false);
    } else if (runId === 'new-seed') {
      // Handled by landing page passing seed in state
      setShowCharCreate(true);
      const params = new URLSearchParams(window.location.search);
      setSeed(params.get('seed') || Date.now().toString(36));
      setLoading(false);
    } else if (runId) {
      loadRun(runId).then(() => setLoading(false));
    }
  }, [runId, user]);

  const handleCharCreate = async (stats: Stats, traitKey: string, description: string) => {
    if (!user) return;
    const newRunId = await createNewRun(user.id, seed, stats, traitKey, description);
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
    if (!gameState || !outline || isNaN(num)) return;
    if (!gameState.visited_sections.includes(num)) return;
    const section = outline.sections.find(s => s.section_number === num);
    if (section) {
      playPageFlip();
      // We just navigate display, not state
    }
    setSectionInput('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-display text-gold animate-pulse">Loading...</p>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground"><Home size={18} /></button>
          <h1 className="font-display text-sm text-gold tracking-wider">{outline?.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              value={sectionInput}
              onChange={e => setSectionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGoToSection()}
              placeholder="§"
              className="w-12 bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground text-center placeholder:text-muted-foreground"
            />
          </div>
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
        />
      </main>

      {/* Dice Tray */}
      <DiceTray rollOutcome={lastRoll} visible={showDiceTray} onClose={() => setShowDiceTray(false)} />

      {/* Bookmark panels */}
      <BookmarkPanel type="codex" visible={showCodex} onClose={() => setShowCodex(false)} />
      <BookmarkPanel type="rumors" visible={showRumors} onClose={() => setShowRumors(false)} />
    </div>
  );
};

export default BookReader;
