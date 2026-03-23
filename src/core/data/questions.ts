import type { Character } from './characters';

export type QuestionZone = 'hair' | 'face' | 'body' | 'gear';

export interface Question {
  id: string;
  text: string;
  /** Legacy category for free-mode tab UI */
  category: 'hair' | 'face' | 'accessories' | 'body' | 'gear' | 'other';
  /** Silhouette zone — set for all SCHIZODIO NFT questions */
  zone?: QuestionZone;
  /** Emoji icon shown in question list */
  icon?: string;
  /** Trait key stored in QuestionRecord (informational) */
  traitKey: string;
  /** Trait value stored in QuestionRecord */
  traitValue: string | boolean;
  /**
   * Custom evaluator for keyword / partial matching.
   * Takes priority over the default traitKey === traitValue equality check.
   */
  matchFn?: (char: Character) => boolean;
}

// ─── Helper accessors ─────────────────────────────────────────────────────────
const nftHair = (c: Character) => c.traits.nft_hair ?? '';
const nftEyes = (c: Character) => c.traits.nft_eyes ?? '';
const nftMouth = (c: Character) => c.traits.nft_mouth ?? '';
const nftBrows = (c: Character) => c.traits.nft_eyebrows ?? '';
const nftBody = (c: Character) => c.traits.nft_body ?? '';
const nftClothing = (c: Character) => c.traits.nft_clothing ?? '';
const nftSidekick = (c: Character) => c.traits.nft_sidekick ?? '';
const nftBg = (c: Character) => c.traits.nft_background ?? '';

// ─── Free / classic-mode questions ───────────────────────────────────────────
export const FREE_QUESTIONS: Question[] = [
  // Hair color
  { id: 'q_hc_black', text: 'Does your character have black hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'black' },
  { id: 'q_hc_brown', text: 'Does your character have brown hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'brown' },
  { id: 'q_hc_blonde', text: 'Does your character have blonde hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'blonde' },
  { id: 'q_hc_red', text: 'Does your character have red hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'red' },
  { id: 'q_hc_white', text: 'Does your character have white hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'white' },
  { id: 'q_hc_blue', text: 'Does your character have blue hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'blue' },

  // Hair style
  { id: 'q_hs_short', text: 'Does your character have short hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'short' },
  { id: 'q_hs_long', text: 'Does your character have long hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'long' },
  { id: 'q_hs_curly', text: 'Does your character have curly hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'curly' },
  { id: 'q_hs_bald', text: 'Is your character bald?', category: 'hair', traitKey: 'hair_style', traitValue: 'bald' },
  { id: 'q_hs_mohawk', text: 'Does your character have a mohawk?', category: 'hair', traitKey: 'hair_style', traitValue: 'mohawk' },
  { id: 'q_hs_ponytail', text: 'Does your character have a ponytail?', category: 'hair', traitKey: 'hair_style', traitValue: 'ponytail' },

  // Face — eyes
  { id: 'q_eye_brown', text: 'Does your character have brown eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'brown' },
  { id: 'q_eye_blue', text: 'Does your character have blue eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'blue' },
  { id: 'q_eye_green', text: 'Does your character have green eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'green' },
  { id: 'q_eye_hazel', text: 'Does your character have hazel eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'hazel' },
  // Face — gender
  { id: 'q_gender_m', text: 'Is your character male?', category: 'face', traitKey: 'gender', traitValue: 'male' },
  { id: 'q_gender_f', text: 'Is your character female?', category: 'face', traitKey: 'gender', traitValue: 'female' },
  // Face — skin tone
  { id: 'q_skin_light', text: 'Does your character have light skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'light' },
  { id: 'q_skin_medium', text: 'Does your character have medium skin tone?', category: 'face', traitKey: 'skin_tone', traitValue: 'medium' },
  { id: 'q_skin_tan', text: 'Does your character have tan skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'tan' },
  { id: 'q_skin_dark', text: 'Does your character have dark skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'dark' },
  { id: 'q_skin_very_dark', text: 'Does your character have very dark skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'very_dark' },
  { id: 'q_beard', text: 'Does your character have a beard?', category: 'face', traitKey: 'has_beard', traitValue: true },

  // Accessories
  { id: 'q_glasses', text: 'Does your character wear glasses?', category: 'accessories', traitKey: 'has_glasses', traitValue: true },
  { id: 'q_hat', text: 'Does your character wear a hat?', category: 'accessories', traitKey: 'has_hat', traitValue: true },
  { id: 'q_earrings', text: 'Does your character have earrings?', category: 'accessories', traitKey: 'has_earrings', traitValue: true },
];

// ─── SCHIZODIO NFT questions ──────────────────────────────────────────────────
// matchFn performs keyword / partial matching on lowercased raw NFT attributes.
export const NFT_QUESTIONS: Question[] = [

  // ══ HAIR zone ══════════════════════════════════════════════════════════════
  {
    id: 'nq_hair_jellycut', zone: 'hair', category: 'hair', icon: '⚡',
    text: 'Does your character have a Jellycut hairstyle?',
    traitKey: 'nft_hair', traitValue: 'jellycut',
    matchFn: (c) => nftHair(c).includes('jellycut'),
  },
  {
    id: 'nq_hair_fringe', zone: 'hair', category: 'hair', icon: '〰️',
    text: 'Does your character have Fringe hair?',
    traitKey: 'nft_hair', traitValue: 'fringe',
    matchFn: (c) => nftHair(c).includes('fringe'),
  },
  {
    id: 'nq_hair_pompadour', zone: 'hair', category: 'hair', icon: '🌊',
    text: 'Does your character have a Pompadour?',
    traitKey: 'nft_hair', traitValue: 'pompadour',
    matchFn: (c) => nftHair(c).includes('pompadour'),
  },
  {
    id: 'nq_hair_milady', zone: 'hair', category: 'hair', icon: '👑',
    text: 'Does your character have Milady hair?',
    traitKey: 'nft_hair', traitValue: 'milady',
    matchFn: (c) => nftHair(c).includes('milady'),
  },
  {
    id: 'nq_hair_quan', zone: 'hair', category: 'hair', icon: '🍊',
    text: 'Does your character have Quan-style hair?',
    traitKey: 'nft_hair', traitValue: 'quan',
    matchFn: (c) => nftHair(c).includes('quan'),
  },
  {
    id: 'nq_hair_dark', zone: 'hair', category: 'hair', icon: '🖤',
    text: 'Does your character have dark or black hair?',
    traitKey: 'nft_hair', traitValue: 'dark_black',
    matchFn: (c) => { const h = nftHair(c); return h.includes('black') || h.includes('dark'); },
  },
  {
    id: 'nq_hair_red', zone: 'hair', category: 'hair', icon: '🔴',
    text: 'Does your character have red hair?',
    traitKey: 'nft_hair', traitValue: 'red',
    matchFn: (c) => nftHair(c).includes('red'),
  },
  {
    id: 'nq_hair_green', zone: 'hair', category: 'hair', icon: '🟢',
    text: 'Does your character have green hair?',
    traitKey: 'nft_hair', traitValue: 'green',
    matchFn: (c) => nftHair(c).includes('green'),
  },
  {
    id: 'nq_hair_pink', zone: 'hair', category: 'hair', icon: '🌸',
    text: 'Does your character have pink hair?',
    traitKey: 'nft_hair', traitValue: 'pink',
    matchFn: (c) => nftHair(c).includes('pink'),
  },
  {
    id: 'nq_hair_orange', zone: 'hair', category: 'hair', icon: '🟠',
    text: 'Does your character have orange hair?',
    traitKey: 'nft_hair', traitValue: 'orange',
    matchFn: (c) => nftHair(c).includes('orange'),
  },
  {
    id: 'nq_hair_blue', zone: 'hair', category: 'hair', icon: '🔵',
    text: 'Does your character have blue hair?',
    traitKey: 'nft_hair', traitValue: 'blue',
    matchFn: (c) => nftHair(c).includes('blue'),
  },
  {
    id: 'nq_hair_purple', zone: 'hair', category: 'hair', icon: '🟣',
    text: 'Does your character have purple hair?',
    traitKey: 'nft_hair', traitValue: 'purple',
    matchFn: (c) => nftHair(c).includes('purple'),
  },
  {
    id: 'nq_hair_light', zone: 'hair', category: 'hair', icon: '💫',
    text: 'Does your character have light, white, or blonde hair?',
    traitKey: 'nft_hair', traitValue: 'light_white_blonde',
    matchFn: (c) => { const h = nftHair(c); return h.includes('white') || h.includes('blonde') || h.includes('light'); },
  },

  // ══ FACE zone ══════════════════════════════════════════════════════════════
  {
    id: 'nq_mask', zone: 'face', category: 'face', icon: '🎭',
    text: 'Does your character wear a Mask?',
    traitKey: 'nft_has_mask', traitValue: true,
    matchFn: (c) => c.traits.nft_has_mask === true,
  },
  {
    id: 'nq_eyes_milady', zone: 'face', category: 'face', icon: '💙',
    text: 'Does your character have Milady-style eyes?',
    traitKey: 'nft_eyes', traitValue: 'milady',
    matchFn: (c) => nftEyes(c).includes('milady'),
  },
  {
    id: 'nq_eyes_schizo', zone: 'face', category: 'face', icon: '🔴',
    text: 'Does your character have Schizo-colored eyes?',
    traitKey: 'nft_eyes', traitValue: 'schizo',
    matchFn: (c) => nftEyes(c).includes('schizo'),
  },
  {
    id: 'nq_eyes_crying', zone: 'face', category: 'face', icon: '😢',
    text: 'Does your character have crying eyes?',
    traitKey: 'nft_eyes', traitValue: 'crying',
    matchFn: (c) => nftEyes(c).includes('crying'),
  },
  {
    id: 'nq_eyes_dead', zone: 'face', category: 'face', icon: '💀',
    text: 'Does your character have dead eyes?',
    traitKey: 'nft_eyes', traitValue: 'dead',
    matchFn: (c) => nftEyes(c).includes('dead'),
  },
  {
    id: 'nq_eyes_bloodshot', zone: 'face', category: 'face', icon: '🩸',
    text: 'Does your character have bloodshot eyes?',
    traitKey: 'nft_eyes', traitValue: 'blood_shot',
    matchFn: (c) => nftEyes(c).includes('blood'),
  },
  {
    id: 'nq_eyes_green', zone: 'face', category: 'face', icon: '💚',
    text: 'Does your character have green-pilled or green eyes?',
    traitKey: 'nft_eyes', traitValue: 'green',
    matchFn: (c) => nftEyes(c).includes('green'),
  },
  {
    id: 'nq_eyes_purple', zone: 'face', category: 'face', icon: '💜',
    text: 'Does your character have purple eyes?',
    traitKey: 'nft_eyes', traitValue: 'purple',
    matchFn: (c) => nftEyes(c).includes('purple'),
  },
  {
    id: 'nq_eyes_reptilian', zone: 'face', category: 'face', icon: '🐍',
    text: 'Does your character have reptilian red eyes?',
    traitKey: 'nft_eyes', traitValue: 'reptilian',
    matchFn: (c) => nftEyes(c).includes('reptilian'),
  },
  {
    id: 'nq_eyes_confusion', zone: 'face', category: 'face', icon: '😵',
    text: 'Does your character have confusion eyes?',
    traitKey: 'nft_eyes', traitValue: 'confusion',
    matchFn: (c) => nftEyes(c).includes('confusion'),
  },
  {
    id: 'nq_eyes_fire', zone: 'face', category: 'face', icon: '🔥',
    text: 'Does your character have fire eyes?',
    traitKey: 'nft_eyes', traitValue: 'fire',
    matchFn: (c) => nftEyes(c).includes('fire'),
  },
  {
    id: 'nq_eyes_devil', zone: 'face', category: 'face', icon: '😈',
    text: 'Does your character have devil eyes?',
    traitKey: 'nft_eyes', traitValue: 'devil',
    matchFn: (c) => nftEyes(c).includes('devil'),
  },
  {
    id: 'nq_eyes_stoned', zone: 'face', category: 'face', icon: '🍃',
    text: 'Does your character have stoned eyes?',
    traitKey: 'nft_eyes', traitValue: 'stoned',
    matchFn: (c) => nftEyes(c).includes('stoned'),
  },
  {
    id: 'nq_eyes_bionic', zone: 'face', category: 'face', icon: '🦾',
    text: 'Does your character have bionic eyes?',
    traitKey: 'nft_eyes', traitValue: 'bionic',
    matchFn: (c) => nftEyes(c).includes('bionic'),
  },
  {
    id: 'nq_eyes_ekubo', zone: 'face', category: 'face', icon: '🧿',
    text: 'Does your character have ekubo eyes?',
    traitKey: 'nft_eyes', traitValue: 'ekubo',
    matchFn: (c) => nftEyes(c).includes('ekubo'),
  },
  {
    id: 'nq_eyes_whirlpool', zone: 'face', category: 'face', icon: '🌀',
    text: 'Does your character have whirlpool eyes?',
    traitKey: 'nft_eyes', traitValue: 'whirlpool',
    matchFn: (c) => nftEyes(c).includes('whirlpool'),
  },
  {
    id: 'nq_eyes_hazelnut', zone: 'face', category: 'face', icon: '🌰',
    text: 'Does your character have hazelnut eyes?',
    traitKey: 'nft_eyes', traitValue: 'hazelnut',
    matchFn: (c) => nftEyes(c).includes('hazelnut'),
  },
  {
    id: 'nq_mouth_u', zone: 'face', category: 'face', icon: '🙂',
    text: 'Does your character have a U-shaped mouth?',
    traitKey: 'nft_mouth', traitValue: 'u',
    matchFn: (c) => { const m = nftMouth(c); return m === 'u' || m.startsWith('u '); },
  },
  {
    id: 'nq_mouth_w', zone: 'face', category: 'face', icon: '😬',
    text: 'Does your character have a W-shaped mouth?',
    traitKey: 'nft_mouth', traitValue: 'w',
    matchFn: (c) => nftMouth(c) === 'w',
  },
  {
    id: 'nq_mouth_squiggle', zone: 'face', category: 'face', icon: '〰️',
    text: 'Does your character have a squiggly/squiggle mouth?',
    traitKey: 'nft_mouth', traitValue: 'squig',
    matchFn: (c) => nftMouth(c).includes('squig'),
  },
  {
    id: 'nq_mouth_neutral', zone: 'face', category: 'face', icon: '😐',
    text: 'Does your character have a neutral mouth?',
    traitKey: 'nft_mouth', traitValue: 'neutral',
    matchFn: (c) => nftMouth(c) === 'neutral',
  },
  {
    id: 'nq_mouth_happy', zone: 'face', category: 'face', icon: '😊',
    text: 'Does your character have a happy mouth?',
    traitKey: 'nft_mouth', traitValue: 'happy',
    matchFn: (c) => nftMouth(c) === 'happy',
  },
  {
    id: 'nq_mouth_rectangle', zone: 'face', category: 'face', icon: '⬜',
    text: 'Does your character have a rectangular mouth?',
    traitKey: 'nft_mouth', traitValue: 'rectangle',
    matchFn: (c) => nftMouth(c) === 'rectangle',
  },
  {
    id: 'nq_mouth_v', zone: 'face', category: 'face', icon: '∨',
    text: 'Does your character have a V-shaped mouth?',
    traitKey: 'nft_mouth', traitValue: 'v',
    matchFn: (c) => nftMouth(c) === 'v',
  },
  {
    id: 'nq_brows_sad', zone: 'face', category: 'face', icon: '😢',
    text: 'Does your character have sad eyebrows?',
    traitKey: 'nft_eyebrows', traitValue: 'sad',
    matchFn: (c) => nftBrows(c).includes('sad'),
  },
  {
    id: 'nq_brows_notched', zone: 'face', category: 'face', icon: '➖',
    text: 'Does your character have notched eyebrows?',
    traitKey: 'nft_eyebrows', traitValue: 'notched',
    matchFn: (c) => nftBrows(c).includes('notch'),
  },
  {
    id: 'nq_brows_camo', zone: 'face', category: 'face', icon: '🛶',
    text: 'Does your character have camo eyebrows?',
    traitKey: 'nft_eyebrows', traitValue: 'camo',
    matchFn: (c) => nftBrows(c).includes('camo'),
  },
  {
    id: 'nq_brows_funky', zone: 'face', category: 'face', icon: '🤨',
    text: 'Does your character have funky eyebrows?',
    traitKey: 'nft_eyebrows', traitValue: 'funky',
    matchFn: (c) => nftBrows(c).includes('funky'),
  },
  {
    id: 'nq_brows_red', zone: 'face', category: 'face', icon: '🔴',
    text: 'Does your character have red eyebrows?',
    traitKey: 'nft_eyebrows', traitValue: 'red',
    matchFn: (c) => nftBrows(c).includes('red'),
  },

  // ══ BODY zone ══════════════════════════════════════════════════════════════
  // Body values verified from schizodio.art (March 2026):
  // Brother, Boy Who Cried Wolf, Greeny, Schizo Blue, Gora, Purple Urkle,
  // Snowflake, Cyborg, Stone, Lobster Pink (10 types per collection page)
  {
    id: 'nq_body_schizo', zone: 'body', category: 'body', icon: '🔵',
    text: 'Is your character a Schizo Blue body type?',
    traitKey: 'nft_body', traitValue: 'schizo',
    matchFn: (c) => nftBody(c).includes('schizo'),
  },
  {
    id: 'nq_body_greeny', zone: 'body', category: 'body', icon: '🟢',
    text: 'Is your character a Greeny body type?',
    traitKey: 'nft_body', traitValue: 'greeny',
    matchFn: (c) => nftBody(c).includes('greeny') || nftBody(c).includes('green'),
  },
  {
    id: 'nq_body_purple', zone: 'body', category: 'body', icon: '🟣',
    text: 'Is your character a Purple Urkle body type?',
    traitKey: 'nft_body', traitValue: 'purple',
    matchFn: (c) => nftBody(c).includes('purple'),
  },
  {
    id: 'nq_body_snowflake', zone: 'body', category: 'body', icon: '❄️',
    text: 'Is your character a Snowflake body type?',
    traitKey: 'nft_body', traitValue: 'snowflake',
    matchFn: (c) => nftBody(c).includes('snowflake'),
  },
  {
    id: 'nq_body_cyborg', zone: 'body', category: 'body', icon: '🤖',
    text: 'Is your character a Cyborg or Stone body type?',
    traitKey: 'nft_body', traitValue: 'cyborg_stone',
    matchFn: (c) => { const b = nftBody(c); return b.includes('cyborg') || b.includes('stone'); },
  },
  {
    id: 'nq_body_lobster', zone: 'body', category: 'body', icon: '🦞',
    text: 'Is your character a Lobster Pink body type?',
    traitKey: 'nft_body', traitValue: 'lobster',
    matchFn: (c) => nftBody(c).includes('lobster'),
  },
  {
    id: 'nq_body_brother', zone: 'body', category: 'body', icon: '🏠',
    text: 'Is your character a Brother body type?',
    traitKey: 'nft_body', traitValue: 'brother',
    matchFn: (c) => nftBody(c).includes('brother'),
  },
  {
    id: 'nq_body_wolf', zone: 'body', category: 'body', icon: '🐺',
    text: 'Is your character a Boy Who Cried Wolf body type?',
    traitKey: 'nft_body', traitValue: 'wolf',
    matchFn: (c) => nftBody(c).includes('wolf'),
  },
  {
    id: 'nq_body_gora', zone: 'body', category: 'body', icon: '🪨',
    text: 'Is your character a Gora body type?',
    traitKey: 'nft_body', traitValue: 'gora',
    matchFn: (c) => nftBody(c) === 'gora',
  },
  {
    id: 'nq_clothing_tshirt', zone: 'body', category: 'body', icon: '👕',
    text: 'Does your character wear a T-shirt?',
    traitKey: 'nft_clothing', traitValue: 'tshirt',
    matchFn: (c) => nftClothing(c).includes('tshirt'),
  },
  {
    id: 'nq_clothing_jacket', zone: 'body', category: 'body', icon: '🧥',
    text: 'Does your character wear a Jacket?',
    traitKey: 'nft_clothing', traitValue: 'jacket',
    matchFn: (c) => nftClothing(c).includes('jacket'),
  },
  {
    id: 'nq_clothing_skull', zone: 'body', category: 'body', icon: '💀',
    text: 'Does your character have a skull design on their clothing?',
    traitKey: 'nft_clothing', traitValue: 'skull',
    matchFn: (c) => nftClothing(c).includes('skull'),
  },

  // ══ GEAR zone ══════════════════════════════════════════════════════════════
  {
    id: 'nq_weapon', zone: 'gear', category: 'gear', icon: '⚔️',
    text: 'Does your character carry a Weapon?',
    traitKey: 'nft_has_weapons', traitValue: true,
    matchFn: (c) => c.traits.nft_has_weapons === true,
  },
  {
    id: 'nq_eyewear', zone: 'gear', category: 'gear', icon: '🕶️',
    text: 'Does your character wear Eyewear?',
    traitKey: 'nft_has_eyewear', traitValue: true,
    matchFn: (c) => c.traits.nft_has_eyewear === true,
  },
  {
    id: 'nq_headwear', zone: 'gear', category: 'gear', icon: '🎩',
    text: 'Does your character wear Headwear?',
    traitKey: 'nft_has_headwear', traitValue: true,
    matchFn: (c) => c.traits.nft_has_headwear === true,
  },
  {
    id: 'nq_accessories', zone: 'gear', category: 'gear', icon: '💎',
    text: 'Does your character have Accessories?',
    traitKey: 'nft_has_accessories', traitValue: true,
    matchFn: (c) => c.traits.nft_has_accessories === true,
  },
  {
    id: 'nq_overlay', zone: 'gear', category: 'gear', icon: '✨',
    text: 'Does your character have an Overlay effect?',
    traitKey: 'nft_has_overlay', traitValue: true,
    matchFn: (c) => c.traits.nft_has_overlay === true,
  },
  {
    id: 'nq_sidekick', zone: 'gear', category: 'gear', icon: '🐾',
    text: 'Does your character have a Sidekick?',
    traitKey: 'nft_has_sidekick', traitValue: true,
    matchFn: (c) => c.traits.nft_has_sidekick === true,
  },
  {
    id: 'nq_sidekick_randall', zone: 'gear', category: 'gear', icon: '🦎',
    text: 'Is your character\'s sidekick Randall?',
    traitKey: 'nft_sidekick', traitValue: 'randall',
    matchFn: (c) => nftSidekick(c).includes('randall'),
  },
  {
    id: 'nq_background_boardwalk', zone: 'body', category: 'body', icon: '🏖️',
    text: 'Is your character at the Richard Haynes Boardwalk?',
    traitKey: 'nft_background', traitValue: 'boardwalk',
    matchFn: (c) => nftBg(c).includes('boardwalk'),
  },
];

// ─── Unified export ───────────────────────────────────────────────────────────
/** All questions — used by game store, online sync, and evaluator. */
export const QUESTIONS = [...FREE_QUESTIONS, ...NFT_QUESTIONS];

/** Fast O(1) lookup by question ID (matchFn intact — never serialized). */
export const QUESTIONS_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
