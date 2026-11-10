export interface ApiError {
  readonly status: number;
  readonly message: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly reference: string;
  readonly code?: 'EMAIL_NOT_VERIFIED' | 'EMAIL_ALREADY_VERIFIED' | 'VERIFICATION_CODE_INVALID'
  | 'VERIFICATION_CODE_EXPIRED' | 'VERIFICATION_ATTEMPTS_EXCEEDED' | 'VERIFICATION_SESSION_FAILED';
  readonly verificationToken?: string;
  readonly verificationExpiresIn?: number;
  readonly attemptsRemaining?: number;
  readonly retryAfterSeconds?: number;
}
