import {
  PersonalityQuizProfile,
  CompatibilityMatch,
  BuddyQuizAnswers,
  BuddyPreferenceTag,
  BuddyArchetype,
  SocialBatteryTag,
  UserProfile,
  AttendeeProfile
} from '../types';

export type QuizQuestionKey = keyof BuddyQuizAnswers;

export interface GamifiedQuizOption {
  key: 'A' | 'B' | 'C';
  label: string;
  emoji: string;
  shortTag: string;
  bannerPhrase: string;
  conversationPrompt: string;
}

export interface GamifiedQuizQuestion {
  id: QuizQuestionKey;
  stepNumber: number;
  question: string;
  options: GamifiedQuizOption[];
}

export const BUDDY_QUIZ_QUESTIONS: GamifiedQuizQuestion[] = [
  {
    id: 'q1',
    stepNumber: 1,
    question: "Free Friday night. What's your vibe?",
    options: [
      {
        key: 'A',
        label: 'Big social event',
        emoji: '🎉',
        shortTag: 'Big Social Events',
        bannerPhrase: 'big social events',
        conversationPrompt: "What's been your favorite big campus event so far?"
      },
      {
        key: 'B',
        label: 'Chill cafe hangout',
        emoji: '☕',
        shortTag: 'Chill Cafe',
        bannerPhrase: 'chill cafe hangouts',
        conversationPrompt: "What's your go-to coffee or study cafe spot around Waterloo?"
      }
    ]
  },
  {
    id: 'q2',
    stepNumber: 2,
    question: "You're at a new club event. You'd rather...",
    options: [
      {
        key: 'A',
        label: 'Meet lots of new people',
        emoji: '🤝',
        shortTag: 'Meeting New People',
        bannerPhrase: 'meeting lots of new faces',
        conversationPrompt: 'Are you trying to branch out into new clubs this term?'
      },
      {
        key: 'B',
        label: 'Get to know 1–2 people well',
        emoji: '💬',
        shortTag: '1–2 Real Chats',
        bannerPhrase: 'small groups & deeper 1–2 person chats',
        conversationPrompt: "What's something you're super into outside of classes right now?"
      }
    ]
  },
  {
    id: 'q3',
    stepNumber: 3,
    question: 'What role do you naturally play in a group?',
    options: [
      {
        key: 'A',
        label: 'The Planner (organizes the details)',
        emoji: '🗓️',
        shortTag: 'The Planner',
        bannerPhrase: 'being the group planner',
        conversationPrompt: 'Want to pick a spot to meet 10 minutes before it starts?'
      },
      {
        key: 'B',
        label: 'The Connector (introduces everyone)',
        emoji: '✨',
        shortTag: 'The Connector',
        bannerPhrase: 'bringing people together',
        conversationPrompt: 'Do you know anyone else heading to this event too?'
      },
      {
        key: 'C',
        label: 'The Chill One (goes with the flow)',
        emoji: '🌿',
        shortTag: 'Go-with-the-Flow',
        bannerPhrase: 'keeping things easygoing and going with the flow',
        conversationPrompt: 'No pressure on timing — want to just wing it and explore together?'
      }
    ]
  },
  {
    id: 'q4',
    stepNumber: 4,
    question: "Your Saturday suddenly clears up. What's the move?",
    options: [
      {
        key: 'A',
        label: 'Try a completely new activity',
        emoji: '🧭',
        shortTag: 'Trying New Things',
        bannerPhrase: 'trying new activities',
        conversationPrompt: "What's something new on campus you've been wanting to try?"
      },
      {
        key: 'B',
        label: 'Stick to a favorite hobby or hangout',
        emoji: '🎧',
        shortTag: 'Favorite Hobbies',
        bannerPhrase: 'favorite cozy hobbies',
        conversationPrompt: "What's your comfort weekend hobby when you finally get free time?"
      },
      {
        key: 'C',
        label: 'Hit the gym or play sports',
        emoji: '🏀',
        shortTag: 'Gym & Sports',
        bannerPhrase: 'staying active & playing sports',
        conversationPrompt: 'Do you play any intramurals or hit PAC/CIF during the week?'
      }
    ]
  },
  {
    id: 'q5',
    stepNumber: 5,
    question: 'An event gets announced for tonight. You...',
    options: [
      {
        key: 'A',
        label: 'Decide on the spot',
        emoji: '⚡',
        shortTag: 'Spontaneous Plans',
        bannerPhrase: 'spontaneous last-minute plans',
        conversationPrompt: "What's the best last-minute campus plan you've ever said yes to?"
      },
      {
        key: 'B',
        label: 'Prefer planning ahead',
        emoji: '📌',
        shortTag: 'Planning Ahead',
        bannerPhrase: 'planning ahead',
        conversationPrompt: 'Are there any other events on your radar for this week?'
      }
    ]
  },
  {
    id: 'q6',
    stepNumber: 6,
    question: "In a new conversation, you're usually the...",
    options: [
      {
        key: 'A',
        label: 'Talker (keeps the energy going)',
        emoji: '🗣️',
        shortTag: 'High-Energy Talker',
        bannerPhrase: 'keeping the conversation flowing',
        conversationPrompt: "What's been the highlight of your week so far?"
      },
      {
        key: 'B',
        label: 'Listener (asks questions & vibes)',
        emoji: '👂',
        shortTag: 'Thoughtful Listener',
        bannerPhrase: 'thoughtful low-pressure conversation',
        conversationPrompt: 'What made you want to check out this event?'
      }
    ]
  },
  {
    id: 'q7',
    stepNumber: 7,
    question: 'Your ideal event buddy is someone who...',
    options: [
      {
        key: 'A',
        label: 'Pushes me to try new things',
        emoji: '🚀',
        shortTag: 'Adventure Buddy',
        bannerPhrase: 'pushing each other to try new things',
        conversationPrompt: "What's one thing at this event you definitely want to check out?"
      },
      {
        key: 'B',
        label: 'Matches my comfort level',
        emoji: '🫶',
        shortTag: 'Comfort-Zone Buddy',
        bannerPhrase: 'matching each other’s comfort level',
        conversationPrompt: 'Want to walk in together so it feels less awkward at the start?'
      }
    ]
  },
  {
    id: 'q8',
    stepNumber: 8,
    question: 'Pick your peak energy window:',
    options: [
      {
        key: 'A',
        label: 'Morning coffee & a walk',
        emoji: '🌅',
        shortTag: 'Morning Coffee',
        bannerPhrase: 'morning coffee & campus walks',
        conversationPrompt: 'Favorite coffee spot before morning lectures?'
      },
      {
        key: 'B',
        label: 'Midnight shawarma & late-night hangs',
        emoji: '🌯',
        shortTag: 'Midnight Shawarma',
        bannerPhrase: 'midnight shawarma & late-night hangs',
        conversationPrompt: 'Important Waterloo question: Lazeez, Osmow’s, or Shawerma Plus?'
      }
    ]
  }
];

export const BUDDY_PREFERENCE_BUBBLES: BuddyPreferenceTag[] = [
  'Women only',
  'Men only',
  'Group match (3–4 people)',
  'Same faculty',
  'Outside my faculty',
  'Same year',
  'Alcohol-free hangouts',
  'Strictly platonic',
  'Study-focused',
  'Punctual / No flakes',
  'Lives on campus',
  'Commuter-friendly'
];

export interface SocialBatteryOption {
  tag: SocialBatteryTag;
  emoji: string;
  subtitle: string;
}

export const SOCIAL_BATTERY_OPTIONS: SocialBatteryOption[] = [
  {
    tag: 'Hyped & Chatty',
    emoji: '⚡',
    subtitle: 'Ready to mingle, joke around, and soak up the vibe'
  },
  {
    tag: 'Chill & Observing',
    emoji: '☕',
    subtitle: 'Low-key hanging out, taking it in at an easy pace'
  },
  {
    tag: 'Strictly Networking',
    emoji: '💼',
    subtitle: 'Focused on meeting people, panels, and career chats'
  },
  {
    tag: "Just don't want to walk alone",
    emoji: '🚶',
    subtitle: 'Friendly company walking in — zero small-talk pressure'
  }
];

export const DEFAULT_ALEX_ANSWERS: BuddyQuizAnswers = {
  q1: 'B', // Chill cafe hangout
  q2: 'B', // Get to know 1-2 people well
  q3: 'C', // The Chill One
  q4: 'A', // Try a completely new activity
  q5: 'B', // Prefer planning ahead
  q6: 'B', // Listener
  q7: 'B', // Matches my comfort level
  q8: 'B'  // Midnight shawarma & late-night hangs
};

export function computeBuddyArchetype(answers?: BuddyQuizAnswers): BuddyArchetype {
  if (!answers) {
    return {
      id: 'campus_explorer',
      title: 'Curious Campus Explorer',
      emoji: '🐝',
      summary: 'Open to meeting friendly Waterloo students at their own pace.'
    };
  }

  const extroScore =
    (answers.q1 === 'A' ? 1 : 0) +
    (answers.q2 === 'A' ? 1 : 0) +
    (answers.q6 === 'A' ? 1 : 0);

  if (answers.q8 === 'B' && answers.q1 === 'B') {
    return {
      id: 'midnight_cafe_wanderer',
      title: 'Midnight Shawarma & Chill',
      emoji: '🌯',
      summary: 'Low-pressure vibes, late-night Plaza runs, and real 1-on-1 conversations.'
    };
  }

  if (answers.q4 === 'C') {
    return {
      id: 'active_warrior',
      title: 'Active Adventure Buddy',
      emoji: '🏃',
      summary: 'Down for intramurals, spontaneous campus moves, and high-momentum hangs.'
    };
  }

  if (answers.q3 === 'A' && answers.q5 === 'B') {
    return {
      id: 'master_planner',
      title: 'Master Event Planner',
      emoji: '🗓️',
      summary: 'Always knows the meetup spot, shows up on time, and makes events effortless.'
    };
  }

  if (answers.q3 === 'B' || extroScore >= 3) {
    return {
      id: 'hive_connector',
      title: 'The Hive Connector',
      emoji: '✨',
      summary: 'Brings warm social energy and makes everyone in the room feel welcome.'
    };
  }

  if (answers.q4 === 'A' && answers.q7 === 'A') {
    return {
      id: 'spontaneous_catalyst',
      title: 'Spontaneous Explorer',
      emoji: '🧭',
      summary: 'Loves saying yes to new clubs, fresh experiences, and campus discoveries.'
    };
  }

  if (answers.q8 === 'A') {
    return {
      id: 'morning_coffee_pal',
      title: 'Morning Coffee Strategist',
      emoji: '☕',
      summary: 'Sunny campus walks, iced lattes, and easygoing conversations.'
    };
  }

  return {
    id: 'cozy_conversationalist',
    title: 'Cozy Cafe Companion',
    emoji: '🌿',
    summary: 'Relaxed, thoughtful, and great company for walking into events stress-free.'
  };
}

export const DEFAULT_ALEX_QUIZ: PersonalityQuizProfile = {
  completed: true,
  answers: DEFAULT_ALEX_ANSWERS,
  preferenceBubbles: ['Strictly platonic', 'Punctual / No flakes'],
  archetype: computeBuddyArchetype(DEFAULT_ALEX_ANSWERS)
};

/**
 * Safely normalizes any stored/legacy quiz profile into the new 8-question format.
 */
export function normalizeQuizProfile(quiz?: PersonalityQuizProfile): PersonalityQuizProfile | undefined {
  if (!quiz) return undefined;
  if (quiz.answers && quiz.answers.q1 && quiz.answers.q8) {
    return {
      ...quiz,
      preferenceBubbles: Array.isArray(quiz.preferenceBubbles) ? quiz.preferenceBubbles : [],
      archetype: quiz.archetype || computeBuddyArchetype(quiz.answers)
    };
  }
  if (!quiz.completed) {
    return {
      completed: false,
      preferenceBubbles: Array.isArray(quiz.preferenceBubbles) ? quiz.preferenceBubbles : []
    };
  }
  // Migrate legacy quiz seamlessly to valid answers
  const migratedAnswers: BuddyQuizAnswers = {
    q1: quiz.socialEnergy === 'extrovert' ? 'A' : 'B',
    q2: quiz.groupSize === 'larger_group' ? 'A' : 'B',
    q3: quiz.socialEnvironment === 'interactive_workshop' ? 'A' : quiz.socialEnergy === 'extrovert' ? 'B' : 'C',
    q4: quiz.socialEnvironment === 'active_movement' ? 'C' : quiz.socialEnvironment === 'lively_vibrant' ? 'A' : 'B',
    q5: quiz.socialEnergy === 'extrovert' ? 'A' : 'B',
    q6: quiz.socialEnergy === 'introvert' ? 'B' : 'A',
    q7: quiz.socialEnergy === 'extrovert' ? 'A' : 'B',
    q8: quiz.socialEnvironment === 'cozy_relaxed' ? 'B' : 'A'
  };
  return {
    completed: true,
    answers: migratedAnswers,
    preferenceBubbles: Array.isArray(quiz.preferenceBubbles) ? quiz.preferenceBubbles : [],
    archetype: computeBuddyArchetype(migratedAnswers),
    updatedAt: quiz.updatedAt
  };
}

function getOptionMeta(qId: QuizQuestionKey, choice: string): GamifiedQuizOption | undefined {
  const q = BUDDY_QUIZ_QUESTIONS.find((item) => item.id === qId);
  return q?.options.find((o) => o.key === choice);
}

/**
 * Dynamically generates the short Icebreaker Hook Pill (for Match Invitation cards)
 * and the pinned Icebreaker Hook Banner + question (for Active Chats) by comparing
 * 1–2 matching answers between the user and the buddy.
 */
export function generateIcebreakerHooks(
  userAnswers?: BuddyQuizAnswers,
  partnerAnswers?: BuddyQuizAnswers,
  partnerName?: string,
  eventTitle?: string
): { pill: string; banner: string; question: string; sharedTraits: string[] } {
  if (!userAnswers || !partnerAnswers) {
    const fallbackEvent = eventTitle ? `for ${eventTitle}` : 'on campus';
    return {
      pill: 'Verified Waterloo Buddy Match',
      banner: `Icebreaker: You're both heading out ${fallbackEvent}. Ask them what they're most excited for!`,
      question: eventTitle
        ? `Hey${partnerName ? ` ${partnerName.split(' ')[0]}` : ''}! What are you most excited for at ${eventTitle}?`
        : "Hey! What campus events are you most excited for this week?",
      sharedTraits: []
    };
  }

  // Prioritize the most fun / conversational questions first for Icebreakers
  const priorityOrder: QuizQuestionKey[] = ['q8', 'q1', 'q4', 'q2', 'q3', 'q7', 'q5', 'q6'];
  const matched: { qId: QuizQuestionKey; opt: GamifiedQuizOption }[] = [];

  for (const qId of priorityOrder) {
    if (userAnswers[qId] === partnerAnswers[qId]) {
      const opt = getOptionMeta(qId, userAnswers[qId]);
      if (opt) matched.push({ qId, opt });
    }
  }

  // Complementary Talker + Listener synergy if fewer than 2 exact matches
  const hasTalkerListenerPair =
    (userAnswers.q6 === 'A' && partnerAnswers.q6 === 'B') ||
    (userAnswers.q6 === 'B' && partnerAnswers.q6 === 'A');

  if (matched.length >= 2) {
    const first = matched[0].opt;
    const second = matched[1].opt;
    return {
      pill: `You both picked ${first.shortTag} & ${second.shortTag}`,
      banner: `Icebreaker: You both prefer ${first.bannerPhrase} and ${second.bannerPhrase}. Ask them what they're most excited for!`,
      question: first.conversationPrompt,
      sharedTraits: matched.slice(0, 3).map((m) => m.opt.shortTag)
    };
  }

  if (matched.length === 1) {
    const first = matched[0].opt;
    const secondClause = hasTalkerListenerPair
      ? 'make a balanced Talker + Listener duo'
      : 'bring great complementary energy';
    return {
      pill: `You both picked ${first.shortTag}`,
      banner: `Icebreaker: You both love ${first.bannerPhrase} and ${secondClause}. Ask them what they're most excited for!`,
      question: first.conversationPrompt,
      sharedTraits: [first.shortTag]
    };
  }

  if (hasTalkerListenerPair) {
    return {
      pill: 'Balanced Talker + Listener Vibe',
      banner: "Icebreaker: One of you keeps the energy going while the other brings thoughtful questions — a classic duo. Ask what drew them to this event!",
      question: "What made you want to check out this event?",
      sharedTraits: ['Balanced Talker + Listener']
    };
  }

  return {
    pill: 'Fresh Perspectives · Waterloo Buddies',
    banner: "Icebreaker: You bring different campus vibes that balance each other out. Ask them what they're most excited to check out!",
    question: "Hey! What are you most excited to check out at this event?",
    sharedTraits: []
  };
}

export interface ConversationStartersData {
  similarities: string[];
  prompts: string[];
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generates shared similarities and tailored clickable message starters
 * for an active chat, shown only when the user opens "Conversation starters".
 */
export function getConversationStarters(
  rawUserQuiz?: PersonalityQuizProfile,
  rawPartnerQuiz?: PersonalityQuizProfile,
  userProfile?: UserProfile | null,
  partnerProfile?: AttendeeProfile | null,
  eventSocialBattery?: SocialBatteryTag,
  eventId?: string,
  eventTitle?: string,
  isEventEnded = false
): ConversationStartersData {
  const userQuiz = normalizeQuizProfile(rawUserQuiz);
  const partnerQuiz = normalizeQuizProfile(rawPartnerQuiz);
  const userAnswers = userQuiz?.answers;
  const partnerAnswers = partnerQuiz?.answers;

  const similarities: string[] = [];
  const prompts: string[] = [];

  const addSimilarity = (label: string) => {
    const clean = label.trim();
    if (clean && !similarities.includes(clean)) {
      similarities.push(clean);
    }
  };

  const addPrompt = (prompt: string) => {
    const clean = prompt.trim();
    if (clean && !prompts.includes(clean)) {
      prompts.push(clean);
    }
  };

  if (userAnswers && partnerAnswers) {
    const priorityOrder: QuizQuestionKey[] = ['q8', 'q1', 'q4', 'q2', 'q3', 'q7', 'q5', 'q6'];
    for (const qId of priorityOrder) {
      if (userAnswers[qId] === partnerAnswers[qId]) {
        const opt = getOptionMeta(qId, userAnswers[qId]);
        if (opt) {
          addSimilarity(capitalizeFirst(opt.bannerPhrase));
          addPrompt(opt.conversationPrompt);
        }
      }
    }

    const hasTalkerListenerPair =
      (userAnswers.q6 === 'A' && partnerAnswers.q6 === 'B') ||
      (userAnswers.q6 === 'B' && partnerAnswers.q6 === 'A');
    if (hasTalkerListenerPair && similarities.length < 3) {
      addSimilarity('Balanced talker + listener vibe');
    }
  }

  // Event-specific social battery alignment
  const effectiveUserBattery = eventSocialBattery || inferDefaultSocialBattery(userAnswers);
  const effectivePartnerBattery =
    (eventId && partnerProfile?.eventSocialBatteries?.[eventId]) ||
    partnerProfile?.defaultSocialBattery ||
    inferDefaultSocialBattery(partnerAnswers);

  if (effectiveUserBattery && effectivePartnerBattery && effectiveUserBattery === effectivePartnerBattery) {
    addSimilarity(`Same vibe: ${effectiveUserBattery}`);
  }

  // Faculty & year overlap
  if (userProfile?.faculty && partnerProfile?.faculty && userProfile.faculty === partnerProfile.faculty) {
    addSimilarity(`Both in ${userProfile.faculty}`);
    if (prompts.length < 3) {
      addPrompt(`How are your ${userProfile.faculty} courses going this term?`);
    }
  }

  if (userProfile?.year && partnerProfile?.year && userProfile.year === partnerProfile.year) {
    addSimilarity(`Both in ${userProfile.year}`);
  }

  // Soft buddy preference overlap
  const dealbreakerResult = evaluateDealbreakers(
    userQuiz?.preferenceBubbles || [],
    userProfile,
    partnerProfile
  );
  for (const tag of dealbreakerResult.softMatched) {
    if (similarities.length < 4) {
      addSimilarity(tag);
    }
  }

  if (similarities.length === 0) {
    addSimilarity('Both verified UWaterloo students');
  }

  // Ensure at least 2 helpful, context-aware message starters
  const firstName = partnerProfile?.name ? partnerProfile.name.trim().split(/\s+/)[0] : '';
  if (prompts.length < 2) {
    if (isEventEnded) {
      addPrompt(
        eventTitle
          ? `Hey${firstName ? ` ${firstName}` : ''}! How did you find ${eventTitle}?`
          : `Hey${firstName ? ` ${firstName}` : ''}! How has your week on campus been going?`
      );
      addPrompt('Any other campus events on your radar this week?');
    } else {
      addPrompt(
        eventTitle
          ? `Hey${firstName ? ` ${firstName}` : ''}! What are you most excited to check out at ${eventTitle}?`
          : "Hey! What campus events are you most excited for this week?"
      );
      addPrompt('Want to meet up nearby a few minutes before it starts?');
    }
  }

  return {
    similarities: similarities.slice(0, 4),
    prompts: prompts.slice(0, 3)
  };
}

/**
 * Evaluates strict dealbreaker tags from preferenceBubbles.
 * Returns { passes: false, reason } if a strict preference is violated.
 */
export function evaluateDealbreakers(
  preferenceBubbles: BuddyPreferenceTag[] = [],
  userProfile?: UserProfile | null,
  partnerProfile?: AttendeeProfile | null
): { passes: boolean; reason?: string; softMatched: string[]; softTotal: number } {
  if (!partnerProfile || preferenceBubbles.length === 0) {
    return { passes: true, softMatched: [], softTotal: 0 };
  }

  // Hard filters
  if (preferenceBubbles.includes('Women only') && partnerProfile.gender && partnerProfile.gender !== 'woman') {
    return { passes: false, reason: 'Filtered out by Women only preference', softMatched: [], softTotal: 0 };
  }
  if (preferenceBubbles.includes('Men only') && partnerProfile.gender && partnerProfile.gender !== 'man') {
    return { passes: false, reason: 'Filtered out by Men only preference', softMatched: [], softTotal: 0 };
  }
  if (preferenceBubbles.includes('Alcohol-free hangouts') && partnerProfile.traits?.alcoholFree === false) {
    return { passes: false, reason: 'Filtered out by Alcohol-free hangouts preference', softMatched: [], softTotal: 0 };
  }
  if (
    preferenceBubbles.includes('Same faculty') &&
    userProfile?.faculty &&
    partnerProfile.faculty &&
    userProfile.faculty !== partnerProfile.faculty
  ) {
    return { passes: false, reason: 'Filtered out by Same faculty preference', softMatched: [], softTotal: 0 };
  }
  if (
    preferenceBubbles.includes('Outside my faculty') &&
    userProfile?.faculty &&
    partnerProfile.faculty &&
    userProfile.faculty === partnerProfile.faculty
  ) {
    return { passes: false, reason: 'Filtered out by Outside my faculty preference', softMatched: [], softTotal: 0 };
  }
  if (
    preferenceBubbles.includes('Same year') &&
    userProfile?.year &&
    partnerProfile.year &&
    userProfile.year !== partnerProfile.year
  ) {
    return { passes: false, reason: 'Filtered out by Same year preference', softMatched: [], softTotal: 0 };
  }

  // Soft preference boosts (contribute to the 20% preference/dealbreaker weight)
  const softTags: { tag: BuddyPreferenceTag; check: () => boolean }[] = [
    { tag: 'Group match (3–4 people)', check: () => Boolean(partnerProfile.traits?.prefersGroup) },
    { tag: 'Strictly platonic', check: () => partnerProfile.traits?.strictlyPlatonic !== false },
    { tag: 'Study-focused', check: () => Boolean(partnerProfile.traits?.studyFocused) },
    { tag: 'Punctual / No flakes', check: () => partnerProfile.traits?.punctual !== false },
    { tag: 'Lives on campus', check: () => Boolean(partnerProfile.traits?.livesOnCampus) },
    { tag: 'Commuter-friendly', check: () => Boolean(partnerProfile.traits?.commuterFriendly) }
  ];

  const activeSoft = softTags.filter((s) => preferenceBubbles.includes(s.tag));
  const softMatched = activeSoft.filter((s) => s.check()).map((s) => s.tag);

  return {
    passes: true,
    softMatched,
    softTotal: activeSoft.length
  };
}

function inferDefaultSocialBattery(answers?: BuddyQuizAnswers): SocialBatteryTag {
  if (!answers) return 'Chill & Observing';
  if (answers.q1 === 'A' && answers.q6 === 'A') return 'Hyped & Chatty';
  if (answers.q3 === 'A' && answers.q5 === 'B') return 'Strictly Networking';
  if (answers.q2 === 'B' && answers.q7 === 'B') return "Just don't want to walk alone";
  return 'Chill & Observing';
}

function scoreSocialBatteryMatch(
  userBattery?: SocialBatteryTag,
  partnerBattery?: SocialBatteryTag
): { points: number; alignmentLabel: string } {
  if (!userBattery || !partnerBattery) {
    return { points: 28, alignmentLabel: 'Flexible event energy' };
  }
  if (userBattery === partnerBattery) {
    return { points: 40, alignmentLabel: `Matched energy: ${userBattery}` };
  }
  const compatiblePairs: [SocialBatteryTag, SocialBatteryTag][] = [
    ['Chill & Observing', "Just don't want to walk alone"],
    ['Hyped & Chatty', 'Strictly Networking'],
    ['Chill & Observing', 'Strictly Networking']
  ];
  const isCompatible = compatiblePairs.some(
    ([a, b]) =>
      (userBattery === a && partnerBattery === b) ||
      (userBattery === b && partnerBattery === a)
  );
  if (isCompatible) {
    return { points: 29, alignmentLabel: `Complementary energy (${partnerBattery})` };
  }
  return { points: 18, alignmentLabel: `Different pace (${partnerBattery})` };
}

/**
 * Weighted scoring function on student profiles:
 * - 40% Quiz Compatibility (8-question answers)
 * - 40% Event-Specific Social Battery match
 * - 20% Preference / Dealbreaker filter (with hard-filtering for strict tags)
 */
export function calculateCompatibility(
  rawUserQuiz?: PersonalityQuizProfile,
  rawPartnerQuiz?: PersonalityQuizProfile,
  userProfile?: UserProfile | null,
  partnerProfile?: AttendeeProfile | null,
  eventSocialBattery?: SocialBatteryTag,
  eventId?: string,
  eventTitle?: string
): CompatibilityMatch {
  const userQuiz = normalizeQuizProfile(rawUserQuiz);
  const partnerQuiz = normalizeQuizProfile(rawPartnerQuiz);

  const userPrefs = userQuiz?.preferenceBubbles || [];
  const dealbreakerResult = evaluateDealbreakers(userPrefs, userProfile, partnerProfile);

  const icebreaker = generateIcebreakerHooks(
    userQuiz?.answers,
    partnerQuiz?.answers,
    partnerProfile?.name,
    eventTitle
  );

  // 1. 40% Quiz Compatibility
  let quizPoints = 28; // warm baseline if quiz not completed yet
  const reasons: string[] = [];

  if (userQuiz?.completed && userQuiz.answers && partnerQuiz?.completed && partnerQuiz.answers) {
    let matchedWeight = 0;
    const totalWeight = 8;
    const keys: QuizQuestionKey[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];

    for (const k of keys) {
      if (userQuiz.answers[k] === partnerQuiz.answers[k]) {
        matchedWeight += 1;
      } else if (k === 'q6') {
        // Talker + Listener is naturally complementary!
        matchedWeight += 0.85;
      } else if (k === 'q3') {
        // Planner + Chill One or Connector + Chill One also gels well
        matchedWeight += 0.55;
      } else {
        matchedWeight += 0.25;
      }
    }

    quizPoints = Math.round((matchedWeight / totalWeight) * 40);
    reasons.push(icebreaker.pill);
  } else {
    reasons.push('Both verified University of Waterloo students');
  }

  // 2. 40% Event-Specific Social Battery match
  const effectiveUserBattery = eventSocialBattery || inferDefaultSocialBattery(userQuiz?.answers);
  const effectivePartnerBattery =
    (eventId && partnerProfile?.eventSocialBatteries?.[eventId]) ||
    partnerProfile?.defaultSocialBattery ||
    inferDefaultSocialBattery(partnerQuiz?.answers);

  const batteryEval = scoreSocialBatteryMatch(effectiveUserBattery, effectivePartnerBattery);
  const batteryPoints = batteryEval.points;
  reasons.push(batteryEval.alignmentLabel);

  // 3. 20% Preference / Dealbreaker score
  let prefPoints = 16;
  if (!dealbreakerResult.passes) {
    prefPoints = 0;
  } else if (dealbreakerResult.softTotal > 0) {
    const ratio = dealbreakerResult.softMatched.length / dealbreakerResult.softTotal;
    prefPoints = Math.round(10 + ratio * 10);
    if (dealbreakerResult.softMatched.length > 0) {
      reasons.push(`Matches preferences: ${dealbreakerResult.softMatched.slice(0, 2).join(', ')}`);
    }
  } else if (userPrefs.length > 0) {
    // Passed all strict dealbreakers!
    prefPoints = 20;
    reasons.push('Matches all your buddy preferences');
  }

  if (userProfile?.faculty && partnerProfile?.faculty && userProfile.faculty === partnerProfile.faculty) {
    reasons.push(`Both in the Faculty of ${userProfile.faculty}`);
  }

  const rawTotal = quizPoints + batteryPoints + prefPoints;
  const finalScore = dealbreakerResult.passes ? Math.min(Math.max(rawTotal, 58), 99) : 0;

  let overallVibe = 'Great Match';
  if (finalScore >= 90) overallVibe = 'Exceptional Match';
  else if (finalScore >= 82) overallVibe = 'High Compatibility';

  return {
    score: finalScore,
    overallVibe,
    reasons: reasons.slice(0, 4),
    sharedHobbies: icebreaker.sharedTraits,
    sharedExperienceTypes: [],
    socialEnergyAlignment: batteryEval.alignmentLabel,
    environmentAlignment: icebreaker.pill,
    groupAlignment: dealbreakerResult.softMatched.join(', ') || 'Compatible buddy preferences',
    icebreakerPill: icebreaker.pill,
    icebreakerBanner: icebreaker.banner,
    icebreakerQuestion: icebreaker.question,
    quizScore: quizPoints,
    batteryScore: batteryPoints,
    preferenceScore: prefPoints,
    filteredOut: !dealbreakerResult.passes,
    filteredOutReason: dealbreakerResult.reason
  };
}
