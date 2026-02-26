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

export async function generateLLMOutline(seed: string): Promise<AdventureOutline | null> {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(`${FUNCTIONS_URL}/generate-outline`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ seed }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Outline generation failed:', resp.status, err);
      if (resp.status === 429) {
        toast({ title: 'Rate Limited', description: err.message || 'Too many runs today.', variant: 'destructive' });
      }
      return null;
    }

    const { outline: raw } = await resp.json();
    const result = validateAndConvertOutline(raw, seed);

    if (!result.valid || !result.outline) {
      console.error('Outline validation failed:', result.errors);
      return null;
    }

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
}

export async function fetchOrGenerateSection(
  runId: string,
  section: Section,
  gameState: GameState,
  outline: AdventureOutline,
): Promise<CachedSection | null> {
  try {
    // Try cache first via direct DB query (faster than edge function for reads)
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
      };
    }

    // If section already has substantial narrator_text from demo generator, use it
    if (section.narrator_text && section.narrator_text.length > 50 && !section.narrator_text.startsWith('stub')) {
      return null; // Use the outline's built-in text
    }

    // Build snapshot for LLM
    const snapshot = {
      section_number: section.section_number,
      outline_summary: section.title,
      location_tag: section.title,
      has_plate: section.has_plate,
      is_boss: !!section.combat_enemy?.is_boss,
      is_death: section.is_death,
      is_ending: section.is_ending,
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
      choice_flavor: data.choice_flavor_json || {},
      plate_caption: data.plate_caption,
      plate_prompt: data.plate_prompt,
      plate_url: data.plate_url,
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
