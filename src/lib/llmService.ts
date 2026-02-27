import { supabase } from '@/integrations/supabase/client';
import { AdventureOutline, Section, GameState } from '@/rules/types';
import { validateAndConvertOutline } from '@/lib/outlineValidator';
import { toast } from '@/hooks/use-toast';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function generateLLMOutline(
  seed: string,
  onStage?: (stage: string) => void,
): Promise<AdventureOutline | null> {
  try {
    onStage?.('summoning');
    const headers = await getAuthHeaders();

    onStage?.('weaving');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const resp = await fetch(`${FUNCTIONS_URL}/generate-outline`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ seed }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    onStage?.('plotting');

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Outline generation failed:', resp.status, err);
      if (resp.status === 429) {
        toast({ title: 'Rate Limited', description: err.message || 'Too many runs today.', variant: 'destructive' });
      }
      return null;
    }

    onStage?.('binding');
    const { outline: raw } = await resp.json();
    const result = validateAndConvertOutline(raw, seed);

    if (!result.valid || !result.outline) {
      console.error('Outline validation failed:', result.errors);
      if (result.warnings.length > 0) console.warn('Outline warnings:', result.warnings);
      return null;
    }

    if (result.warnings.length > 0) {
      console.warn('Outline warnings:', result.warnings);
    }

    onStage?.('sealing');
    return result.outline;
  } catch (e) {
    console.error('generateLLMOutline error:', e);
    return null;
  }
}

export interface CachedSection {
  title: string;
  narrator_text: string;
  choice_flavor: Record<string, string>;
  plate_caption: string | null;
  plate_prompt: string | null;
  plate_url: string | null;
  beat_tag?: string;
  device_tag?: string;
  npc_mentions?: string[];
}

export async function fetchOrGenerateSection(
  runId: string,
  section: Section,
  gameState: GameState,
  outline: AdventureOutline,
): Promise<CachedSection | null> {
  try {
    const { data: cached } = await supabase
      .from('run_sections_cache')
      .select('*')
      .eq('run_id', runId)
      .eq('section_number', section.section_number)
      .maybeSingle();

    if (cached && (cached as any).narrator_text) {
      return {
        title: (cached as any).title,
        narrator_text: (cached as any).narrator_text,
        choice_flavor: (cached as any).choice_flavor_json as Record<string, string> || {},
        plate_caption: (cached as any).plate_caption,
        plate_prompt: (cached as any).plate_prompt,
        plate_url: (cached as any).plate_url,
        beat_tag: (cached as any).beat_tag,
        device_tag: (cached as any).device_tag,
        npc_mentions: (cached as any).npc_mentions,
      };
    }

    // Always attempt to generate unique narration, even if outline has placeholder text

    // Fetch last 2 cached narrations for anti-repetition
    const { data: recentCached } = await supabase
      .from('run_sections_cache')
      .select('narrator_text')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(2);
    const recentNarrations = (recentCached || []).map((r: any) => r.narrator_text).filter(Boolean);

    // Build snapshot with world bible context
    const worldBible = outline.world_bible;
    
    // Determine NPC mentions for this section from outline (if available)
    const outlineRaw = outline as any;
    const rawSection = outlineRaw?.sections_raw?.find?.((s: any) => s.section_number === section.section_number);
    const npcMentions = rawSection?.npc_mentions || [];

    const snapshot = {
      section_number: section.section_number,
      outline_summary: section.title,
      location_tag: section.title,
      has_plate: section.has_plate,
      is_boss: !!section.combat_enemy?.is_boss,
      is_death: section.is_death,
      is_ending: section.is_ending,
      is_twist: section.is_twist,
      twist_type: section.twist_type,
      act_tag: section.act_tag,
      choices: section.choices.map((c, i) => ({
        choice_id: `choice_${i}`,
        label: c.label,
        type: c.type,
      })),
      character_description: gameState.character_description,
      stats: gameState.stats,
      trait_key: gameState.trait_key,
      resources: gameState.resources,
      tracks: gameState.tracks,
      stance: gameState.stance,
      range_band: gameState.range_band,
      inventory_tags: gameState.inventory.map(i => i.tags).flat(),
      clues: gameState.inventory.filter(i => i.is_clue).map(i => i.name),
      active_twist: gameState.status_effects.find(e => e.key === 'TWIST' && e.active)?.type || null,
      npc_mentions: npcMentions,
      recent_narrations: recentNarrations,
      // Include world bible for narration consistency
      world_bible: worldBible ? {
        courts: worldBible.courts?.map(c => c.name) || [],
        factions: worldBible.factions?.map(f => `${f.name} (${f.tell})`) || [],
        npcs: worldBible.recurring_npcs?.map(n => `${n.name}: ${n.voice_tick}`) || [],
        places: worldBible.signature_places?.map(p => p.name) || [],
      } : null,
    };

    const headers = await getAuthHeaders();
    const resp = await fetch(`${FUNCTIONS_URL}/generate-section`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ runId, sectionNumber: section.section_number, snapshot }),
    });

    if (!resp.ok) {
      console.error('Section generation failed:', resp.status);
      return null;
    }

    const { section: data } = await resp.json();
    return {
      title: data.title || section.title,
      narrator_text: data.narrator_text || '',
      choice_flavor: data.choice_flavor_json || data.choice_flavor || {},
      plate_caption: data.plate_caption,
      plate_prompt: data.plate_prompt,
      plate_url: data.plate_url,
      beat_tag: data.beat_tag,
      device_tag: data.device_tag,
      npc_mentions: data.npc_mentions,
    };
  } catch (e) {
    console.error('fetchOrGenerateSection error:', e);
    return null;
  }
}

export async function generatePlate(
  runId: string,
  sectionNumber: number,
  platePrompt?: string,
  plateCaption?: string,
): Promise<string | null> {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(`${FUNCTIONS_URL}/generate-plate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ runId, sectionNumber, platePrompt, plateCaption }),
    });

    if (!resp.ok) {
      console.error('Plate generation failed:', resp.status);
      return null;
    }

    const { plate_url } = await resp.json();
    return plate_url || null;
  } catch (e) {
    console.error('generatePlate error:', e);
    return null;
  }
}
