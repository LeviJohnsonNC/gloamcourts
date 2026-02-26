
-- run_sections_cache: caches LLM-generated section narration
CREATE TABLE IF NOT EXISTS public.run_sections_cache (
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  narrator_text TEXT NOT NULL DEFAULT '',
  choice_flavor_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  plate_caption TEXT,
  plate_prompt TEXT,
  plate_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, section_number)
);

ALTER TABLE public.run_sections_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own cached sections"
  ON public.run_sections_cache FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_sections_cache.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can insert own cached sections"
  ON public.run_sections_cache FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_sections_cache.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can update own cached sections"
  ON public.run_sections_cache FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_sections_cache.run_id AND runs.user_id = auth.uid()));

-- run_assets: stores generated plate images
CREATE TABLE IF NOT EXISTS public.run_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'plate',
  prompt TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.run_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own assets"
  ON public.run_assets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_assets.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can insert own assets"
  ON public.run_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_assets.run_id AND runs.user_id = auth.uid()));

-- Storage bucket for plates
INSERT INTO storage.buckets (id, name, public) VALUES ('plates', 'plates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their run folders
CREATE POLICY "Users can upload plates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'plates' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view plates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plates');

-- Fix restrictive RLS policies on codex_entries and rumors_catalog
-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone authenticated can read codex entries" ON public.codex_entries;
CREATE POLICY "Authenticated can read codex entries"
  ON public.codex_entries FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can read rumors" ON public.rumors_catalog;
CREATE POLICY "Authenticated can read rumors"
  ON public.rumors_catalog FOR SELECT TO authenticated
  USING (true);
