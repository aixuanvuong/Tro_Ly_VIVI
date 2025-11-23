
// Global type definition for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    SpeechGrammarList: any;
    webkitSpeechGrammarList: any;
  }
}

export enum Sender {
  USER = 'user',
  BOT = 'bot',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: Date;
}

// History item for AI Context (Short-term memory)
export interface HistoryItem {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// The structured command types returned by Gemini
export enum CommandType {
  CHAT = 'chat',
  OPEN_APP = 'open_app',
  TOGGLE_WIFI = 'toggle_wifi',
  SET_TIMER = 'set_timer',
  UNKNOWN = 'unknown'
}

export interface CommandParams {
  appName?: string;
  wifiStatus?: 'on' | 'off';
  durationSeconds?: number;
  originalQuery?: string;
}

export interface GeminiResponse {
  type: CommandType;
  textResponse: string; // What the bot speaks back
  params?: CommandParams;
}

export interface AppState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  wifiEnabled: boolean;
  activeTimer: number | null; // seconds remaining
}

// Voice Configuration Types
export type VoiceProvider = 'native' | 'gemini';
export const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
export type GeminiVoiceName = typeof GEMINI_VOICES[number];

export interface VoiceSettings {
  provider: VoiceProvider;
  geminiVoice: GeminiVoiceName;
  nativeVoiceURI: string; // URI of the selected native voice
  nativeRate: number; // Speed: 0.5 to 2.0
  nativePitch: number; // Pitch: 0.5 to 2.0
}

// User Profile Types
export type UserGender = 'male' | 'female' | 'other' | '';

export interface UserProfile {
  name: string;
  gender: UserGender;
  customPersonality?: string; // New field for custom AI personality
}

// System Settings Types
export interface SystemSettings {
  geminiApiKey: string;
}
