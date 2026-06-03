export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface StatusFeedback {
  tone: FeedbackTone;
  message: string;
  detail?: string;
}

export type ShowFeedback = (feedback: StatusFeedback) => void;
