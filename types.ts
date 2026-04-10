export interface ArchitectureResponse {
  mermaidCode: string;
  sequenceCode: string;
  explanation: string;
  title: string;
}

export interface CodeSnippetResponse {
  code: string;
  language: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  diagramData?: ArchitectureResponse;
  timestamp: number;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: number;
  mermaidCode: string;
}

// Global definition for Mermaid window object and Speech API
declare global {
  interface Window {
    mermaid: any;
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}