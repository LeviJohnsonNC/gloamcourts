
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Adventurer'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Runs
CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_complete BOOLEAN NOT NULL DEFAULT false,
  ending_key TEXT,
  is_true_ending BOOLEAN NOT NULL DEFAULT false,
  is_shared_replay BOOLEAN NOT NULL DEFAULT false,
  outline_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own runs" ON public.runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.runs FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Run State
CREATE TABLE public.run_state (
  run_id UUID PRIMARY KEY REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_section INT NOT NULL DEFAULT 1,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resources_json JSONB NOT NULL DEFAULT '{"health":10,"focus":6,"luck":3}'::jsonb,
  tracks_json JSONB NOT NULL DEFAULT '{"madness":0,"taint":0}'::jsonb,
  stance TEXT NOT NULL DEFAULT 'Guarded',
  range_band TEXT NOT NULL DEFAULT 'Near',
  inventory_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  visited_sections INT[] NOT NULL DEFAULT '{}',
  status_effects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  log_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  trait_key TEXT,
  character_description TEXT,
  autosave_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.run_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own run_state" ON public.run_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own run_state" ON public.run_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own run_state" ON public.run_state FOR UPDATE USING (auth.uid() = user_id);

-- Codex Entries (global catalog - readable by all authenticated)
CREATE TABLE public.codex_entries (
  codex_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_true_ending_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.codex_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read codex entries" ON public.codex_entries FOR SELECT TO authenticated USING (true);

-- Codex Unlocks
CREATE TABLE public.codex_unlocks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codex_key TEXT NOT NULL REFERENCES public.codex_entries(codex_key) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, codex_key)
);
ALTER TABLE public.codex_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own codex unlocks" ON public.codex_unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own codex unlocks" ON public.codex_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rumors Catalog (global - readable by all authenticated)
CREATE TABLE public.rumors_catalog (
  rumor_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  effect_text TEXT NOT NULL,
  mechanical_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.rumors_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read rumors" ON public.rumors_catalog FOR SELECT TO authenticated USING (true);

-- User Rumors
CREATE TABLE public.user_rumors (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rumor_key TEXT NOT NULL REFERENCES public.rumors_catalog(rumor_key) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rumor_key)
);
ALTER TABLE public.user_rumors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rumors" ON public.user_rumors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rumors" ON public.user_rumors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rumors" ON public.user_rumors FOR UPDATE USING (auth.uid() = user_id);

-- Deaths
CREATE TABLE public.deaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  section INT NOT NULL,
  cause TEXT NOT NULL,
  epitaph TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deaths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deaths" ON public.deaths FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deaths" ON public.deaths FOR INSERT WITH CHECK (auth.uid() = user_id);
