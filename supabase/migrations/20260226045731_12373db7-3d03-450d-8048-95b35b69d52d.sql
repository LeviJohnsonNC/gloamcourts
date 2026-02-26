
ALTER TABLE public.run_sections_cache
ADD COLUMN IF NOT EXISTS beat_tag TEXT,
ADD COLUMN IF NOT EXISTS device_tag TEXT,
ADD COLUMN IF NOT EXISTS npc_mentions TEXT[] DEFAULT '{}';
