export type EventCategory =
  | 'Arts and culture'
  | 'Technology'
  | 'Career and networking'
  | 'Sports and recreation'
  | 'Social events'
  | 'Volunteering'
  | 'Academic workshops'
  | 'Research participation';

export type OrganizerType =
  | 'Clubs'
  | 'Student societies'
  | 'WUSA'
  | 'Faculties'
  | 'Research studies';

export type UWFaculty =
  | 'Engineering'
  | 'Mathematics'
  | 'Science'
  | 'Arts'
  | 'Environment'
  | 'Health';

export type SocialEnergy = 'introvert' | 'ambivert' | 'extrovert';
export type SocialEnvironment =
  | 'cozy_relaxed'
  | 'interactive_workshop'
  | 'lively_vibrant'
  | 'active_movement';
export type GroupSizePreference = 'duo' | 'small_pod' | 'larger_group' | 'flexible';

export type SocialBatteryTag =
  | 'Hyped & Chatty'
  | 'Chill & Observing'
  | 'Strictly Networking'
  | "Just don't want to walk alone";

export type BuddyPreferenceTag =
  | 'Women only'
  | 'Men only'
  | 'Group match (3–4 people)'
  | 'Same faculty'
  | 'Outside my faculty'
  | 'Same year'
  | 'Alcohol-free hangouts'
  | 'Strictly platonic'
  | 'Study-focused'
  | 'Punctual / No flakes'
  | 'Lives on campus'
  | 'Commuter-friendly';

export interface BuddyQuizAnswers {
  q1: 'A' | 'B';
  q2: 'A' | 'B';
  q3: 'A' | 'B' | 'C';
  q4: 'A' | 'B' | 'C';
  q5: 'A' | 'B';
  q6: 'A' | 'B';
  q7: 'A' | 'B';
  q8: 'A' | 'B';
}

export interface BuddyArchetype {
  id: string;
  title: string;
  emoji: string;
  summary: string;
}

export interface PersonalityQuizProfile {
  completed: boolean;
  answers?: BuddyQuizAnswers;
  preferenceBubbles?: BuddyPreferenceTag[];
  archetype?: BuddyArchetype;
  // Legacy optional fields retained for safe migration from older stored state
  socialEnergy?: SocialEnergy;
  socialEnvironment?: SocialEnvironment;
  hobbies?: string[];
  groupSize?: GroupSizePreference;
  experienceTypes?: string[];
  updatedAt?: string;
}

export interface CompatibilityMatch {
  score: number; // 0 to 100 percentage
  overallVibe: string;
  reasons: string[];
  sharedHobbies: string[];
  sharedExperienceTypes: string[];
  socialEnergyAlignment: string;
  environmentAlignment: string;
  groupAlignment: string;
  icebreakerPill: string;
  icebreakerBanner: string;
  icebreakerQuestion: string;
  quizScore: number;
  batteryScore: number;
  preferenceScore: number;
  filteredOut?: boolean;
  filteredOutReason?: string;
}

export type SavedFilterType = 'category' | 'faculty' | 'location' | 'price';

export interface EventFilterTag {
  type: SavedFilterType;
  value: string;
  label: string;
}

export interface UserPreferences {
  categories: EventCategory[];
  noPreferences: boolean;
  preferredFaculties: string[];
  preferredYears: string[];
}

export type NotificationInterestCategory =
  | 'Sports and fitness'
  | 'Nightlife and entertainment'
  | 'Food and student deals'
  | 'Networking and professional development'
  | 'Cultural and religious gatherings'
  | 'University clubs'
  | 'Volunteering and community activities'
  | 'Arts and music';

export interface NotificationTypePreferences {
  newEvents: boolean; // Newly discovered events matching interests
  upcomingRsvp: boolean; // Upcoming events they have saved or RSVP'd to (reminders)
  buddyMatches: boolean; // Buddy-match requests and messages
  registrationDeadlines: boolean; // Registration deadlines approaching
  eventChanges: boolean; // Event cancellations and schedule changes
  studentDiscounts: boolean; // Newly available student discounts
}

export type NotificationFrequency = 'instant' | 'daily_digest' | 'low_noise';

export interface NotificationSettings {
  interestedCategories: NotificationInterestCategory[];
  types: NotificationTypePreferences;
  frequency: NotificationFrequency;
  quietHoursEnabled: boolean; // e.g. 11:00 PM – 8:00 AM
  avoidOverwhelming: boolean; // Caps non-urgent notifications to max 2/day
}

export type NotificationItemType =
  | 'new_event'
  | 'upcoming_reminder'
  | 'buddy_match'
  | 'registration_deadline'
  | 'schedule_change'
  | 'student_discount';

export interface InAppNotification {
  id: string;
  type: NotificationItemType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  eventId?: string;
  eventTitle?: string;
  category?: NotificationInterestCategory;
  actionUrl?: string;
  actionLabel?: string;
  discountDeal?: string;
  urgent?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  school: string; // "University of Waterloo"
  faculty: string;
  program: string;
  year: string;
  bio: string;
  dob: string; // Marked strictly private, never exposed to other attendees
  email: string; // Demo email, private
  isVerifiedUWStudent: boolean; // Institutional University of Waterloo verification
  uwEmail?: string;
  onboarded: boolean;
  preferences: UserPreferences;
  personalityQuiz?: PersonalityQuizProfile;
  notificationSettings?: NotificationSettings;
}

export interface EventItem {
  id: string;
  title: string;
  coverImage: string;
  organizer: string;
  organizerType: OrganizerType;
  isOrganizationAccount?: boolean; // Distinguish organization vs individual student organizer
  category: EventCategory;
  facultyAffiliation?: string;
  description: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // Optional YYYY-MM-DD for multi-day events
  recurringDates?: string[]; // Optional confirmed YYYY-MM-DD occurrences
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  isOnline: boolean;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  venueName?: string;
  address?: string;
  roomNumber?: string;
  arrivalInstructions?: string;
  isFree: boolean;
  price: string;
  eligibility: string;
  registrationUrl: string;
  registrationDeadline?: string;
  accessibility?: string;
  isResearchStudy: boolean; // If true: attendee matching is strictly disabled & no public attendee list
  creatorId: string;
  status: 'published' | 'draft' | 'cancelled' | 'ended';
  sourceVerification?: 'wusa_official' | 'faculty_verified' | 'community_partner' | 'student_submitted' | 'unverified';
  moderationStatus?: 'approved' | 'flagged' | 'pending_review' | 'rejected';
  isExternalConfirmedTicket?: boolean; // Avoids presenting unverified tickets as confirmed
  utcIsoString?: string; // Standardized UTC ISO-8601 storage
  endUtcIso?: string;
  createdAt: string;
  _wusaMeta?: {
    sourceEventId?: string;
    canonicalUrl?: string;
    temporalStatus?: string;
    isRecurring?: boolean;
    seriesId?: string | null;
    reviewFlags?: string[];
  };
}

export interface AttendeeTraits {
  alcoholFree?: boolean;
  strictlyPlatonic?: boolean;
  studyFocused?: boolean;
  punctual?: boolean;
  livesOnCampus?: boolean;
  commuterFriendly?: boolean;
  prefersGroup?: boolean;
}

export interface AttendeeProfile {
  id: string;
  name: string; // First name and last initial only (e.g. "Maya P.")
  avatar: string;
  faculty?: string;
  program?: string;
  year?: string;
  bio?: string;
  gender?: 'woman' | 'man' | 'non_binary';
  traits?: AttendeeTraits;
  defaultSocialBattery?: SocialBatteryTag;
  eventSocialBatteries?: Record<string, SocialBatteryTag>;
  showFaculty?: boolean;
  showYear?: boolean;
  isVerifiedUWStudent: boolean;
  personalityQuiz?: PersonalityQuizProfile;
}

export interface ConnectionRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderFaculty?: string;
  senderProgram?: string;
  senderYear?: string;
  recipientId: string;
  recipientName: string;
  introMessage?: string;
  compatibilityScore?: number;
  compatibilityReasons?: string[];
  icebreakerPill?: string;
  icebreakerBanner?: string;
  icebreakerQuestion?: string;
  socialBattery?: SocialBatteryTag;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export type RemovedChatReason = 'left' | 'blocked' | 'reported';

export interface RemovedChatRecord {
  partnerId: string;
  eventId: string | null;
  reason: RemovedChatReason;
  removedAt: string;
}

export interface Conversation {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  partner: AttendeeProfile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isReported?: boolean;
  stayConnectedUser?: boolean; // User choice post-event
  stayConnectedPartner?: boolean; // Partner choice post-event
  isChatClosedPostEvent?: boolean; // Closed if 48h passed without mutual choice
  icebreakerPill?: string;
  icebreakerBanner?: string;
  icebreakerQuestion?: string;
  socialBattery?: SocialBatteryTag;
}

export interface ReportSubmission {
  id: string;
  targetType: 'user' | 'event';
  targetId: string;
  targetName: string;
  reason: string;
  description?: string;
  timestamp: string;
  status: 'pending' | 'resolved_warning' | 'resolved_removed' | 'dismissed';
  moderatorNotes?: string;
}

export interface AggregationSource {
  id: string;
  name: string;
  organization: string;
  type: 'rss' | 'api' | 'ical' | 'partner_webhook';
  endpointUrl: string;
  categoryDefault: string;
  lastSyncTime: string;
  status: 'healthy' | 'degraded' | 'rate_limited' | 'error';
  httpStatus: number;
  latencyMs: number;
  eventsIngested: number;
  lastErrorMessage?: string;
  isUniversityOfficial: boolean;
}

export interface DuplicateDetectionResult {
  id: string;
  primaryEvent: EventItem;
  duplicateCandidate: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    location: string;
    source: string;
  };
  similarityScore: number; // 0.0 - 1.0
  matchReasons: string[];
  status: 'pending_review' | 'merged' | 'rejected_as_duplicate';
  detectedAt: string;
}

export interface SyncCycleReport {
  id: string;
  cycleStartedAt: string;
  cycleCompletedAt: string;
  durationMs: number;
  sourcesQueried: number;
  eventsIngested: number;
  duplicatesFlagged: number;
  errorsCaught: number;
  nextScheduledRefresh: string; // 2-hour refresh interval
}

export interface StudentDiscount {
  id: string;
  businessName: string;
  title: string;
  description: string;
  discountValue: string;
  category: 'Food & Dining' | 'Transit & Travel' | 'Tech & Supplies' | 'Fitness & Leisure';
  location: string;
  isConfirmedPartner: boolean; // Confirmed vs estimated/unverifiable
  verificationProof: 'watcard_physical' | 'wusa_perk_portal' | 'student_email_code';
  terms: string;
  validUntil: string;
  verifiedAt: string;
  sourceUrl?: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  target: string;
  performedBy: string;
  timestamp: string;
  details: string;
}
