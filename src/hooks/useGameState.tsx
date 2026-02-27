import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameState, Section, AdventureOutline, Choice, Stats, CombatState, CombatAction, RollOutcome, RollContext } from '@/rules/types';
import { createInitialGameState, serializeGameState, deserializeGameState, navigateToSection, applyResourceChange, applyTrackChange, isPlayerDead, embraceDarkness, useTraitAbility, hasUsedTraitAbility, activateTwist, spendLuck, getFocusTnReduction } from '@/rules/engine';
import { initCombat, resolveCombatRound, isCombatOver, changeStance } from '@/rules/combat';
import { opposedRoll, simpleRoll, getPoolSize, getTargetNumber, rerollDice, countSuccesses, convertLowestDie } from '@/rules/dice';
import { generateOutline as generateDemoOutline } from '@/generators/demoOutlineGenerator';
import { generateLLMOutline } from '@/lib/llmService';
import { generateEpitaph } from '@/lib/epitaphGenerator';
import { toast } from '@/hooks/use-toast';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [outline, setOutline] = useState<AdventureOutline | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [lastRoll, setLastRoll] = useState<RollOutcome | null>(null);
  const [showDiceTray, setShowDiceTray] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<Choice | null>(null);
  const [focusSpentThisRoll, setFocusSpentThisRoll] = useState(false);
  const [embraceBonusDice, setEmbraceBonusDice] = useState(0);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineStage, setOutlineStage] = useState<string>('Summoning the Author…');

  const currentSection = outline?.sections.find(s => s.section_number === gameState?.current_section) || null;

  const createNewRun = useCallback(async (userId: string, seed: string, stats: Stats, traitKey: string, characterDescription: string, isSharedReplay: boolean = false) => {
    setGeneratingOutline(true);
    setOutlineStage('Summoning the Author…');

    let adventure: AdventureOutline | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        adventure = await generateLLMOutline(seed, (stage) => setOutlineStage(stage));
        if (adventure) break;
      } catch (e) {
        console.error(`LLM outline attempt ${attempt + 1} failed:`, e);
        if (attempt === 0) setOutlineStage('Retrying…');
      }
    }

    if (!adventure) {
      adventure = generateDemoOutline(seed);
      toast({ title: 'The Courts are silent', description: "You'll get the ink-and-paper version this time." });
    }

    setOutline(adventure);
    setGeneratingOutline(false);

    const title = isSharedReplay ? `Replay: ${adventure.title}` : adventure.title;

    const { data: run, error: runError } = await supabase.from('runs').insert({
      user_id: userId,
      seed,
      title,
      outline_json: adventure as any,
      is_shared_replay: isSharedReplay,
    }).select().single();

    if (runError || !run) {
      console.error('Failed to create run:', runError);
      toast({ title: 'Error', description: 'Failed to create run. Please try again.', variant: 'destructive' });
      throw runError;
    }

    const initialState = createInitialGameState(run.id, stats, traitKey, adventure.start_section, characterDescription);
    setGameState(initialState);

    const { error: stateError } = await supabase.from('run_state').insert({
      run_id: run.id,
      user_id: userId,
      ...serializeGameState(initialState),
    } as any);

    if (stateError) {
      console.error('Failed to create run_state:', stateError);
      toast({ title: 'Error', description: 'Failed to save initial state.', variant: 'destructive' });
    }

    return run.id;
  }, []);

  const loadRun = useCallback(async (runId: string) => {
    const { data: run, error: runErr } = await supabase.from('runs').select('*').eq('id', runId).single();
    if (runErr || !run) {
      console.error('Failed to load run:', runErr);
      return false;
    }

    const adventure = run.outline_json as unknown as AdventureOutline;
    setOutline(adventure);

    const { data: state, error: stateErr } = await supabase.from('run_state').select('*').eq('run_id', runId).single();
    if (stateErr || !state) {
      console.error('Failed to load run_state:', stateErr);
      return false;
    }

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
    const { error: updateErr } = await supabase.from('run_state').update(serializeGameState(state) as any).eq('run_id', state.run_id);
    if (updateErr) console.error('Autosave failed:', updateErr);
    await supabase.from('runs').update({ updated_at: new Date().toISOString() }).eq('id', state.run_id);
  }, []);

  const goToSection = useCallback(async (sectionNumber: number) => {
    if (!gameState || !outline) return false;
    if (!gameState.visited_sections.includes(sectionNumber)) {
      toast({ title: 'Section not visited', description: `You haven't visited section ${sectionNumber} yet.`, variant: 'destructive' });
      return false;
    }
    const section = outline.sections.find(s => s.section_number === sectionNumber);
    if (!section) {
      toast({ title: 'Section not found', description: `Section ${sectionNumber} doesn't exist in this adventure.`, variant: 'destructive' });
      return false;
    }
    const newState = navigateToSection(gameState, sectionNumber);
    setGameState(newState);
    await autosave(newState);
    return true;
  }, [gameState, outline, autosave]);

  const getRollContext = useCallback((choice: Choice): RollContext => {
    if (choice.roll_context) return choice.roll_context;
    const stat = choice.stat_used;
    if (stat === 'GUILE') return 'social';
    if (stat === 'WITS') return 'investigation';
    if (stat === 'HEX') return 'hex';
    if (stat === 'GRACE') return 'stealth';
    if (stat === 'STEEL') return 'endurance';
    return 'general';
  }, []);

  /** Check for twist activation when navigating to a section */
  const checkTwistActivation = useCallback((state: GameState, section: Section): GameState => {
    if (section.is_twist && section.twist_type) {
      const newState = activateTwist(state, section.twist_type);
      if (newState !== state) {
        // Show proclamation-style toast
        const proclamations: Record<string, string> = {
          DebtWrit: 'BY DECREE OF THE COURTS: All expenditures of fortune shall henceforth incur… interest.',
          GreyNotice: 'NOTICE FROM THE GREY PROTOCOL: Your darkness is now being audited. Additional consequences apply.',
          HollowContract: 'THE HOLLOW CONTRACT IS SEALED: Your clarity costs double. But oh, how clear things become.',
        };
        toast({
          title: '⚡ PROCLAMATION',
          description: proclamations[section.twist_type] || 'The rules have changed. The Courts send their regards.',
        });
      }
      return newState;
    }
    return state;
  }, []);

  const makeChoice = useCallback(async (choice: Choice) => {
    if (!gameState || !outline) return;

    let newState = { ...gameState };

    if (choice.type === 'free') {
      if (choice.item_gain) {
        newState = { ...newState, inventory: [...newState.inventory, choice.item_gain] };
        if (choice.item_gain.is_clue) notifyClueGain(choice.item_gain.name);
      }
      if (choice.resource_change) {
        newState = applyResourceChange(newState, choice.resource_change);
      }
      if (choice.track_change) {
        newState = applyTrackChange(newState, choice.track_change);
      }
      const target = choice.next_section!;
      newState = navigateToSection(newState, target);

      // Check twist
      const targetSection = outline.sections.find(s => s.section_number === target);
      if (targetSection) newState = checkTwistActivation(newState, targetSection);

      setGameState(newState);
      await autosave(newState);

      if (choice.codex_unlock) await unlockCodex(choice.codex_unlock);
      if (choice.rumor_unlock) await unlockRumor(choice.rumor_unlock);
    } else if (choice.type === 'test') {
      const stat = choice.stat_used!;
      const context = getRollContext(choice);
      const hasRanged = newState.inventory.some(i => i.tags.includes('ranged') || i.tags.includes('Ranged'));
      const pool = getPoolSize(stat, newState.stats, newState.stance, false, newState.status_effects, embraceBonusDice, newState.trait_key, context, newState.range_band, hasRanged);
      const focusReduction = focusSpentThisRoll ? getFocusTnReduction(newState) : 0;
      const tn = getTargetNumber(choice.tn || 6, newState.status_effects, focusReduction > 0);

      let rollResult;
      if (choice.opposing_pool) {
        rollResult = opposedRoll(pool, tn, choice.opposing_pool, choice.tn || 6);
      } else {
        rollResult = simpleRoll(pool, tn);
      }
      rollResult.stat_used = stat;
      rollResult.roll_context = context;

      setLastRoll(rollResult);
      setShowDiceTray(true);
      setPendingChoice(choice);

      if (embraceBonusDice > 0) {
        setEmbraceBonusDice(0);
      }
      setFocusSpentThisRoll(false);

      const success = rollResult.outcome === 'success' || rollResult.outcome === 'critical_success';
      const target = success ? choice.success_section! : choice.fail_section!;

      if (choice.item_gain && success) {
        newState = { ...newState, inventory: [...newState.inventory, choice.item_gain] };
        if (choice.item_gain.is_clue) notifyClueGain(choice.item_gain.name);
      }
      if (choice.resource_change) {
        newState = applyResourceChange(newState, choice.resource_change);
      }
      if (choice.track_change) {
        newState = applyTrackChange(newState, choice.track_change);
      }

      newState = navigateToSection(newState, target);

      // Check twist
      const targetSection = outline.sections.find(s => s.section_number === target);
      if (targetSection) newState = checkTwistActivation(newState, targetSection);

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
      const section = outline.sections.find(s => s.choices.includes(choice));
      if (section?.combat_enemy) {
        const cs = initCombat(section.combat_enemy, newState);
        setCombatState(cs);
      }
    } else if (choice.type === 'gated') {
      if (choice.required_item_tag && !newState.inventory.some(i => i.tags.includes(choice.required_item_tag!))) {
        toast({ title: 'Locked', description: `You need an item with the "${choice.required_item_tag}" tag.`, variant: 'destructive' });
        return;
      }
      // Clue gate check
      if (choice.required_clue_tags && choice.required_clue_tags.length > 0) {
        const minRequired = choice.min_clues_required || choice.required_clue_tags.length;
        const playerClueTags = newState.inventory.filter(i => i.is_clue).flatMap(i => i.tags.filter(t => t.startsWith('Clue:')));
        const matchCount = choice.required_clue_tags.filter(t => playerClueTags.includes(t)).length;
        if (matchCount < minRequired) {
          toast({ title: 'Insufficient leverage', description: `You need more clues. (${matchCount}/${minRequired})`, variant: 'destructive' });
          return;
        }
      }
      const target = choice.next_section!;
      newState = navigateToSection(newState, target);

      const targetSection = outline.sections.find(s => s.section_number === target);
      if (targetSection) newState = checkTwistActivation(newState, targetSection);

      setGameState(newState);
      await autosave(newState);
      if (choice.codex_unlock) await unlockCodex(choice.codex_unlock);
    }
  }, [gameState, outline, autosave, embraceBonusDice, focusSpentThisRoll, getRollContext, checkTwistActivation]);

  const doCombatAction = useCallback(async (action: CombatAction) => {
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
        let finalState = navigateToSection(newGs, target);
        const targetSection = outline.sections.find(s => s.section_number === target);
        if (targetSection) finalState = checkTwistActivation(finalState, targetSection);
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
  }, [gameState, combatState, outline, autosave, checkTwistActivation]);

  const changeCombatStance = useCallback((stance: 'Aggressive' | 'Guarded' | 'Cunning') => {
    if (!combatState) return;
    setCombatState(changeStance(combatState, stance));
  }, [combatState]);

  const unlockCodex = async (codexKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('codex_unlocks').upsert({ user_id: user.id, codex_key: codexKey });
    if (error) {
      console.error('Failed to unlock codex:', error);
      return;
    }
    // Fetch codex title for toast
    const { data: entry } = await supabase.from('codex_entries').select('title').eq('codex_key', codexKey).maybeSingle();
    toast({ title: '📖 Codex Updated', description: entry?.title || codexKey.replace(/_/g, ' ') });
  };

  const unlockRumor = async (rumorKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('user_rumors').upsert({ user_id: user.id, rumor_key: rumorKey, level: 1 });
    if (error) console.error('Failed to unlock rumor:', error);
  };

  const notifyClueGain = (itemName: string) => {
    toast({ title: '🔍 New Clue Logged', description: itemName });
  };

  const grantDeathRumor = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: allRumors } = await supabase.from('rumors_catalog').select('rumor_key');
    const { data: userRumors } = await supabase.from('user_rumors').select('rumor_key, level').eq('user_id', user.id);
    if (!allRumors) return;
    const ownedKeys = new Set((userRumors || []).map(r => r.rumor_key));
    const unowned = allRumors.filter(r => !ownedKeys.has(r.rumor_key));
    if (unowned.length > 0) {
      const pick = unowned[Math.floor(Math.random() * unowned.length)];
      await supabase.from('user_rumors').upsert({ user_id: user.id, rumor_key: pick.rumor_key, level: 1 });
      toast({ title: 'Rumor Gained', description: `Death whispers secrets. You learned something new.` });
    } else if (userRumors && userRumors.length > 0) {
      const upgradeable = userRumors.filter(r => r.level < 3);
      if (upgradeable.length > 0) {
        const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        await supabase.from('user_rumors').update({ level: pick.level + 1 }).eq('user_id', user.id).eq('rumor_key', pick.rumor_key);
        toast({ title: 'Rumor Deepened', description: `Death reveals more of what you already knew.` });
      }
    }
  };

  const recordDeath = async (section: number, cause: string, epitaph: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !gameState) return;

    // Generate deterministic epitaph using template system
    const currentSec = outline?.sections.find(s => s.section_number === section);
    const worldBible = outline?.world_bible;
    const activeTwist = gameState.status_effects.find(e => e.key === 'TWIST' && e.active);
    const finalEpitaph = generateEpitaph(
      outline?.seed || gameState.run_id,
      section,
      {
        place: currentSec?.title || 'the Gloam Courts',
        faction: worldBible?.factions?.[0]?.name || 'the Pallid Ministry',
        itemName: gameState.inventory.length > 0 ? gameState.inventory[gameState.inventory.length - 1].name : undefined,
        twistName: activeTwist?.name,
        cause: cause.replace(/_/g, ' '),
      }
    );

    const { error } = await supabase.from('deaths').insert({
      user_id: user.id,
      run_id: gameState.run_id,
      section,
      cause,
      epitaph: finalEpitaph,
    });
    if (error) console.error('Failed to record death:', error);
    await supabase.from('runs').update({ is_complete: true }).eq('id', gameState.run_id);
    await grantDeathRumor();
  };

  const completeRun = async (endingKey: string, isTrueEnding: boolean) => {
    if (!gameState) return;
    const { error } = await supabase.from('runs').update({
      is_complete: true,
      ending_key: endingKey,
      is_true_ending: isTrueEnding,
    }).eq('id', gameState.run_id);
    if (error) console.error('Failed to complete run:', error);
  };

  const spendLuckReroll = useCallback(async (diceIndices: number[]) => {
    if (!gameState || !lastRoll || gameState.resources.luck < 1) return;
    if (diceIndices.length === 0 || diceIndices.length > 2) return;

    const newDice = rerollDice(lastRoll.playerRoll.dice, diceIndices);
    const newSuccesses = countSuccesses(newDice, lastRoll.playerRoll.targetNumber);
    
    const newPlayerRoll = { ...lastRoll.playerRoll, dice: newDice, successes: newSuccesses };
    const opposingSuccesses = lastRoll.opposingRoll?.successes || 0;
    const newMargin = lastRoll.opposingRoll ? newSuccesses - opposingSuccesses : newSuccesses;

    let outcome: RollOutcome['outcome'];
    if (lastRoll.opposingRoll) {
      if (newMargin >= 3) outcome = 'critical_success';
      else if (newMargin > 0) outcome = 'success';
      else if (newMargin === 0) outcome = 'partial';
      else if (newMargin > -3) outcome = 'failure';
      else outcome = 'critical_failure';
    } else {
      if (newMargin >= 3) outcome = 'critical_success';
      else if (newMargin >= 1) outcome = 'success';
      else outcome = 'failure';
    }

    const newRoll: RollOutcome = { ...lastRoll, playerRoll: newPlayerRoll, margin: newMargin, outcome };
    setLastRoll(newRoll);

    // Use engine spendLuck which handles DebtWrit twist
    const newState = spendLuck(gameState);
    if (!newState) return;
    setGameState(newState);
    await autosave(newState);
  }, [gameState, lastRoll, autosave]);

  const spendFocusReduceTn = useCallback(async () => {
    if (!gameState || focusSpentThisRoll) return;
    const twist = gameState.status_effects.find(e => e.key === 'TWIST' && e.active);
    const focusCost = twist?.type === 'HollowContract' ? 2 : 1;
    if (gameState.resources.focus < focusCost) return;
    
    const newState = applyResourceChange(gameState, { focus: -focusCost });
    setGameState(newState);
    setFocusSpentThisRoll(true);
    await autosave(newState);
  }, [gameState, autosave, focusSpentThisRoll]);

  const doEmbraceDarkness = useCallback(async (track: 'madness' | 'taint') => {
    if (!gameState) return;
    const newState = embraceDarkness(gameState, track);
    setGameState(newState);
    setEmbraceBonusDice(2);
    await autosave(newState);
    toast({ title: track === 'madness' ? 'Madness Embraced' : 'Taint Embraced', description: '+2 dice for your next roll.' });
  }, [gameState, autosave]);

  const useDeathsJest = useCallback(async () => {
    if (!gameState || !lastRoll) return;
    if (gameState.trait_key !== 'deaths_jest') return;
    if (hasUsedTraitAbility(gameState, 'deaths_jest')) {
      toast({ title: 'Already Used', description: "Death's Jest can only be used once per run.", variant: 'destructive' });
      return;
    }

    const newDice = convertLowestDie(lastRoll.playerRoll.dice);
    if (JSON.stringify(newDice) === JSON.stringify(lastRoll.playerRoll.dice)) {
      toast({ title: 'No Effect', description: 'No die showing 1 to convert.', variant: 'destructive' });
      return;
    }

    const newSuccesses = countSuccesses(newDice, lastRoll.playerRoll.targetNumber);
    const newPlayerRoll = { ...lastRoll.playerRoll, dice: newDice, successes: newSuccesses };
    const opposingSuccesses = lastRoll.opposingRoll?.successes || 0;
    const newMargin = lastRoll.opposingRoll ? newSuccesses - opposingSuccesses : newSuccesses;

    let outcome: RollOutcome['outcome'];
    if (lastRoll.opposingRoll) {
      if (newMargin >= 3) outcome = 'critical_success';
      else if (newMargin > 0) outcome = 'success';
      else if (newMargin === 0) outcome = 'partial';
      else if (newMargin > -3) outcome = 'failure';
      else outcome = 'critical_failure';
    } else {
      if (newMargin >= 3) outcome = 'critical_success';
      else if (newMargin >= 1) outcome = 'success';
      else outcome = 'failure';
    }

    const newRoll: RollOutcome = { ...lastRoll, playerRoll: newPlayerRoll, margin: newMargin, outcome };
    setLastRoll(newRoll);

    const newState = useTraitAbility(gameState, 'deaths_jest');
    setGameState(newState);
    await autosave(newState);
    toast({ title: "Death's Jest!", description: 'A 1 becomes a 10. Death laughs with you, this once.' });
  }, [gameState, lastRoll, autosave]);

  return {
    gameState, outline, currentSection, combatState,
    lastRoll, showDiceTray, setShowDiceTray,
    focusSpentThisRoll, embraceBonusDice,
    generatingOutline, outlineStage,
    createNewRun, loadRun, loadLatestRun, makeChoice, doCombatAction,
    changeCombatStance, recordDeath, completeRun,
    spendLuckReroll, spendFocusReduceTn, doEmbraceDarkness,
    useDeathsJest, goToSection,
  };
}
