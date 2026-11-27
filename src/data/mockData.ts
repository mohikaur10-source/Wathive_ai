import {
  EventItem,
  UserProfile,
  ConnectionRequest,
  Conversation,
  ChatMessage,
  AttendeeProfile,
  AggregationSource,
  DuplicateDetectionResult,
  SyncCycleReport,
  StudentDiscount,
  AdminAuditLog
} from '../types';
import { DEFAULT_ALEX_QUIZ, computeBuddyArchetype } from '../utils/compatibilityEngine';
import { toWaterlooUtcIso } from '../utils/timeZone';
import waterlooGooseAvatar from '../assets/images/waterloo_goose_avatar_1794962499830.jpg';

export const formatPublicName = (fullName: string | null | undefined): string => {
  if (!fullName || typeof fullName !== 'string') return '';
  const clean = fullName.trim();
  if (!clean) return '';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

export const INITIAL_USER: UserProfile = {
  id: 'user_alex_chen',
  name: 'Alex Chen',
  avatar: waterlooGooseAvatar,
  school: 'University of Waterloo',
  faculty: 'Mathematics',
  program: 'Computer Science',
  year: '3rd Year',
  bio: 'Interested in AI ethics, casual badminton, and student hacks. Always looking for people to explore campus events with!',
  dob: '2004-03-15', // Strictly private in profile/account settings
  email: 'alex.chen@uwaterloo.ca',
  isVerifiedUWStudent: true,
  uwEmail: 'alex.chen@uwaterloo.ca',
  onboarded: true,
  preferences: {
    categories: ['Technology', 'Career and networking', 'Social events', 'Sports and recreation'],
    noPreferences: false,
    preferredFaculties: ['Mathematics', 'Engineering'],
    preferredYears: ['2nd Year', '3rd Year', '4th Year']
  },
  personalityQuiz: DEFAULT_ALEX_QUIZ
};

export const SAMPLE_ATTENDEES: Record<string, AttendeeProfile> = {
  maya_patel: {
    id: 'maya_patel',
    name: 'Maya P.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    faculty: 'Engineering',
    program: 'Biomedical Engineering',
    year: '2nd Year',
    bio: 'Avid runner and coffee drinker. Looking to check out tech clubs and meetups this term!',
    gender: 'woman',
    defaultSocialBattery: 'Chill & Observing',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: false,
      prefersGroup: false
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'A',
        q4: 'A',
        q5: 'B',
        q6: 'B',
        q7: 'B',
        q8: 'B'
      },
      preferenceBubbles: ['Alcohol-free hangouts', 'Strictly platonic', 'Punctual / No flakes'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'A', q4: 'A', q5: 'B', q6: 'B', q7: 'B', q8: 'B'
      })
    }
  },
  marcus_zhao: {
    id: 'marcus_zhao',
    name: 'Marcus Z.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    faculty: 'Environment',
    program: 'Environment and Business',
    year: '4th Year',
    bio: 'Wrapping up undergrad! Big fan of sustainability projects, trivia, and career mixers.',
    gender: 'man',
    defaultSocialBattery: 'Hyped & Chatty',
    traits: {
      alcoholFree: false,
      strictlyPlatonic: true,
      studyFocused: false,
      punctual: true,
      livesOnCampus: false,
      commuterFriendly: true,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'A',
        q2: 'A',
        q3: 'B',
        q4: 'A',
        q5: 'A',
        q6: 'A',
        q7: 'A',
        q8: 'B'
      },
      preferenceBubbles: ['Group match (3–4 people)', 'Commuter-friendly'],
      archetype: computeBuddyArchetype({
        q1: 'A', q2: 'A', q3: 'B', q4: 'A', q5: 'A', q6: 'A', q7: 'A', q8: 'B'
      })
    }
  },
  chloe_tremblay: {
    id: 'chloe_tremblay',
    name: 'Chloe T.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80',
    faculty: 'Arts',
    program: 'Psychology',
    year: '1st Year',
    bio: 'First year at Waterloo! A bit shy in big crowds so excited to pair up for social gatherings.',
    gender: 'woman',
    defaultSocialBattery: "Just don't want to walk alone",
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: true,
      prefersGroup: false
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'C',
        q4: 'B',
        q5: 'B',
        q6: 'B',
        q7: 'B',
        q8: 'A'
      },
      preferenceBubbles: ['Women only', 'Alcohol-free hangouts', 'Lives on campus'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'C', q4: 'B', q5: 'B', q6: 'B', q7: 'B', q8: 'A'
      })
    }
  },
  liam_campbell: {
    id: 'liam_campbell',
    name: 'Liam C.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    faculty: 'Engineering',
    program: 'Mechatronics Engineering',
    year: '3rd Year',
    bio: 'Hardware tinkerer, robotics mentor, and intramural volleyball setter.',
    gender: 'man',
    defaultSocialBattery: 'Strictly Networking',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: false,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: false,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'A',
        q2: 'A',
        q3: 'A',
        q4: 'C',
        q5: 'A',
        q6: 'A',
        q7: 'A',
        q8: 'A'
      },
      preferenceBubbles: ['Group match (3–4 people)', 'Punctual / No flakes', 'Study-focused'],
      archetype: computeBuddyArchetype({
        q1: 'A', q2: 'A', q3: 'A', q4: 'C', q5: 'A', q6: 'A', q7: 'A', q8: 'A'
      })
    }
  },
  priya_sharma: {
    id: 'priya_sharma',
    name: 'Priya S.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    faculty: 'Science',
    program: 'Biochemistry',
    year: '2nd Year',
    bio: 'Pre-med student who loves film screenings and campus pottery workshops.',
    gender: 'woman',
    defaultSocialBattery: 'Chill & Observing',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: false,
      commuterFriendly: true,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'A',
        q4: 'B',
        q5: 'B',
        q6: 'B',
        q7: 'A',
        q8: 'A'
      },
      preferenceBubbles: ['Alcohol-free hangouts', 'Study-focused', 'Commuter-friendly'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'A', q4: 'B', q5: 'B', q6: 'B', q7: 'A', q8: 'A'
      })
    }
  },
  sarah_kim: {
    id: 'sarah_kim',
    name: 'Sarah K.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    faculty: 'Mathematics',
    program: 'Computer Science',
    year: '3rd Year',
    bio: '3rd year CS student who loves midnight Plaza shawarma runs, hackathons, and quiet study cafes.',
    gender: 'woman',
    defaultSocialBattery: 'Chill & Observing',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: true,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'C',
        q4: 'A',
        q5: 'A',
        q6: 'A',
        q7: 'B',
        q8: 'B'
      },
      preferenceBubbles: ['Same faculty', 'Alcohol-free hangouts', 'Strictly platonic'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'C', q4: 'A', q5: 'A', q6: 'A', q7: 'B', q8: 'B'
      })
    }
  },
  ethan_bhatia: {
    id: 'ethan_bhatia',
    name: 'Ethan B.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
    faculty: 'Health',
    program: 'Kinesiology',
    year: '3rd Year',
    bio: 'Intramural badminton player and SLC study-session regular.',
    gender: 'man',
    defaultSocialBattery: 'Hyped & Chatty',
    traits: {
      alcoholFree: false,
      strictlyPlatonic: true,
      studyFocused: false,
      punctual: true,
      livesOnCampus: false,
      commuterFriendly: true,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'A',
        q2: 'A',
        q3: 'B',
        q4: 'C',
        q5: 'A',
        q6: 'A',
        q7: 'A',
        q8: 'B'
      },
      preferenceBubbles: ['Group match (3–4 people)', 'Strictly platonic', 'Commuter-friendly'],
      archetype: computeBuddyArchetype({
        q1: 'A', q2: 'A', q3: 'B', q4: 'C', q5: 'A', q6: 'A', q7: 'A', q8: 'B'
      })
    }
  },
  nadia_hassan: {
    id: 'nadia_hassan',
    name: 'Nadia H.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    faculty: 'Mathematics',
    program: 'Combinatorics and Optimization',
    year: '4th Year',
    bio: 'Love campus board game nights, matcha lattes, and tech talks.',
    gender: 'woman',
    defaultSocialBattery: 'Chill & Observing',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: true,
      prefersGroup: false
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'A',
        q4: 'B',
        q5: 'B',
        q6: 'B',
        q7: 'B',
        q8: 'A'
      },
      preferenceBubbles: ['Same faculty', 'Alcohol-free hangouts', 'Punctual / No flakes'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'A', q4: 'B', q5: 'B', q6: 'B', q7: 'B', q8: 'A'
      })
    }
  },
  owen_reid: {
    id: 'owen_reid',
    name: 'Owen R.',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
    faculty: 'Arts',
    program: 'Economics',
    year: '2nd Year',
    bio: 'Up for coffee chats, club fairs, and weekend campus concerts.',
    gender: 'man',
    defaultSocialBattery: 'Chill & Observing',
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: false,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: false,
      prefersGroup: false
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'A',
        q3: 'C',
        q4: 'A',
        q5: 'A',
        q6: 'B',
        q7: 'A',
        q8: 'A'
      },
      preferenceBubbles: ['Alcohol-free hangouts', 'Strictly platonic', 'Lives on campus'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'A', q3: 'C', q4: 'A', q5: 'A', q6: 'B', q7: 'A', q8: 'A'
      })
    }
  },
  tessa_morales: {
    id: 'tessa_morales',
    name: 'Tessa M.',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80',
    faculty: 'Science',
    program: 'Physics & Astronomy',
    year: '1st Year',
    bio: 'Stargazing club member looking to meet friendly faces at campus events.',
    gender: 'woman',
    defaultSocialBattery: "Just don't want to walk alone",
    traits: {
      alcoholFree: true,
      strictlyPlatonic: true,
      studyFocused: true,
      punctual: true,
      livesOnCampus: true,
      commuterFriendly: true,
      prefersGroup: true
    },
    showFaculty: true,
    showYear: true,
    isVerifiedUWStudent: true,
    personalityQuiz: {
      completed: true,
      answers: {
        q1: 'B',
        q2: 'B',
        q3: 'C',
        q4: 'A',
        q5: 'B',
        q6: 'B',
        q7: 'B',
        q8: 'B'
      },
      preferenceBubbles: ['Alcohol-free hangouts', 'Strictly platonic', 'Lives on campus'],
      archetype: computeBuddyArchetype({
        q1: 'B', q2: 'B', q3: 'C', q4: 'A', q5: 'B', q6: 'B', q7: 'B', q8: 'B'
      })
    }
  }
};


export interface UWVenuePreset {
  name: string;
  code: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
}

export const UW_CAMPUS_VENUES: UWVenuePreset[] = [
  {
    name: 'Student Life Centre (SLC)',
    code: 'SLC',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47175,
    lng: -80.54535,
    description: 'Central student hub, Great Hall, clubs offices, food court'
  },
  {
    name: 'Physical Activities Complex (PAC)',
    code: 'PAC',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47250,
    lng: -80.54630,
    description: 'Warrior recreation, gyms 1-3, squash courts, pool'
  },
  {
    name: 'Engineering 7 (E7)',
    code: 'E7',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47304,
    lng: -80.53965,
    description: 'Ideas Clinic, Robohub, high-ceiling engineering atrium'
  },
  {
    name: 'Science Teaching Complex (STC)',
    code: 'STC',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47055,
    lng: -80.54350,
    description: 'Main lecture theaters, co-op fairs, open study atrium'
  },
  {
    name: 'Mathematics & Computer Building (MC)',
    code: 'MC',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47228,
    lng: -80.54395,
    description: 'MathSoc Comfy Lounge, computer labs, Red Room'
  },
  {
    name: 'Environment 3 (EV3)',
    code: 'EV3',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.46780,
    lng: -80.54320,
    description: 'Green living roof, ecology labs, courtyard'
  },
  {
    name: 'PAS Building (Psychology, Anthropology, Sociology)',
    code: 'PAS',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.46870,
    lng: -80.54360,
    description: 'Cognitive labs, research testing suites, seminar rooms'
  },
  {
    name: 'Davis Centre Library (DC)',
    code: 'DC',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.47290,
    lng: -80.54220,
    description: 'Engineering & science library, quiet study carrels'
  },
  {
    name: 'Hagey Hall (HH) & Humanities Theatre',
    code: 'HH',
    address: '200 University Ave W, Waterloo, ON N2L 3G1',
    lat: 43.46810,
    lng: -80.54580,
    description: 'Arts lecture halls, performance theatre, cafe lounge'
  },
  {
    name: 'Columbia Icefield (CIF)',
    code: 'CIF',
    address: '220 Columbia St W, Waterloo, ON N2L 3G1',
    lat: 43.47640,
    lng: -80.55110,
    description: 'Warrior ice arenas, varsity gym, outdoor turf fields'
  }
];

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  'Technology': { bg: 'bg-blue-600', text: 'text-white', hex: '#2563EB' },
  'Career and networking': { bg: 'bg-amber-500', text: 'text-stone-950', hex: '#F59E0B' },
  'Social events': { bg: 'bg-pink-600', text: 'text-white', hex: '#DB2777' },
  'Sports and recreation': { bg: 'bg-emerald-600', text: 'text-white', hex: '#059669' },
  'Arts and culture': { bg: 'bg-purple-600', text: 'text-white', hex: '#7C3AED' },
  'Volunteering': { bg: 'bg-teal-600', text: 'text-white', hex: '#0D9488' },
  'Academic workshops': { bg: 'bg-indigo-600', text: 'text-white', hex: '#4F46E5' },
  'Research participation': { bg: 'bg-orange-600', text: 'text-white', hex: '#EA580C' }
};

// WatHive event catalogue is dynamically populated from live backend (/api/collector/preview)
export const INITIAL_EVENTS: EventItem[] = [];

// Buddy seekers per event are deterministically generated via getSeedBuddySeekers(eventId)
export const INITIAL_EVENT_ATTENDEES: Record<string, string[]> = {};

export const INITIAL_USER_ATTENDING = ['wusa_253953'];
export const INITIAL_USER_SAVED = ['wusa_246689', 'wusa_255978'];
// Buddy matching is strictly OFF by default per event. Users must explicitly opt in.
export const INITIAL_USER_VISIBILITY: Record<string, boolean> = {};

export const INITIAL_REQUESTS: ConnectionRequest[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [];

export const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {};

export const UW_FACULTIES = [
  'Engineering',
  'Mathematics',
  'Science',
  'Arts',
  'Environment',
  'Health'
];

export const STUDY_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Graduate (Master’s / PhD)'
];

export const EVENT_CATEGORIES = [
  'Arts and culture',
  'Technology',
  'Career and networking',
  'Sports and recreation',
  'Social events',
  'Volunteering',
  'Academic workshops',
  'Research participation'
];

export const NOTIFICATION_CATEGORIES: import('../types').NotificationInterestCategory[] = [
  'Sports and fitness',
  'Nightlife and entertainment',
  'Food and student deals',
  'Networking and professional development',
  'Cultural and religious gatherings',
  'University clubs',
  'Volunteering and community activities',
  'Arts and music'
];

export const DEFAULT_NOTIFICATION_SETTINGS: import('../types').NotificationSettings = {
  interestedCategories: [
    'Food and student deals',
    'Networking and professional development',
    'University clubs',
    'Sports and fitness'
  ],
  types: {
    newEvents: true,
    upcomingRsvp: true,
    buddyMatches: true,
    registrationDeadlines: true,
    eventChanges: true,
    studentDiscounts: true
  },
  frequency: 'instant',
  quietHoursEnabled: true,
  avoidOverwhelming: true
};

export const INITIAL_NOTIFICATIONS: import('../types').InAppNotification[] = [];

// Technical & Operational Aggregation Feeds (Requirement 8)
export const INITIAL_AGGREGATION_SOURCES: AggregationSource[] = [
  {
    id: 'src_wusa',
    name: 'WUSA Events Feed',
    organization: 'Waterloo Undergraduate Student Association',
    type: 'api',
    endpointUrl: 'https://wusa.ca/api/v2/events.json',
    categoryDefault: 'Social events',
    lastSyncTime: '12m ago',
    status: 'healthy',
    httpStatus: 200,
    latencyMs: 112,
    eventsIngested: 28,
    isUniversityOfficial: true
  },
  {
    id: 'src_uw_open',
    name: 'UW Open Data & Portal',
    organization: 'University of Waterloo IST',
    type: 'api',
    endpointUrl: 'https://api.uwaterloo.ca/v2/events/all.json',
    categoryDefault: 'Academic workshops',
    lastSyncTime: '12m ago',
    status: 'healthy',
    httpStatus: 200,
    latencyMs: 145,
    eventsIngested: 34,
    isUniversityOfficial: true
  },
  {
    id: 'src_societies',
    name: 'MathSoc & EngSoc Syndication',
    organization: 'Waterloo Student Societies Council',
    type: 'rss',
    endpointUrl: 'https://societies.uwaterloo.ca/feeds/rss.xml',
    categoryDefault: 'University clubs',
    lastSyncTime: '12m ago',
    status: 'healthy',
    httpStatus: 200,
    latencyMs: 198,
    eventsIngested: 19,
    isUniversityOfficial: true
  },
  {
    id: 'src_uptown_bia',
    name: 'Uptown Waterloo BIA Community Feed',
    organization: 'City of Waterloo & Uptown BIA',
    type: 'partner_webhook',
    endpointUrl: 'https://uptownwaterloobia.com/api/events',
    categoryDefault: 'Social events',
    lastSyncTime: '12m ago',
    status: 'healthy',
    httpStatus: 200,
    latencyMs: 260,
    eventsIngested: 12,
    isUniversityOfficial: false
  },
  {
    id: 'src_housing_hub',
    name: 'Off-Campus Student Housing & Co-op Hub',
    organization: 'UW Community Relations',
    type: 'partner_webhook',
    endpointUrl: 'https://community.uwaterloo.ca/webhooks/events',
    categoryDefault: 'Volunteering',
    lastSyncTime: '1h 50m ago',
    status: 'healthy',
    httpStatus: 200,
    latencyMs: 210,
    eventsIngested: 7,
    isUniversityOfficial: false
  }
];

export const INITIAL_SYNC_REPORT: SyncCycleReport = {
  id: 'sync_initial_001',
  cycleStartedAt: '12:00:00 PM',
  cycleCompletedAt: '12:00:01 PM',
  durationMs: 412,
  sourcesQueried: 5,
  eventsIngested: 100,
  duplicatesFlagged: 1,
  errorsCaught: 0,
  nextScheduledRefresh: '2:00 PM (Every 2h)'
};

export const INITIAL_DUPLICATES: DuplicateDetectionResult[] = [
  {
    id: 'dup_wusa_001',
    primaryEvent: {
      id: 'wusa_244841',
      title: 'Fruit & Veggie Market',
      coverImage: 'https://wusa.ca/wp-content/uploads/2026/09/Fruit-and-Veggie-Market.png',
      organizer: 'WUSA Operations',
      organizerType: 'WUSA',
      isOrganizationAccount: true,
      category: 'Social events',
      facultyAffiliation: 'All Faculties',
      description: 'Affordable fresh produce on campus open to all undergraduate students.',
      date: '2026-10-28',
      startTime: '11:00',
      endTime: '15:00',
      isOnline: false,
      location: 'Student Life Centre (SLC) Lower Atrium',
      venueName: 'Student Life Centre (SLC)',
      address: '200 University Ave W, Waterloo, ON N2L 3G1',
      isFree: true,
      price: 'Free admission',
      eligibility: 'All Waterloo students',
      registrationUrl: '',
      isResearchStudy: false,
      creatorId: 'wusa_operations',
      status: 'published',
      sourceVerification: 'wusa_official',
      moderationStatus: 'approved',
      createdAt: '2026-10-18T10:00:00Z'
    },
    duplicateCandidate: {
      id: 'cand_wusa_market_sync_02',
      title: 'Campus Fresh Produce Market (SLC)',
      date: '2026-10-28',
      startTime: '11:00',
      location: 'SLC Lower Level Multi-Purpose Room',
      source: 'Student Life Centre Daily Notice Feed'
    },
    similarityScore: 0.89,
    matchReasons: [
      'High keyword & category overlap',
      'Identical campus venue node: Student Life Centre (SLC)',
      'Exact matching start date & time: Oct 28, 11:00'
    ],
    status: 'pending_review',
    detectedAt: '2026-10-24T12:00:01Z'
  }
];

// Verified Student Discounts & Perks (Requirement 8)
// Strictly confirmed partner deals with physical verification requirements (No estimated/unverifiable claims)
export const INITIAL_STUDENT_DISCOUNTS: StudentDiscount[] = [
  {
    id: 'disc_grt_transit',
    businessName: 'Grand River Transit (GRT) & ION Light Rail',
    title: 'Unlimited Term Transit Pass (Included in Student Fees)',
    description: 'Full-time undergraduate students receive unlimited transit across Kitchener, Waterloo, and Cambridge on all GRT express buses and ION rapid light rail trains.',
    discountValue: 'Included in Tuition (100% Transit Pass)',
    category: 'Transit & Travel',
    location: 'UW ION Station & All Regional Transit Stops',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Must present and tap valid physical WatCard with active term fee validation at ION fare readers or bus fareboxes. Strictly non-transferable.',
    validUntil: 'Dec 31, 2026',
    verifiedAt: 'Verified by WUSA Commercial Services',
    sourceUrl: 'https://wusa.ca/services/u-pass'
  },
  {
    id: 'disc_slc_black_goose',
    businessName: 'Black Goose Cafe & SLC Food Outlets',
    title: '15% Off Artisan Beverages & Fresh Meals',
    description: 'Daily student discount on specialty espresso, fair-trade teas, wraps, hot bowls, and fresh bakery goods inside the Student Life Centre.',
    discountValue: '15% Off Total Order',
    category: 'Food & Dining',
    location: 'Student Life Centre (SLC Lower Level & Great Hall)',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Applicable upon physical WatCard presentation at register or when paying with WatCard Flex Dollars.',
    validUntil: 'Aug 31, 2027',
    verifiedAt: 'Verified UW Food Services Contract',
    sourceUrl: 'https://uwaterloo.ca/food-services/locations'
  },
  {
    id: 'disc_princess_cinema',
    businessName: 'The Princess Cinema (Original & Twin)',
    title: '$3 Off Student Movie Admissions',
    description: 'Iconic independent cinema in Uptown Waterloo showcasing indie films, festival favorites, international features, and documentary premieres.',
    discountValue: '$3 Off Admission ($11.50 vs $14.50 regular)',
    category: 'Fitness & Leisure',
    location: '6 Princess St W & 46 King St N, Uptown Waterloo',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Valid physical WatCard required at box office. Cannot be combined with Tuesday discount specials.',
    validUntil: 'Dec 31, 2026',
    verifiedAt: 'Verified Uptown BIA Partner Agreement',
    sourceUrl: 'https://princesscinemas.com'
  },
  {
    id: 'disc_wstore_tech',
    businessName: 'W Store (Campus Bookstore & Tech Shop)',
    title: '10% Off Stationery, Bags & Tech Accessories',
    description: 'Official student savings on notebooks, Apple/PC accessories, chargers, scientific calculators, and Waterloo official merchandise.',
    discountValue: '10% Off Select Supplies',
    category: 'Tech & Supplies',
    location: 'South Campus Hall (SCH) & SLC Concourse',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Excludes required course textbooks and laptop base hardware. Requires active student WatCard or verified @uwaterloo.ca login.',
    validUntil: 'Ongoing Partner Contract',
    verifiedAt: 'Verified UW Retail Operations',
    sourceUrl: 'https://wstore.uwaterloo.ca'
  },
  {
    id: 'disc_sweet_dreams',
    businessName: 'Sweet Dreams Teashop',
    title: '10% Off Bubble Tea & Board Game Lounge',
    description: 'Waterloo student staple in University Plaza serving traditional milk teas, fruit teas, smoothies, and board game social tables.',
    discountValue: '10% Off Drinks with WatCard',
    category: 'Food & Dining',
    location: 'University Plaza, 170 University Ave W, Waterloo',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Show physical WatCard before payment. Valid for in-store orders only.',
    validUntil: 'Dec 31, 2026',
    verifiedAt: 'Verified Student Plaza Merchant',
    sourceUrl: 'https://sweetdreamsteashop.com'
  },
  {
    id: 'disc_grand_river_rocks',
    businessName: 'Grand River Rocks Waterloo',
    title: 'Waterloo Wednesdays: $16 Bouldering Day Pass + Free Rental',
    description: 'Premier bouldering and rock climbing gym close to the university corridor, featuring world-class problems and student fitness sessions.',
    discountValue: '25% Off Day Pass & Free Shoe Rental',
    category: 'Fitness & Leisure',
    location: '50 Borden Ave S, Kitchener-Waterloo (Direct on ION Route)',
    isConfirmedPartner: true,
    verificationProof: 'watcard_physical',
    terms: 'Must present active student ID on Wednesdays. First-time online safety waiver registration required.',
    validUntil: 'Dec 31, 2026',
    verifiedAt: 'Verified Community Partner'
  }
];

export const INITIAL_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'log_01',
    action: '2-Hour Refresh Cycle Completed',
    target: 'System Scheduler',
    performedBy: 'Automated Daemon',
    timestamp: '12m ago',
    details: 'Queried 5 campus feeds. Ingested 100 listings. 0 HTTP errors. Flagged 1 duplicate.'
  },
  {
    id: 'log_02',
    action: 'Verification Audit',
    target: 'WUSA Perks Contract',
    performedBy: 'WUSA Admin',
    timestamp: '2h ago',
    details: 'Verified terms for Black Goose Cafe & GRT Transit U-Pass agreements.'
  }
];

