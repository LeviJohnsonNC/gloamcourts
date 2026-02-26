import { AdventureOutline, Section, Choice, CombatEnemy, InventoryItem } from '@/rules/types';
import { hashSeed, createRng } from '@/rules/dice';

const SECTION_POOL = [3, 7, 12, 18, 24, 31, 38, 44, 51, 57, 63, 71, 78, 86, 93, 101, 108, 116, 127, 135, 143, 157, 171, 183, 190];

const TITLES = [
  'The Invitation',
  'A Door That Remembers',
  'The Foyer of Regrets',
  'Whispers in the Wallpaper',
  'The Servant Who Isn\'t',
  'A Glass of Something Red',
  'The Garden of Pointed Questions',
  'Stairs That Go Sideways',
  'The Library of Unfinished Sentences',
  'An Audience with Dust',
  'The Bone Market After Dark',
  'A Dance You Didn\'t Agree To',
  'The Thing Behind the Curtain',
  'Lord Ashwick\'s Final Party',
  'The Corridor of Second Thoughts',
  'A Door with Too Many Locks',
  'The Wine Cellar Problem',
  'Someone Else\'s Skin',
  'The Chapel of Acceptable Losses',
  'An Offer You Can\'t Understand',
  'The Hollow Man\'s Request',
  'The Seal of Vermillion',
  'Descent into the Undercroft',
  'The Echo Chamber',
  'The Crown That Burns',
];

function generateNarrative(rng: () => number, sectionIndex: number, title: string): string {
  const narratives: string[] = [
    `YOU stand before the gates of the Gloam Courts, clutching an invitation written in ink that seems to shift when you're not looking. The parchment smells of old roses and recent funerals. Above you, gargoyles exchange what you desperately hope are stone glances.\n\nThe gates open without being asked. They were expecting you. This is not, you reflect, a comforting thought.`,

    `YOU push through a door that groans with the specific weariness of a portal that has been opened too many times by people who really should have known better. Beyond lies a corridor panelled in wood so dark it appears to absorb light as a hobby.\n\nSomething scratches behind the walls. Mice, probably. Mice with unusually articulate claws.`,

    `YOU enter a foyer of catastrophic grandeur. Chandeliers hang at angles that would concern a structural engineer, dripping crystals onto a carpet that was once magnificent and is now merely haunted. Portraits line the walls, their subjects watching you with the studied disinterest of the socially superior.\n\nA servant materialises from the shadows with the practiced ease of someone who has been lurking professionally for decades.`,

    `YOU notice the wallpaper is moving. Not in the "trick of the light" way that polite people pretend, but in the "active and purposeful rearrangement of floral patterns" way that suggests a deeply concerning interior design philosophy.\n\nThe whispers are faint but persistent. They seem to be discussing you, and their reviews are mixed.`,

    `YOU encounter a servant whose face is smooth as an egg and twice as expressionless. It—and you suspect "it" is the appropriate pronoun—bows with mechanical precision and gestures toward a corridor that definitely wasn't there a moment ago.\n\n"This way," it says, in a voice like paper being folded. "Unless you prefer the other way. Though I should mention the other way has teeth."`,

    `YOU are offered a glass of something that is emphatically red. It could be wine. It could also be several other things, most of which you'd prefer not to think about while drinking.\n\nYour host smiles with too many teeth and not enough warmth. "A toast," they say, "to your continued existence. However long that may prove to be."`,

    `YOU find yourself in a garden where the roses have thorns the size of knitting needles and the hedges form opinions about passersby. A fountain gurgles in the centre, its water the colour of old silver.\n\nA figure sits on a bench, feeding breadcrumbs to something that is definitely not a pigeon. It has too many eyes for that. And not enough beak.`,

    `YOU ascend a staircase that turns in directions not found in conventional geometry. Each step produces a note, as though the architect had confused "building" with "composing." The melody is in a minor key. Of course it is.\n\nAt the top—or what passes for top in a place where verticality is more of a suggestion than a rule—two doors wait.`,

    `YOU enter a library where the books are chained to the shelves. This is, you've been told, for your protection rather than theirs. Several volumes strain against their restraints as you pass, their pages rustling with what sounds disturbingly like hunger.\n\nA librarian peers at you over spectacles that magnify their eyes to the size of dinner plates. "Looking for anything specific?" they ask. "Or are you more of a browser? We've had problems with browsers."`,

    `YOU are granted an audience with something that sits on a throne of accumulated years. It might be alive. It might be a very convincing taxidermy project. The dust motes in the air seem to orbit it, as though even particles of dead skin recognize authority.\n\n"Ah," it says, or something nearby says on its behalf. "Another one. How refreshing. The last one screamed for much longer than was strictly necessary."`,

    `YOU arrive at the Bone Market just as the last rational trader is packing up and the interesting ones are setting out their wares. Stalls made of femurs and business cards. Merchandise that writhes. Prices listed in units of regret.\n\nA merchant with fingers like spider legs beckons you closer. "First visit? I can tell. You still have that look. The one with hope in it. We can fix that."`,

    `YOU are swept onto a dance floor by invisible hands. The music is a waltz played at the speed of a chase scene, and your partner is either very tall or standing on something you can't see. Their grip is firm. Their smile is fixed. Their eyes are entirely the wrong colour.\n\n"Don't stop," they whisper. "Don't look down. Don't think about your feet. Especially don't think about whose feet they used to be."`,

    `YOU pull back a curtain that no one told you not to touch, which in retrospect should have been your first warning. Behind it is not, as you'd hoped, a window. It is something that looks like a window would look if windows had nightmares.\n\nThe thing behind the curtain regards you with the patient malevolence of something that has been waiting specifically for someone stupid enough to look.`,

    `YOU have been invited to Lord Ashwick's "final" party. It is his forty-seventh final party. Previous ones ended in conflagration, spontaneous fossilisation, and on one memorable occasion, an impromptu game of cricket using a cursed skull.\n\nLord Ashwick himself stands at the centre of the ballroom, trailing smoke from his collar and laughing at something that happened three centuries ago. He hasn't stopped since.`,

    `YOU are in a corridor that stretches in both directions with the enthusiasm of something that really doesn't want you to reach either end. The portraits here are more honest than the ones upstairs. They show people running.\n\nA door to your left bears a brass plate reading "NO EXIT." A door to your right reads "ABSOLUTELY NO EXIT WHATSOEVER." This is, in the parlance of the Courts, a choice.`,

    `YOU find a door secured with locks of increasing improbability: iron, silver, frozen moonlight, and what appears to be a knot tied in a grudge. Each requires a different key, and you have none of them.\n\nHowever, you notice the hinges are on your side. The Courts are many things, but architecturally competent is not always among them.`,

    `YOU descend into a wine cellar that goes deeper than any wine cellar has a right to. The bottles here are old. Some are older than the building. A few are older than the concept of wine.\n\nSomething moves between the racks with the careful deliberation of a connoisseur or a predator. In the Gloam Courts, there is often no meaningful distinction.`,

    `YOU are wearing someone else's face. This is either a disguise or a horrible accident, and the distinction matters less than you'd think. The face fits poorly—the previous owner had different cheekbones and a more optimistic nose.\n\nA mirror in the hallway catches your reflection and seems to flinch.`,

    `YOU enter a chapel where the pews face in every direction except toward the altar, as though the congregation was more interested in watching each other than whatever stood at the front. The altar itself is empty except for a sign reading "BACK IN 5 MINUTES." The sign is very old.\n\nCandles gutter in a wind that comes from nowhere and goes somewhere worse.`,

    `YOU receive an offer written in a language that rearranges itself each time you try to read it. The words are clear individually but combine into meaning the way cats combine into a organisation: reluctantly and with visible contempt for the process.\n\nThe signature at the bottom is a symbol that makes your eyes water.`,

    `YOU meet a Hollow Man in a corridor where the lights have given up. It stands perfectly still, facing a wall, for no reason you can discern. As you approach, it turns—smoothly, without moving its feet, like a weathervane in human form.\n\n"You," it says. A statement, not a question. Hollow Men don't waste words on uncertainty.`,

    `YOU discover a seal of vermillion wax pressed into the wall itself. It throbs faintly with a pulse that has nothing to do with hearts and everything to do with authority. Touching it would be unwise. Not touching it would be unsatisfying.\n\nThe Pallid Ministry would very much like to know how you found this. They would also very much like you not to tell anyone else.`,

    `YOU descend. The stairs become rough-hewn, then merely rough, then merely hewn, then something that can only be described as "aggressively geological." The Undercroft opens before you like a wound that has decided to become a neighbourhood.\n\nLuminous fungus provides light in colours that don't have names, only warnings. Something drips. Something always drips down here. It's contractually obligated.`,

    `YOU stand in a chamber where every sound you've ever made echoes back at you, slightly delayed and significantly judgemental. Your voice from childhood, your last argument, that one time you tried to sing. It's all here. It's all awful.\n\nAmong the cacophony, something speaks directly to you. A voice you don't recognise, saying things you do.`,

    `YOU stand before the Cinder Crown. It sits on its cushion, smouldering with patient menace, casting shadows that move independently of the light. The air around it tastes of ash and ambition.\n\nLord Ashwick's record of seven minutes is chalked on the wall nearby, next to several other times and a growing collection of memorial plaques.`,
  ];

  return narratives[sectionIndex % narratives.length];
}

export function generateOutline(seed: string): AdventureOutline {
  const hash = hashSeed(seed);
  const rng = createRng(hash);

  // Shuffle section numbers
  const sections: Section[] = [];
  const sectionNumbers = [...SECTION_POOL];

  // Use 25 sections
  const numSections = 25;
  const usedNumbers = sectionNumbers.slice(0, numSections);

  // Shuffle for non-linearity but keep start and end
  for (let i = usedNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [usedNumbers[i], usedNumbers[j]] = [usedNumbers[j], usedNumbers[i]];
  }

  const startSection = usedNumbers[0];
  const bossSection = usedNumbers[numSections - 2];
  const endingSection = usedNumbers[numSections - 1];

  // Death sections
  const deathSections = [usedNumbers[5], usedNumbers[10], usedNumbers[15], usedNumbers[20], usedNumbers[22]];

  const deathEpitaphs = [
    { cause: 'poisoned_wine', epitaph: 'Here lies an optimist who believed "complimentary" and "poisoned" were mutually exclusive. They were half right.' },
    { cause: 'hollow_man_attack', epitaph: 'Here lies someone who discovered that Hollow Men, despite having no feelings, have very strong opinions about personal space.' },
    { cause: 'dance_exhaustion', epitaph: 'Here lies a dancer whose stamina was exceeded only by their partner\'s enthusiasm. The music played on. They did not.' },
    { cause: 'curtain_peek', epitaph: 'Here lies a curious soul who pulled back a curtain and found exactly what they were looking for. Unfortunately, it was also looking for them.' },
    { cause: 'crown_attempt', epitaph: 'Here lies a would-be monarch. Their reign was brief but spectacular, in the sense that spectacles were required to find the remains.' },
  ];

  const dagger: InventoryItem = { id: 'rusty_dagger', name: 'Rusty Dagger', tags: ['sharp', 'weapon'], description: 'A dagger that has seen better days, decades, and possibly centuries.' };
  const key: InventoryItem = { id: 'iron_key', name: 'Iron Key', tags: ['key', 'iron'], description: 'A key that is cold to the touch and warm to the conscience.' };

  for (let i = 0; i < numSections; i++) {
    const sn = usedNumbers[i];
    const title = TITLES[i % TITLES.length];
    const narratorText = generateNarrative(rng, i, title);
    const hasPlate = i === 0 || i === numSections - 2 || (rng() < 0.15);
    const isDeath = deathSections.includes(sn);
    const isBoss = sn === bossSection;
    const isEnding = sn === endingSection;

    const choices: Choice[] = [];

    if (isDeath) {
      const deathIdx = deathSections.indexOf(sn);
      const de = deathEpitaphs[deathIdx % deathEpitaphs.length];
      sections.push({
        section_number: sn,
        title,
        narrator_text: narratorText + '\n\nYOU ARE DEAD.',
        has_plate: false,
        choices: [],
        is_death: true,
        death_cause: de.cause,
        death_epitaph: de.epitaph,
      });
      continue;
    }

    if (isBoss) {
      const bossEnemy: CombatEnemy = {
        name: 'Lord Ashwick, the Eternally Smouldering',
        pool: 5,
        tn: 6,
        health: 8,
        stance: 'Aggressive',
        is_boss: true,
        description: 'He burns. He laughs. He has been burning and laughing for three centuries, and he is very, very good at both.',
      };
      sections.push({
        section_number: sn,
        title: 'Lord Ashwick\'s Final Party',
        narrator_text: `YOU have come face to face with Lord Ashwick himself. He stands wreathed in smoke and centuries of grudges, his eyes burning with a fire that has consumed better adventurers than you.\n\n"Ah," he says, flames licking at his collar. "Entertainment."`,
        has_plate: true,
        plate_caption: 'Lord Ashwick regards you with the enthusiasm of a cat presented with a new mouse.',
        choices: [
          { label: 'Fight Lord Ashwick', type: 'combat', success_section: endingSection, fail_section: deathSections[4] },
        ],
        combat_enemy: bossEnemy,
      });
      continue;
    }

    if (isEnding) {
      sections.push({
        section_number: sn,
        title: 'The End of the Beginning',
        narrator_text: `YOU have survived the Gloam Courts. This is, by any reasonable measure, an achievement worthy of celebration. Or at least a stiff drink and a lie-down.\n\nThe gates open before you—or perhaps behind you, direction having long since lost its meaning—and the world outside rushes in like water into a ship that has only just realised it's sinking.\n\nYou are alive. You are mostly intact. You have stories that no one will believe and memories you wish you could return.\n\nThe Courts will be here when you come back. They are always here. They are always waiting.\n\nThey enjoyed having you.`,
        has_plate: true,
        plate_caption: 'The gates of the Gloam Courts stand open, and you stand standing. A rare accomplishment.',
        choices: [],
        is_ending: true,
        ending_key: 'survived',
        is_true_ending: false,
        codex_unlock: 'the_gloam_courts',
      });
      continue;
    }

    // Regular sections with branching choices
    const nextSections = usedNumbers.filter((_, idx) => idx > i && idx < numSections);
    const getNext = () => nextSections[Math.floor(rng() * Math.min(3, nextSections.length))] || endingSection;

    if (i === 0) {
      // Start section
      choices.push(
        { label: 'Enter through the main gates', type: 'free', next_section: usedNumbers[1] },
        { label: 'Look for a servant\'s entrance', type: 'test', stat_used: 'WITS', base_pool: 3, tn: 6, stakes: 'Finding an alternate entry might reveal secrets—or simply reveal you to things that hunt in back corridors.', success_section: usedNumbers[2], fail_section: usedNumbers[1] },
        { label: 'Scale the wall', type: 'test', stat_used: 'GRACE', base_pool: 3, tn: 7, stakes: 'The wall is high and the gargoyles are watching.', success_section: usedNumbers[3], fail_section: deathSections[0], item_gain: dagger },
      );
    } else if (i < 4) {
      // Early exploration
      choices.push(
        { label: 'Proceed deeper into the Courts', type: 'free', next_section: getNext(), codex_unlock: i === 1 ? 'house_vael' : undefined },
        { label: 'Investigate the strange sound', type: 'test', stat_used: 'WITS', base_pool: 3, tn: 6, stakes: 'Knowledge is power. Ignorance is bliss. You can\'t have both.', success_section: getNext(), fail_section: getNext(), resource_change: { focus: -1 } },
      );
      if (i === 2) {
        choices.push({
          label: 'Pick up the rusty dagger', type: 'free', next_section: getNext(), item_gain: dagger,
        });
      }
    } else if (i < 8) {
      // Mid sections
      const hasSocialOption = rng() > 0.4;
      choices.push(
        { label: 'Press forward', type: 'free', next_section: getNext() },
      );
      if (hasSocialOption) {
        choices.push({
          label: 'Attempt to bluff your way past', type: 'test', stat_used: 'GUILE', base_pool: 3, tn: 6, stakes: 'Your silver tongue versus their iron suspicion.',
          success_section: getNext(), fail_section: deathSections[Math.floor(rng() * 3)],
          codex_unlock: rng() > 0.7 ? 'the_pallid_ministry' : undefined,
          rumor_unlock: rng() > 0.7 ? 'vael_debt' : undefined,
        });
      }
      choices.push({
        label: 'Search for hidden passages', type: 'test', stat_used: 'WITS', base_pool: 4, tn: 7,
        stakes: 'The walls have ears. The floors have opinions.',
        success_section: getNext(), fail_section: getNext(),
        item_gain: i === 6 ? key : undefined,
        codex_unlock: rng() > 0.6 ? 'the_undercroft' : undefined,
      });
    } else if (i < 12) {
      // Late mid
      const hasCombat = rng() > 0.5;
      choices.push({ label: 'Continue cautiously', type: 'free', next_section: getNext() });
      if (hasCombat) {
        const minorEnemy: CombatEnemy = {
          name: 'Iron Saint', pool: 3, tn: 7, health: 4, stance: 'Guarded', is_boss: false,
          description: 'An animated suit of armour that enforces laws from a bygone era. Its sword is very much from the current era.',
        };
        choices.push({
          label: 'Face the Iron Saint', type: 'combat',
          success_section: getNext(), fail_section: deathSections[Math.floor(rng() * deathSections.length)],
          codex_unlock: 'iron_saints',
          rumor_unlock: 'iron_saint_paradox',
        });
        // Attach enemy to section
        sections.push({
          section_number: sn, title, narrator_text: narratorText, has_plate: hasPlate,
          plate_caption: hasPlate ? 'The Iron Saint stands motionless, waiting for a law to be broken.' : undefined,
          choices, combat_enemy: minorEnemy,
        });
        continue;
      }
      choices.push({
        label: 'Use the iron key', type: 'gated', required_item_tag: 'key',
        next_section: usedNumbers[Math.min(i + 2, numSections - 3)],
        codex_unlock: 'the_echo_vault',
      });
    } else if (i < numSections - 3) {
      // Late game, converging toward boss
      choices.push(
        { label: 'Descend toward the heart of the Courts', type: 'free', next_section: usedNumbers[Math.min(i + 1, numSections - 3)] },
        {
          label: 'Embrace the darkness for power', type: 'test', stat_used: 'HEX', base_pool: 4, tn: 7,
          stakes: 'The darkness offers power. The price is... well, the price is always the same.',
          success_section: bossSection, fail_section: deathSections[3],
          track_change: { taint: 2 },
          codex_unlock: 'the_grey_protocol',
          rumor_unlock: 'grey_protocol_survivor',
        },
      );
    } else {
      // Pre-boss
      choices.push(
        { label: 'Enter the ballroom', type: 'free', next_section: bossSection },
        { label: 'Prepare yourself first', type: 'test', stat_used: 'WITS', base_pool: 3, tn: 5,
          stakes: 'A moment of clarity before the storm.',
          success_section: bossSection, fail_section: bossSection,
          resource_change: { focus: 1, health: 2 },
        },
      );
    }

    sections.push({
      section_number: sn,
      title,
      narrator_text: narratorText,
      has_plate: hasPlate,
      plate_caption: hasPlate ? `Section ${sn}: ${title}` : undefined,
      choices,
    });
  }

  const titleOptions = [
    'The Invitation of House Vael',
    'A Night at the Gloam Courts',
    'The Smouldering Lord\'s Reception',
    'Twilight Protocol',
    'The Courts of Fading Light',
  ];

  return {
    title: titleOptions[Math.floor(rng() * titleOptions.length)],
    seed,
    sections,
    start_section: startSection,
  };
}
