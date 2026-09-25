export interface CostEstimateItem {
  component: string;   // e.g. "Managed PostgreSQL"
  monthlyUsd: string;  // e.g. "$15-40"
  note: string;        // one-line driver e.g. "small managed Postgres instance (2 vCPU, 4 GB RAM)"
}

export interface ArchitectureResponse {
  mermaidCode: string;
  sequenceCode: string;
  explanation: string;
  title: string;
  isEdit?: boolean;           // true when this was an incremental edit, not a fresh generation
  critique: string[];         // 2-5 bullet points of real architectural gaps; empty = no gaps
  costEstimate: CostEstimateItem[]; // one entry per billable infra component
  changedNodeIds: string[];   // node IDs added/modified in this edit; empty for fresh generations
  provider?: 'gemini' | 'groq'; // which LLM provider actually answered
}

export interface CodeSnippetResponse {
  code: string;
  language: string;
  description: string;
}

// Accumulated component snippets stored per session for export
export interface GeneratedComponent {
  componentName: string;
  code: string;
  language: string;
  description: string;
}

// A single finding from the design-critique analysis
export interface CritiqueFinding {
  severity: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

// Infrastructure artifact export types
export type ExportFormat = 'docker-compose' | 'terraform' | 'openapi';

export interface InfraExportFile {
  filename: string;
  content: string;
}

export interface InfraExportResponse {
  format: ExportFormat;
  files: InfraExportFile[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'critique';
  content: string;
  diagramData?: ArchitectureResponse;
  critiqueData?: CritiqueFinding[];   // set when role === 'critique'
  exportTag?: ExportFormat;           // set after a successful infra export
  timestamp: number;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
  generatedComponents?: GeneratedComponent[]; // accumulated for export
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