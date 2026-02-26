
-- Fix RLS policies: drop all and recreate as explicitly PERMISSIVE
-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- runs
DROP POLICY IF EXISTS "Users can view own runs" ON public.runs;
DROP POLICY IF EXISTS "Users can insert own runs" ON public.runs;
DROP POLICY IF EXISTS "Users can update own runs" ON public.runs;
CREATE POLICY "Users can view own runs" ON public.runs AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON public.runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.runs AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- run_state
DROP POLICY IF EXISTS "Users can view own run_state" ON public.run_state;
DROP POLICY IF EXISTS "Users can insert own run_state" ON public.run_state;
DROP POLICY IF EXISTS "Users can update own run_state" ON public.run_state;
CREATE POLICY "Users can view own run_state" ON public.run_state AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own run_state" ON public.run_state AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own run_state" ON public.run_state AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- codex_entries
DROP POLICY IF EXISTS "Anyone authenticated can read codex entries" ON public.codex_entries;
CREATE POLICY "Anyone authenticated can read codex entries" ON public.codex_entries AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- codex_unlocks
DROP POLICY IF EXISTS "Users can view own codex unlocks" ON public.codex_unlocks;
DROP POLICY IF EXISTS "Users can insert own codex unlocks" ON public.codex_unlocks;
CREATE POLICY "Users can view own codex unlocks" ON public.codex_unlocks AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own codex unlocks" ON public.codex_unlocks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- rumors_catalog
DROP POLICY IF EXISTS "Anyone authenticated can read rumors" ON public.rumors_catalog;
CREATE POLICY "Anyone authenticated can read rumors" ON public.rumors_catalog AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- user_rumors
DROP POLICY IF EXISTS "Users can view own rumors" ON public.user_rumors;
DROP POLICY IF EXISTS "Users can insert own rumors" ON public.user_rumors;
DROP POLICY IF EXISTS "Users can update own rumors" ON public.user_rumors;
CREATE POLICY "Users can view own rumors" ON public.user_rumors AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rumors" ON public.user_rumors AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rumors" ON public.user_rumors AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- deaths
DROP POLICY IF EXISTS "Users can view own deaths" ON public.deaths;
DROP POLICY IF EXISTS "Users can insert own deaths" ON public.deaths;
CREATE POLICY "Users can view own deaths" ON public.deaths AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deaths" ON public.deaths AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- SEED DATA: 20 codex entries
INSERT INTO public.codex_entries (codex_key, title, body, tags, is_true_ending_required) VALUES
('house_vael', 'House Vael', 'The oldest surviving noble house of the Gloam Courts, House Vael traces its lineage to the first twilight. Their estate occupies the eastern wing, where the shadows are deepest and the carpets most bloodstained. Vaels are known for three things: impeccable taste, bottomless debts, and an unsettling tendency to outlive their creditors.', ARRAY['faction', 'nobility'], false),
('the_pallid_ministry', 'The Pallid Ministry', 'The bureaucratic arm of the Courts, staffed by clerks whose pallor suggests either dedication to indoor work or a fundamental disagreement with the concept of being alive. They process paperwork for arrivals, departures, and the increasingly blurred line between the two. Their filing system is legendary and possibly sentient.', ARRAY['faction', 'bureaucracy'], true),
('the_undercroft', 'The Undercroft', 'Beneath the Courts lies a network of tunnels, cellars, and spaces that defy architectural explanation. The Undercroft is where things go when they are no longer wanted upstairs—broken furniture, discarded servants, and guests who overstayed their welcome by several centuries. Luminous fungi provide light in colours that have no name, only warnings.', ARRAY['location', 'underground'], false),
('iron_saints', 'The Iron Saints', 'Animated suits of armour that patrol the corridors enforcing laws from eras that no longer exist. They cannot be reasoned with, bribed, or convinced that the Sumptuary Laws of 1347 no longer apply. Their swords, however, are very much contemporary. An Iron Saint will pursue a dress code violation with the same vigour as a murder.', ARRAY['enemy', 'construct'], false),
('the_echo_vault', 'The Echo Vault', 'A chamber deep in the Undercroft where every sound ever made in the Courts is preserved. Conversations from centuries ago loop endlessly, overlapping into a cacophony of secrets, lies, and dinner reservations. Those who listen too long begin to hear their own future conversations. This is rarely reassuring.', ARRAY['location', 'occult'], true),
('the_grey_protocol', 'The Grey Protocol', 'A forbidden procedure developed by the Pallid Ministry for situations deemed "administratively inconvenient." Details are classified, redacted, and then classified again for good measure. What is known: it involves grey wax, grey fire, and a form that must be filled out in triplicate using ink made from ground regrets.', ARRAY['lore', 'forbidden'], true),
('the_gloam_courts', 'The Gloam Courts', 'The Courts themselves are less a building and more a state of mind—specifically, the state of mind one achieves shortly before a complete nervous breakdown. They exist in perpetual twilight, a compromise between day and night that satisfies neither. The architecture follows rules of geometry that Euclid would have found personally offensive.', ARRAY['location', 'overview'], false),
('lord_ashwick', 'Lord Ashwick, the Eternally Smouldering', 'Host of forty-seven "final" parties and counting. Lord Ashwick has been burning for three centuries, a condition he treats as a minor inconvenience rather than the screaming existential crisis it clearly is. He laughs at jokes told before most nations existed. His hospitality is legendary, his survival rate less so.', ARRAY['character', 'boss'], false),
('the_bone_market', 'The Bone Market', 'A nocturnal marketplace where the interesting traders set up after the rational ones pack away. Currency is abstract—regrets, favours, and occasionally teeth. The merchandise writhes. Returns are not accepted, though several items have been known to return themselves, usually at the worst possible moment.', ARRAY['location', 'trade'], false),
('hollow_men', 'The Hollow Men', 'Entities of uncertain origin that inhabit the deeper corridors. They stand facing walls for reasons no one has determined. When they speak, it sounds like paper being folded. They do not waste words on uncertainty. They are not hostile, exactly, but they are also not friendly, exactly, and the space between those two exactlies is where people tend to die.', ARRAY['enemy', 'entity'], false),
('the_cinder_crown', 'The Cinder Crown', 'An artefact of terrible power that sits on its cushion, smouldering with patient menace. Lord Ashwick holds the current record of seven minutes wearing it. The memorial plaques nearby suggest most attempts end more quickly and more dramatically. The Crown does not grant power so much as lend it, at interest rates that would make a usurer blush.', ARRAY['artefact', 'power'], true),
('the_waltz_of_knives', 'The Waltz of Knives', 'A social event that occurs whenever the Courts require a dispute to be settled with grace, poise, and extreme violence. Partners are assigned by lottery. The music is a waltz played at chase-scene tempo. Stepping on your partner''s feet is considered both a faux pas and, given the concealed blades in most Court footwear, a tactical error.', ARRAY['event', 'combat'], false),
('the_vermillion_seal', 'The Vermillion Seal', 'A seal of red wax pressed into the walls of the Courts at irregular intervals. It throbs with a pulse that has nothing to do with hearts and everything to do with authority. The Pallid Ministry would very much like to know who keeps finding them. They would also very much like everyone to stop touching them.', ARRAY['artefact', 'mystery'], false),
('servants_of_the_courts', 'The Servants', 'Staff whose faces are smooth as eggs and twice as expressionless. They materialise from shadows with the practiced ease of professional lurkers. Their voices sound like paper being folded. Whether they are alive in any meaningful sense is a question that philosophers have debated and servants have declined to answer.', ARRAY['character', 'staff'], false),
('the_garden_of_questions', 'The Garden of Pointed Questions', 'A garden where the roses have thorns like knitting needles and the hedges form opinions about passersby. The fountain gurgles something that might be water if water were the colour of old silver. Something lives in the fountain. It feeds on breadcrumbs and the naive assumption that gardens are safe places.', ARRAY['location', 'danger'], false),
('the_wine_cellar', 'The Wine Cellar', 'A cellar that descends deeper than any wine cellar has a right to. Some bottles predate the building. Others predate the concept of wine. Something moves between the racks with the careful deliberation of a connoisseur or a predator. In the Gloam Courts, this distinction is purely academic.', ARRAY['location', 'underground'], false),
('the_library', 'The Library of Unfinished Sentences', 'Books here are chained to shelves. This is for your protection, not theirs. Several volumes strain against their restraints as visitors pass, pages rustling with what sounds disturbingly like hunger. The librarian has eyes the size of dinner plates and opinions about browsers that are best not tested.', ARRAY['location', 'knowledge'], false),
('the_invitation', 'The Invitation', 'Every visitor to the Gloam Courts arrives with an invitation written in ink that shifts when not observed. The parchment smells of old roses and recent funerals. No one remembers sending the invitations. No one remembers receiving them. They simply appear, and then so do you. Declining has never been successfully attempted.', ARRAY['lore', 'entry'], false),
('the_pallid_seal', 'The Pallid Seal of Office', 'The symbol of the Ministry''s authority: a seal made from wax that is neither white nor grey but a colour that exists only in paperwork. Documents bearing this seal cannot be forged, ignored, or used as kindling, despite many attempts at all three. The seal''s authority is absolute, its reasoning incomprehensible.', ARRAY['artefact', 'bureaucracy'], true),
('the_twilight_compact', 'The Twilight Compact', 'The founding agreement of the Gloam Courts, written in a language that rearranges itself with each reading. It established the Courts as neutral ground—a place where old enemies could meet, negotiate, and occasionally murder each other according to proper protocols. The Compact has never been broken, largely because no one can agree on what it actually says.', ARRAY['lore', 'history'], false)
ON CONFLICT (codex_key) DO NOTHING;

-- SEED DATA: 12 rumors
INSERT INTO public.rumors_catalog (rumor_key, title, effect_text, mechanical_json) VALUES
('vael_debt', 'The Vael Debt', 'House Vael owes a debt so vast it has its own gravitational pull. Those who learn of it gain leverage—or become part of the collateral.', '{"type": "bonus_die", "stat": "GUILE", "context": "negotiation_with_vael", "bonus": 1}'::jsonb),
('iron_saint_paradox', 'The Iron Saint Paradox', 'The Saints enforce laws that contradict each other. Knowing which law to cite can freeze them mid-swing.', '{"type": "combat_advantage", "enemy": "iron_saint", "effect": "stun_one_round"}'::jsonb),
('grey_protocol_survivor', 'Grey Protocol Survivor', 'You survived the Grey Protocol. This should be impossible. The Ministry is concerned. You are useful.', '{"type": "bonus_die", "stat": "HEX", "context": "ministry_interactions", "bonus": 2}'::jsonb),
('ashwick_weakness', 'Ashwick''s Smouldering Secret', 'Lord Ashwick''s fire is not a curse but a choice. He chose to burn rather than face what the Crown showed him.', '{"type": "combat_advantage", "enemy": "lord_ashwick", "effect": "reduce_pool_by_1"}'::jsonb),
('hollow_speech', 'The Language of the Hollow', 'The Hollow Men speak in a language older than words. Learning fragments of it grants influence over them—and attracts their attention.', '{"type": "bonus_die", "stat": "HEX", "context": "hollow_men_encounters", "bonus": 1}'::jsonb),
('bone_market_prices', 'Bone Market Exchange Rates', 'You know the current rates for regret, hope, and teeth. This makes you a shrewd—if unsettling—negotiator.', '{"type": "bonus_die", "stat": "GUILE", "context": "trade", "bonus": 1}'::jsonb),
('servant_conspiracy', 'The Servants Remember', 'The servants are not as empty as they appear. They remember everything. Everything. And they have opinions.', '{"type": "bonus_die", "stat": "WITS", "context": "servant_interactions", "bonus": 1}'::jsonb),
('crown_whisper', 'Whispers of the Cinder Crown', 'The Crown speaks to those who have heard it before. Its whispers grant insight at the cost of certainty.', '{"type": "bonus_die", "stat": "HEX", "context": "crown_encounters", "bonus": 2}'::jsonb),
('garden_secrets', 'What the Roses Know', 'The roses in the Garden of Pointed Questions are excellent gossips. They know who enters, who leaves, and who becomes fertiliser.', '{"type": "bonus_die", "stat": "WITS", "context": "garden_exploration", "bonus": 1}'::jsonb),
('waltz_survivor', 'Waltz Veteran', 'You have survived the Waltz of Knives. Your footwork is improved. Your trust in dance partners is not.', '{"type": "bonus_die", "stat": "GRACE", "context": "combat", "bonus": 1}'::jsonb),
('cellar_vintage', 'The Forbidden Vintage', 'You know about the bottle in the deepest cellar. The one older than wine. Drinking it would be inadvisable. Selling information about it would be profitable.', '{"type": "bonus_die", "stat": "GUILE", "context": "trade", "bonus": 1}'::jsonb),
('library_forbidden', 'The Unchained Volume', 'One book in the Library is not chained because nothing can hold it. You know its name. It knows yours.', '{"type": "bonus_die", "stat": "WITS", "context": "research", "bonus": 2}'::jsonb)
ON CONFLICT (rumor_key) DO NOTHING;
