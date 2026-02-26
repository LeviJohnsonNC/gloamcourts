import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameState, Section, AdventureOutline, Choice, Stats, CombatState } from '@/rules/types';
import { createInitialGameState, serializeGameState, deserializeGameState, navigateToSection, applyResourceChange, applyTrackChange, isPlayerDead } from '@/rules/engine';
import { initCombat, resolveCombatRound, isCombatOver, changeStance } from '@/rules/combat';
import { opposedRoll, simpleRoll, getPoolSize, getTargetNumber } from '@/rules/dice';
import { generateOutline } from '@/generators/demoOutlineGenerator';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [outline, setOutline] = useState<AdventureOutline | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [lastRoll, setLastRoll] = useState<any>(null);
  const [showDiceTray, setShowDiceTray] = useState(false);

  const currentSection = outline?.sections.find(s => s.section_number === gameState?.current_section) || null;

  const createNewRun = useCallback(async (userId: string, seed: string, stats: Stats, traitKey: string, characterDescription: string) => {
    const adventure = generateOutline(seed);
    setOutline(adventure);

    const { data: run, error: runError } = await supabase.from('runs').insert({
      user_id: userId,
      seed,
      title: adventure.title,
      outline_json: adventure as any,
    }).select().single();

    if (runError || !run) throw runError;

    const initialState = createInitialGameState(run.id, stats, traitKey, adventure.start_section, characterDescription);
    setGameState(initialState);

    await supabase.from('run_state').insert({
      run_id: run.id,
      user_id: userId,
      ...serializeGameState(initialState),
    } as any);

    return run.id;
  }, []);

  const loadRun = useCallback(async (runId: string) => {
    const { data: run } = await supabase.from('runs').select('*').eq('id', runId).single();
    if (!run) return false;

    const adventure = run.outline_json as unknown as AdventureOutline;
    setOutline(adventure);

    const { data: state } = await supabase.from('run_state').select('*').eq('run_id', runId).single();
    if (!state) return false;

    const gs = deserializeGameState(runId, state);
    setGameState(gs);
    return true;
  }, []);

  const loadLatestRun = useCallback(async (userId: string): Promise<string | null> => {
    const { data: runs } = await supabase
      .from('runs')
      .select('id')
      .eq('user_id', userId)
      .eq('is_complete', false)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) return runs[0].id;
    return null;
  }, []);

  const autosave = useCallback(async (state: GameState) => {
    await supabase.from('run_state').update(serializeGameState(state) as any).eq('run_id', state.run_id);
    await supabase.from('runs').update({ updated_at: new Date().toISOString() }).eq('id', state.run_id);
  }, []);

  const makeChoice = useCallback(async (choice: Choice) => {
    if (!gameState || !outline) return;

    let newState = { ...gameState };

    if (choice.type === 'free') {
      if (choice.item_gain) {
        newState = { ...newState, inventory: [...newState.inventory, choice.item_gain] };
      }
      if (choice.resource_change) {
        newState = applyResourceChange(newState, choice.resource_change);
      }
      if (choice.track_change) {
        newState = applyTrackChange(newState, choice.track_change);
      }
      const target = choice.next_section!;
      newState = navigateToSection(newState, target);
      setGameState(newState);
      await autosave(newState);

      // Handle codex/rumor unlocks
      if (choice.codex_unlock) await unlockCodex(choice.codex_unlock);
      if (choice.rumor_unlock) await unlockRumor(choice.rumor_unlock);
    } else if (choice.type === 'test') {
      // Show dice tray, perform roll
      const stat = choice.stat_used!;
      const pool = getPoolSize(stat, newState.stats, newState.stance, false, newState.status_effects);
      const tn = getTargetNumber(choice.tn || 6, newState.status_effects);

      let rollResult;
      if (choice.opposing_pool) {
        rollResult = opposedRoll(pool, tn, choice.opposing_pool, choice.tn || 6);
      } else {
        rollResult = simpleRoll(pool, tn);
      }

      setLastRoll(rollResult);
      setShowDiceTray(true);

      const success = rollResult.outcome === 'success' || rollResult.outcome === 'critical_success';
      const target = success ? choice.success_section! : choice.fail_section!;

      if (choice.item_gain && success) {
        newState = { ...newState, inventory: [...newState.inventory, choice.item_gain] };
      }
      if (choice.resource_change) {
        newState = applyResourceChange(newState, choice.resource_change);
      }
      if (choice.track_change) {
        newState = applyTrackChange(newState, choice.track_change);
      }

      newState = navigateToSection(newState, target);
      newState.log = [...newState.log, {
        section: newState.current_section,
        text: `Rolled ${stat}: ${rollResult.playerRoll.dice.join(', ')} (TN ${tn}) — ${rollResult.outcome}`,
        timestamp: Date.now(),
      }];
      setGameState(newState);
      await autosave(newState);

      if (success && choice.codex_unlock) await unlockCodex(choice.codex_unlock);
      if (success && choice.rumor_unlock) await unlockRumor(choice.rumor_unlock);
    } else if (choice.type === 'combat') {
      // Initialize combat
      const section = outline.sections.find(s => s.choices.includes(choice));
      if (section?.combat_enemy) {
        const cs = initCombat(section.combat_enemy, newState);
        setCombatState(cs);
      }
    } else if (choice.type === 'gated') {
      // Check gate
      if (choice.required_item_tag && !newState.inventory.some(i => i.tags.includes(choice.required_item_tag!))) {
        return; // Can't pass gate
      }
      const target = choice.next_section!;
      newState = navigateToSection(newState, target);
      setGameState(newState);
      await autosave(newState);
      if (choice.codex_unlock) await unlockCodex(choice.codex_unlock);
    }
  }, [gameState, outline, autosave]);

  const doCombatAction = useCallback(async (action: 'attack' | 'defend' | 'trick' | 'flee') => {
    if (!gameState || !combatState || !outline) return;

    const { gameState: newGs, combatState: newCs, rollOutcome, narrative } = resolveCombatRound(gameState, combatState, action);
    setLastRoll(rollOutcome);
    setShowDiceTray(true);

    const { over, playerWon, fled } = isCombatOver(newCs, newGs);

    if (over) {
      setCombatState(null);
      const currentSectionData = outline.sections.find(s => s.section_number === gameState.current_section);
      const combatChoice = currentSectionData?.choices.find(c => c.type === 'combat');

      if (playerWon) {
        const target = combatChoice?.success_section || gameState.current_section;
        const finalState = navigateToSection(newGs, target);
        setGameState(finalState);
        await autosave(finalState);
        if (combatChoice?.codex_unlock) await unlockCodex(combatChoice.codex_unlock);
        if (combatChoice?.rumor_unlock) await unlockRumor(combatChoice.rumor_unlock);
      } else {
        const target = combatChoice?.fail_section || gameState.current_section;
        const finalState = navigateToSection(newGs, target);
        setGameState(finalState);
        await autosave(finalState);
      }
    } else {
      setGameState(newGs);
      setCombatState(newCs);
      await autosave(newGs);
    }
  }, [gameState, combatState, outline, autosave]);

  const changeCombatStance = useCallback((stance: 'Aggressive' | 'Guarded' | 'Cunning') => {
    if (!combatState) return;
    setCombatState(changeStance(combatState, stance));
  }, [combatState]);

  const unlockCodex = async (codexKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('codex_unlocks').upsert({ user_id: user.id, codex_key: codexKey });
  };

  const unlockRumor = async (rumorKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_rumors').upsert({ user_id: user.id, rumor_key: rumorKey, level: 1 });
  };

  const recordDeath = async (section: number, cause: string, epitaph: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !gameState) return;
    await supabase.from('deaths').insert({
      user_id: user.id,
      run_id: gameState.run_id,
      section,
      cause,
      epitaph,
    });
    await supabase.from('runs').update({ is_complete: true }).eq('id', gameState.run_id);
  };

  const completeRun = async (endingKey: string, isTrueEnding: boolean) => {
    if (!gameState) return;
    await supabase.from('runs').update({
      is_complete: true,
      ending_key: endingKey,
      is_true_ending: isTrueEnding,
    }).eq('id', gameState.run_id);
  };

  const spendLuckReroll = useCallback(async () => {
    if (!gameState || gameState.resources.luck < 1) return;
    const newState = applyResourceChange(gameState, { luck: -1 });
    setGameState(newState);
    await autosave(newState);
  }, [gameState, autosave]);

  const spendFocusReduceTn = useCallback(async () => {
    if (!gameState || gameState.resources.focus < 1) return;
    const newState = applyResourceChange(gameState, { focus: -1 });
    setGameState(newState);
    await autosave(newState);
  }, [gameState, autosave]);

  return {
    gameState,
    setGameState,
    outline,
    currentSection,
    combatState,
    lastRoll,
    showDiceTray,
    setShowDiceTray,
    createNewRun,
    loadRun,
    loadLatestRun,
    makeChoice,
    doCombatAction,
    changeCombatStance,
    recordDeath,
    completeRun,
    spendLuckReroll,
    spendFocusReduceTn,
  };
}
