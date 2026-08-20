export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSessionData {
  id: string;
  title: string;
  actionId: string;
  providerId?: string;
  model: string;
  selectedText: string;
  streamText: string;
  messages: ChatMessageItem[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  actionId: string;
  model: string;
  updatedAt: number;
}
