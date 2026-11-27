export type PostEventChatAccessMode =
  | 'until_mutual_choice_or_window'
  | 'closed_at_event_end'
  | 'always_open';

export interface BuddyPolicyConfig {
  postEventChatAccess: PostEventChatAccessMode;
  postEventChatWindowHours: number;
  surveyOfferWindowDays: number;
  initialMatchDelayMs: number;
  replacementSearchDelayMs: number;
  simulatedPartnerConfirmDelayMs: number;
  lastMinuteReminderHours: number;
  archiveRetentionDays: number;
  pushDailyCap: number;
}

export const BUDDY_POLICY: BuddyPolicyConfig = {
  postEventChatAccess: 'until_mutual_choice_or_window',
  postEventChatWindowHours: 48,
  surveyOfferWindowDays: 14,
  initialMatchDelayMs: 2000,
  replacementSearchDelayMs: 5000,
  simulatedPartnerConfirmDelayMs: 6000,
  lastMinuteReminderHours: 24,
  archiveRetentionDays: 30,
  pushDailyCap: 2
};
