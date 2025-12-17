/**
 * Core message types for chat functionality
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ConversationHistory {
  role: MessageRole;
  content: string;
}

export interface ChatState {
  messages: Message[];
  inputMessage: string;
  isLoading: boolean;
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
}

export interface TimerState {
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
}

export interface ChatRequestBody {
  sdd_id: string;
  userMessage: string;
  conversationHistory: ConversationHistory[];
}

export interface PSSChatRequestBody {
  sddData: Record<string, unknown>;
  userMessage: string;
  conversationHistory: ConversationHistory[];
}

export interface ChatResponse {
  message: string;
  error?: string;
}

export interface StreamChunk {
  content?: string;
  error?: string;
}
