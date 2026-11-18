import {
  PersonalityQuizProfile,
  CompatibilityMatch,
  SocialEnergy,
  SocialEnvironment,
  GroupSizePreference,
  UserProfile,
  AttendeeProfile
} from '../types';

export interface QuizOption<T> {
  value: T;
  title: string;
  description: string;
}

export const SOCIAL_ENERGY_OPTIONS: QuizOption<SocialEnergy>[] = [
  {
    value: 'introvert',
    title: 'Introverted / Low-Key',
    description: 'Recharges solo or in quiet 1-on-1s. Prefers calm spots and thoughtful conversation over noisy crowds.'
  },
  {
    value: 'ambivert',
    title: 'Ambivert / Balanced',
    description: 'Enjoys vibrant campus gatherings, but appreciates stepping aside for smaller chats and recharging.'
  },
  {
    value: 'extrovert',
    title: 'Extroverted / High Energy',
    description: 'Thrives in buzzing crowds, loves meeting lots of new faces, and brings lively social energy.'
  }
];

export const SOCIAL_ENVIRONMENT_OPTIONS: QuizOption<SocialEnvironment>[] = [
  {
    value: 'cozy_relaxed',
    title: 'Cozy & Relaxed',
    description: 'Quiet coffee shops, library lounges, art corners, and low-decibel casual spaces.'
  },
  {
    value: 'interactive_workshop',
    title: 'Collaborative & Structured',
    description: 'Tech build sprints, design jams, panels, and workshops with clear goals.'
  },
  {
    value: 'lively_vibrant',
    title: 'Bustling & High Energy',
    description: 'Night markets, food festivals, club showcases, and social mixers under the lights.'
  },
  {
    value: 'active_movement',
    title: 'Active & Recreational',
    description: 'Recreational volleyball, gym drop-ins, outdoor planting, and campus walking tours.'
  }
];

export const GROUP_SIZE_OPTIONS: QuizOption<GroupSizePreference>[] = [
  {
    value: 'duo',
    title: '1-on-1 Buddy Duo',
    description: 'Just two of us walking in and experiencing the event together.'
  },
  {
    value: 'small_pod',
    title: 'Small Pod (3–4 students)',
    description: 'A cozy small crew to explore stalls and sit together.'
  },
  {
    value: 'larger_group',
    title: 'Larger Circle (5+)',
    description: 'The more the merrier! Eager to mingle with a bigger group.'
  },
  {
    value: 'flexible',
    title: 'Flexible with Any Size',
    description: 'Happy with a 1-on-1 buddy or joining a larger group of attendees.'
  }
];

export const AVAILABLE_HOBBIES: string[] = [
  'Tech & Coding',
  'Foodie & Cafes',
  'Board Games & Trivia',
  'Gaming & Esports',
  'Running & Fitness',
  'Anime & Cinema',
  'Arts & Crafts',
  'Music & Concerts',
  'Sustainability & Nature',
  'Reading & Writing',
  'Entrepreneurship',
  'Racquet Sports & Intramurals'
];

export const AVAILABLE_EXPERIENCE_TYPES: string[] = [
  'Casual Conversations',
  'Hands-on Building',
  'Exploring Food Stalls',
  'Academic Deep Dives',
  'Cheering / Sports',
  'Chill Observation',
  'Networking & Career Prep',
  'Creative Making'
];

export const DEFAULT_ALEX_QUIZ: PersonalityQuizProfile = {
  completed: true,
  socialEnergy: 'introvert',
  socialEnvironment: 'cozy_relaxed',
  hobbies: ['Tech & Coding', 'Foodie & Cafes', 'Board Games & Trivia', 'Running & Fitness'],
  groupSize: 'duo',
  experienceTypes: ['Casual Conversations', 'Hands-on Building', 'Exploring Food Stalls']
};

/**
 * Calculates a transparent, explainable compatibility score between two students.
 * Explains *why* two students were matched based on mutual survey answers.
 */
export function calculateCompatibility(
  userQuiz?: PersonalityQuizProfile,
  partnerQuiz?: PersonalityQuizProfile,
  userProfile?: UserProfile | null,
  partnerProfile?: AttendeeProfile | null
): CompatibilityMatch {
  // If either has not completed the quiz, provide a warm baseline score with basic profile overlap
  if (!userQuiz || !partnerQuiz || !userQuiz.completed || !partnerQuiz.completed) {
    const reasons: string[] = [
      'Both verified University of Waterloo students',
      'Attending the same campus event'
    ];

    if (userProfile?.faculty && partnerProfile?.faculty && userProfile.faculty === partnerProfile.faculty) {
      reasons.push(`Shared Faculty of ${userProfile.faculty}`);
    }

    return {
      score: 75,
      overallVibe: 'Good Match',
      reasons,
      sharedHobbies: [],
      sharedExperienceTypes: [],
      socialEnergyAlignment: 'Social style open',
      environmentAlignment: 'Atmosphere open',
      groupAlignment: 'Open to connecting'
    };
  }

  let score = 50;
  const reasons: string[] = [];

  // 1. Social Energy alignment (Introvert / Ambivert / Extrovert)
  let energyAlignment = '';
  if (userQuiz.socialEnergy === partnerQuiz.socialEnergy) {
    score += 15;
    if (userQuiz.socialEnergy === 'introvert') {
      energyAlignment = 'Both recharge in calmer, low-pressure settings';
      reasons.push('Shared low-pressure social energy — neither feels pushed into overwhelming crowds');
    } else if (userQuiz.socialEnergy === 'ambivert') {
      energyAlignment = 'Both enjoy balanced social pacing';
      reasons.push('Matched ambivert styles — both enjoy event buzz with moments to step back');
    } else {
      energyAlignment = 'Both bring high enthusiasm and energetic presence';
      reasons.push('Matching high social energy — excited to dive right into the crowd');
    }
  } else if (
    (userQuiz.socialEnergy === 'ambivert' && partnerQuiz.socialEnergy === 'introvert') ||
    (userQuiz.socialEnergy === 'introvert' && partnerQuiz.socialEnergy === 'ambivert')
  ) {
    score += 12;
    energyAlignment = 'Complimentary relaxed pacing';
    reasons.push('Compatible social energy — supportive, patient vibe for attending together');
  } else {
    score += 8;
    energyAlignment = 'Balanced dynamic';
  }

  // 2. Preferred Environment alignment
  let envAlignment = '';
  if (userQuiz.socialEnvironment === partnerQuiz.socialEnvironment) {
    score += 15;
    const envObj = SOCIAL_ENVIRONMENT_OPTIONS.find((e) => e.value === userQuiz.socialEnvironment);
    envAlignment = envObj?.title || 'Matching atmosphere preference';
    reasons.push(`Both prefer ${envObj?.title.toLowerCase()} settings`);
  } else {
    score += 6;
    envAlignment = 'Flexible event atmosphere';
  }

  // 3. Preferred Group Size alignment
  let groupAlign = '';
  if (
    userQuiz.groupSize === partnerQuiz.groupSize ||
    userQuiz.groupSize === 'flexible' ||
    partnerQuiz.groupSize === 'flexible'
  ) {
    score += 10;
    if (userQuiz.groupSize === 'duo' && partnerQuiz.groupSize === 'duo') {
      groupAlign = 'Both specifically prefer a 1-on-1 buddy duo';
      reasons.push('Both specifically looking for a 1-on-1 buddy duo to walk in with');
    } else {
      groupAlign = 'Compatible group size preferences';
      reasons.push('Aligned on group format and comfortable pacing');
    }
  } else {
    score += 4;
    groupAlign = 'Open group expectations';
  }

  // 4. Shared Hobbies (Multi-select overlap)
  const sharedHobbies = userQuiz.hobbies.filter((h) => partnerQuiz.hobbies.includes(h));
  if (sharedHobbies.length > 0) {
    const hobbyBoost = Math.min(sharedHobbies.length * 5, 20);
    score += hobbyBoost;
    reasons.push(`Common hobbies: ${sharedHobbies.slice(0, 3).join(', ')}${sharedHobbies.length > 3 ? ` +${sharedHobbies.length - 3} more` : ''}`);
  }

  // 5. Shared Experience Types
  const sharedExperienceTypes = userQuiz.experienceTypes.filter((e) =>
    partnerQuiz.experienceTypes.includes(e)
  );
  if (sharedExperienceTypes.length > 0) {
    const expBoost = Math.min(sharedExperienceTypes.length * 4, 15);
    score += expBoost;
    reasons.push(`Both enjoy: ${sharedExperienceTypes.slice(0, 2).join(' & ')}`);
  }

  // 6. Faculty / Year contextual alignment
  if (userProfile?.faculty && partnerProfile?.faculty && userProfile.faculty === partnerProfile.faculty) {
    score += 5;
    reasons.push(`Both in the Faculty of ${userProfile.faculty}`);
  }

  // Normalize final score between 65% and 98%
  const finalScore = Math.min(Math.max(score, 65), 98);

  let overallVibe = 'Great Match';
  if (finalScore >= 90) overallVibe = 'Exceptional Match';
  else if (finalScore >= 82) overallVibe = 'High Compatibility';

  return {
    score: finalScore,
    overallVibe,
    reasons,
    sharedHobbies,
    sharedExperienceTypes,
    socialEnergyAlignment: energyAlignment,
    environmentAlignment: envAlignment,
    groupAlignment: groupAlign
  };
}
