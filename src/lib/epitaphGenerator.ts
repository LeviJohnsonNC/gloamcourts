/**
 * Deterministic death epitaph generator.
 * 60 templates across 6 categories, filled with context from the run.
 * No LLM calls needed.
 */

import { hashSeed } from '@/rules/dice';

type EpitaphCategory = 'Bureaucratic' | 'Poetic' | 'Mean' | 'Ironic' | 'Legalese' | 'Reverent';

interface EpitaphContext {
  place?: string;
  faction?: string;
  itemName?: string;
  twistName?: string;
  cause?: string;
}

const TEMPLATES: Record<EpitaphCategory, string[]> = {
  Bureaucratic: [
    'Death Certificate #{{hash}}: Cause — {{cause}}. Filed by {{faction}}, stamped "RECEIVED" in ink that smells of {{place}}.',
    'The {{faction}} regret to inform next-of-kin that the deceased was processed at {{place}}. Refunds are not available.',
    'FORM 7-B: Notification of Cessation. Location: {{place}}. Responsible party: {{faction}}. Notes: "Should not have touched that."',
    'Per {{faction}} ordinance §14.2(c), the deceased is hereby categorized as "voluntarily expired" at {{place}}.',
    'The Registrar of Deaths has marked this entry as "Expected" in the margins. {{place}} claims no liability.',
    'Application for resurrection denied. Reason: insufficient paperwork. Filed at {{place}} under {{faction}} jurisdiction.',
    'This death has been audited by {{faction}} and found compliant with all regulations. {{place}} sends condolences (standard form).',
    'NOTICE: Your subscription to living has lapsed. {{faction}} thanks you for your patronage at {{place}}.',
    'The coroner noted "death by adventure" and underlined it twice. {{place}} has been added to the insurance exclusion list.',
    'Death logged in triplicate. {{faction}} has already reassigned your accommodations at {{place}}.',
  ],
  Poetic: [
    'The candles at {{place}} burn low for one who danced too close to {{faction}}\'s fire.',
    'In {{place}}, the shadows remember your name. {{faction}} has already forgotten it.',
    'Here ends a story that {{place}} will tell to frighten better adventurers.',
    'The ink dries on your final chapter. {{place}} turns the page without ceremony.',
    'Moth-wing dust settles on the space where you once stood in {{place}}. {{faction}} observes a moment of professional silence.',
    'Your last breath joined the whispers of {{place}}. Even the walls seemed briefly surprised.',
    'The rot-wine spilled at {{place}} marks where you fell. {{faction}} has already set a new glass.',
    'Like parchment fed to flame at {{place}}, you curled and then were nothing. {{faction}} kept the ashes.',
    'The cold iron of {{place}} remembers your warmth. Briefly. Then forgets.',
    'Bone dust to bone dust, at {{place}}, where {{faction}} collects what the Courts discard.',
  ],
  Mean: [
    'YOU died at {{place}}. Even {{faction}} seemed embarrassed on your behalf.',
    'The thing about dying at {{place}} is that {{faction}} keeps score. You did not make the top fifty.',
    'Here lies someone who thought they were cleverer than {{faction}}. {{place}} has a long history of correcting such misconceptions.',
    'YOU, being the kind of person who picks fights at {{place}}, got exactly what {{faction}} expected.',
    'Your corpse at {{place}} was described as "unremarkable" by {{faction}}. A fitting summary.',
    'Death by {{cause}} at {{place}}. {{faction}} rates this performance two stars.',
    '{{place}} has seen better deaths. {{faction}} has caused better deaths. You were merely adequate at dying.',
    'The staff at {{place}} didn\'t even pause clearing the table. {{faction}} notes you died holding {{item}}.',
    'Congratulations on achieving the easiest possible outcome at {{place}}. {{faction}} is not impressed.',
    'YOUR final words were inaudible over {{faction}}\'s laughter at {{place}}.',
  ],
  Ironic: [
    'Died clutching {{item}} at {{place}}. It did not help. It was never going to help.',
    'Survived everything {{faction}} threw at you. Died at {{place}} from something embarrassingly mundane.',
    'The {{item}} in your pocket would have saved you, had you remembered which pocket it was in. {{place}} does not wait.',
    'YOU came to {{place}} to find answers. Found {{faction}} instead. Same thing, really.',
    'Having successfully avoided every trap in {{place}}, you tripped on the doorstep. {{faction}} sends a card.',
    'The {{item}} was supposed to protect you at {{place}}. The warranty, it turns out, had expired.',
    'YOU were warned about {{place}} by {{faction}}. You went anyway. They appreciate the entertainment.',
    '{{faction}} had placed bets on how long you\'d last at {{place}}. Nobody won — you died faster than the lowest estimate.',
    'Your carefully planned escape from {{place}} worked perfectly, right up until the part where it didn\'t.',
    'The irony of dying at {{place}} while carrying {{item}} was not lost on {{faction}}. They wrote it down.',
  ],
  Legalese: [
    'WHEREAS the party of the first part (YOU) did enter {{place}} under jurisdiction of {{faction}}, and WHEREAS said party subsequently ceased to exist, LET IT BE KNOWN that no warranty was implied.',
    'In the matter of YOUR death vs. {{place}}: judgment for {{place}}. {{faction}} served as expert witness.',
    'The deceased hereby waives all claims against {{faction}} arising from incidents at {{place}}. (Signed posthumously.)',
    'EXHIBIT A: One corpse, found at {{place}}. EXHIBIT B: One {{item}}, unused. {{faction}} rests their case.',
    'By entering {{place}}, the deceased accepted Terms of Service (revision 47.3, subsection "Mortality"). {{faction}} disclaims all liability.',
    'This death is binding and non-negotiable per {{faction}} statute. Appeals may be filed at {{place}} between the hours of never.',
    'INJUNCTION: The deceased is hereby ordered to remain dead. Violations will be prosecuted by {{faction}} at {{place}}.',
    'Pursuant to the Gloam Courts Act of Finality, your demise at {{place}} is certified by {{faction}} as both legal and deserved.',
    'The defendant ({{place}}) is acquitted of all charges relating to YOUR death. {{faction}} presiding.',
    'SETTLEMENT: In lieu of continued existence, the estate of the deceased receives one unmarked grave at {{place}}. {{faction}} retains all other assets.',
  ],
  Reverent: [
    'Rest now, traveller. {{place}} remembers those who dare, even those who fail. {{faction}} lights a candle.',
    'The Courts are cruel, but {{place}} grants all visitors the same final courtesy. {{faction}} marks your passing.',
    'In the halls of {{place}}, your name joins the long ledger. {{faction}} bows, once, and returns to work.',
    'You walked further than most into {{place}}. {{faction}} acknowledges this. It is not nothing.',
    'The Gloam Courts take many. {{place}} took you gently, as these things go. {{faction}} observed the protocol.',
    'Here rests one who faced {{faction}} at {{place}} and did not flinch. The flinching came later.',
    'May the candle smoke of {{place}} carry your name beyond {{faction}}\'s reach. You earned that much.',
    'The cold iron gates of {{place}} close behind you for the last time. {{faction}} stands vigil until dawn.',
    'Your courage at {{place}} was noted by {{faction}}. It will be recorded. It will be remembered. Briefly.',
    'In the end, {{place}} was kinder than {{faction}}. Both were kinder than you deserved. Rest.',
  ],
};

const CATEGORIES: EpitaphCategory[] = ['Bureaucratic', 'Poetic', 'Mean', 'Ironic', 'Legalese', 'Reverent'];

export function generateEpitaph(
  seed: string,
  sectionNumber: number,
  context: EpitaphContext
): string {
  // Deterministic selection based on seed + section
  const combined = `${seed}_epitaph_${sectionNumber}`;
  const hash = hashSeed(combined);

  const categoryIdx = Math.abs(hash) % CATEGORIES.length;
  const category = CATEGORIES[categoryIdx];
  const templates = TEMPLATES[category];
  const templateIdx = Math.abs(hash >> 8) % templates.length;
  let template = templates[templateIdx];

  // Fill placeholders
  const place = context.place || 'the Gloam Courts';
  const faction = context.faction || 'the Pallid Ministry';
  const item = context.itemName || 'a crumpled invitation';
  const cause = context.cause || 'misplaced confidence';

  template = template.replace(/\{\{place\}\}/g, place);
  template = template.replace(/\{\{faction\}\}/g, faction);
  template = template.replace(/\{\{item\}\}/g, item);
  template = template.replace(/\{\{cause\}\}/g, cause);
  template = template.replace(/\{\{hash\}\}/g, String(Math.abs(hash % 9999)).padStart(4, '0'));

  // Add twist flavor if active
  if (context.twistName) {
    const twistAddendums = [
      `(The ${context.twistName} was in effect. It did not help.)`,
      `Under the terms of the ${context.twistName}, this death was technically a formality.`,
      `The ${context.twistName} ensured this was more painful than strictly necessary.`,
    ];
    const twistIdx = Math.abs(hash >> 16) % twistAddendums.length;
    template += ' ' + twistAddendums[twistIdx];
  }

  return template;
}
