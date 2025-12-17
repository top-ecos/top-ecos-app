export interface TokenConsumptionResponse {
  success: boolean;
  tokens_remaining?: number;
  sdd_name?: string;
  message?: string;
  error?: string;
  code?: 'CONCURRENT_UPDATE' | 'INSUFFICIENT_TOKENS' | 'UNAUTHORIZED' | 'SDD_NOT_FOUND';
  requires_upgrade?: boolean;
}

export interface TokenConsumptionRequest {
  sdd_id: string;
}

export enum TokenErrorCode {
  CONCURRENT_UPDATE = 'CONCURRENT_UPDATE',
  INSUFFICIENT_TOKENS = 'INSUFFICIENT_TOKENS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SDD_NOT_FOUND = 'SDD_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class TokenError extends Error {
  constructor(
    message: string,
    public code: TokenErrorCode,
    public tokensRemaining?: number,
    public requiresUpgrade?: boolean
  ) {
    super(message);
    this.name = 'TokenError';
  }
}