
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceSettings } from '../types';
import { generateSpeech } from '../services/geminiService';

// Silence timeout in milliseconds. 
// Reduced to 600ms for snappier, more "immediate" feel.
const SILENCE_TIMEOUT_MS = 600;

export const useVoiceAssistant = (
    voiceSettings: VoiceSettings, 
    apiKey: string,
    onInputCompleteRef?: React.MutableRefObject<((text: string) => void) | null>
) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nativeVoices, setNativeVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Ref to track the current interim text to force-submit if silence is detected
  const currentInterimRef = useRef('');
  // Track if we have already triggered complete for the current phrase
  const hasTriggeredCompleteRef = useRef(false);
  // The Silence Timer (The "Speed" Secret)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isManuallyStoppedRef = useRef(false);

  // PIPELINE REFS
  const stopPlaybackRef = useRef(false); // Flag to kill the pipeline
  const isPipelineActiveRef = useRef(false);

  // Load Native Voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const viVoices = voices.filter(v => v.lang.includes('vi'));
      setNativeVoices(viVoices.length > 0 ? viVoices : voices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Manual loop control
      recognition.interimResults = true; // Crucial for silence detection
      recognition.lang = 'vi-VN'; 
      recognition.maxAlternatives = 1;

      // Grammar Injection for Accuracy
      if (SpeechGrammarList) {
        const speechRecognitionList = new SpeechGrammarList();
        const grammar = '#JSGF V1.0; grammar commands; public <command> = ' + 
          'vivi | trợ lý | em ơi | ' + 
          'bật | tắt | mở | đóng | khởi động | dừng | ' + 
          'wifi | mạng | internet | kết nối | ' + 
          'youtube | zalo | facebook | tiktok | google | bản đồ | nhạc | ' + 
          'hẹn giờ | đặt báo thức | đếm ngược | đồng hồ | ' + 
          'một | hai | ba | bốn | năm | sáu | bảy | tám | chín | mười | mười lăm | hai mươi | ba mươi | ' + 
          'giây | phút | giờ | tiếng | ' + 
          'xin chào | tạm biệt | kết thúc | thôi đi ;';
        
        speechRecognitionList.addFromString(grammar, 1);
        recognition.grammars = speechRecognitionList;
      }

      recognition.onstart = () => {
          setIsListening(true);
          hasTriggeredCompleteRef.current = false;
          currentInterimRef.current = '';
          // Audio Cue: Start
          playAudioCue(440, 0.08, 'sine');
      };
      
      recognition.onend = () => {
          setIsListening(false);
          // Always clear timer on end to prevent zombie triggers
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
            console.error("Speech recognition error", event.error);
        }
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // 1. Reset the Silence Timer on EVERY result (sound detected)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        // Update Ref for the timer to access
        currentInterimRef.current = interimTranscript;

        if (finalTranscript) {
             setTranscript(finalTranscript);
             handleFinalResult(finalTranscript, recognition);
        } else {
            // Update UI with streaming text
            setTranscript(interimTranscript);

            // 2. Set new Silence Timer
            // If user stops speaking for SILENCE_TIMEOUT_MS, we assume they are done.
            if (interimTranscript.trim().length > 0 && !hasTriggeredCompleteRef.current) {
                silenceTimerRef.current = setTimeout(() => {
                    // FORCE FINALIZE
                    if (!hasTriggeredCompleteRef.current && currentInterimRef.current) {
                         console.log("🚀 Speed Mode: Silence detected, finalizing immediately.");
                         hasTriggeredCompleteRef.current = true;
                         recognition.stop(); 
                         
                         // Audio Cue: Processing (High pitch)
                         playAudioCue(880, 0.1, 'sine');
                         
                         if (onInputCompleteRef?.current) {
                             onInputCompleteRef.current(currentInterimRef.current);
                         }
                    }
                }, SILENCE_TIMEOUT_MS);
            }
        }
      };

      recognitionRef.current = recognition;
    }
  }, [onInputCompleteRef]);

  // Helper to centralize final result logic
  const handleFinalResult = (text: string, recognitionInstance: any) => {
      if (!hasTriggeredCompleteRef.current) {
            hasTriggeredCompleteRef.current = true;
            recognitionInstance.stop();
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            
            // Audio Cue: Processing
            playAudioCue(880, 0.1, 'sine');

            if (onInputCompleteRef?.current) {
                onInputCompleteRef.current(text);
            }
      }
  };

  const playAudioCue = (freq: number, duration: number, type: OscillatorType = 'sine') => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
  };

  // --- AUDIO DECODING HELPERS ---
  const decodeBase64 = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodePCMAudioData = (data: Uint8Array, ctx: AudioContext): AudioBuffer => {
    const sampleRate = 24000;
    const numChannels = 1;
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  // --- PIPELINE LOGIC ---

  const splitTextIntoSentences = (text: string): string[] => {
    // Regex matches sentences ending in . ! ? or newlines, keeping the delimiter.
    // This is a simple approximation for Vietnamese/English.
    const segments = text.match(/[^.!?\n]+[.!?\n]*/g);
    return segments ? segments.map(s => s.trim()).filter(s => s.length > 0) : [text];
  };

  const playGeminiPipeline = async (sentences: string[], onEnded?: () => void) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      let currentIndex = 0;
      stopPlaybackRef.current = false;
      isPipelineActiveRef.current = true;
      setIsSpeaking(true);

      // Cache for the next audio buffer to ensure seamless playback
      let nextAudioPromise: Promise<string | null> | null = null;

      // Helper to fetch audio safely
      const fetchAudio = (index: number) => {
          if (index >= sentences.length) return Promise.resolve(null);
          return generateSpeech(apiKey, sentences[index], voiceSettings.geminiVoice);
      };

      // Start fetching the first sentence immediately
      let currentAudioPromise = fetchAudio(currentIndex);
      // Start fetching the second one in parallel to minimize gap after first
      nextAudioPromise = fetchAudio(currentIndex + 1);

      const playNextChunk = async () => {
          if (stopPlaybackRef.current || currentIndex >= sentences.length) {
              setIsSpeaking(false);
              isPipelineActiveRef.current = false;
              if (onEnded) onEnded();
              return;
          }

          try {
              const base64Audio = await currentAudioPromise;

              // While we wait/play current, ensure next is fetching
              // If we just consumed the promise for index+1, we need to spin up index+2
              const upcomingIndex = currentIndex + 2;
              const prefetchPromise = fetchAudio(upcomingIndex);

              if (base64Audio && !stopPlaybackRef.current) {
                  const bytes = decodeBase64(base64Audio);
                  const audioBuffer = decodePCMAudioData(bytes, ctx);

                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  audioSourceRef.current = source;

                  source.onended = () => {
                      if (stopPlaybackRef.current) return;
                      // Move to next
                      currentIndex++;
                      // The "next" promise becomes the "current" promise
                      currentAudioPromise = nextAudioPromise!;
                      // The "upcoming" promise becomes the "next" promise
                      nextAudioPromise = prefetchPromise;
                      
                      playNextChunk();
                  };

                  source.start(0);
              } else {
                  // Failed to get audio or stopped, just move next or end
                  if (!stopPlaybackRef.current) {
                       currentIndex++;
                       currentAudioPromise = nextAudioPromise!;
                       nextAudioPromise = prefetchPromise;
                       playNextChunk();
                  }
              }
          } catch (e) {
              console.error("Pipeline error:", e);
              setIsSpeaking(false);
              isPipelineActiveRef.current = false;
              if (onEnded) onEnded();
          }
      };

      // Kickoff
      playNextChunk();
  };

  const startListening = useCallback(() => {
    setTranscript('');
    isManuallyStoppedRef.current = false;
    
    // STOP EVERYTHING
    stopPlaybackRef.current = true;
    synthesisRef.current.cancel();
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    setIsSpeaking(false);

    if (recognitionRef.current) {
      try {
        hasTriggeredCompleteRef.current = false;
        currentInterimRef.current = '';
        setTimeout(() => {
             if (!isManuallyStoppedRef.current) {
                try {
                    recognitionRef.current.start();
                } catch(err) {}
             }
        }, 50); 
      } catch (e) {
        console.warn("Recognition start error", e);
      }
    } else {
      alert("Browser does not support Speech Recognition.");
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    stopPlaybackRef.current = true; // Also stop speaking if user manually stops
    
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    synthesisRef.current.cancel();
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    setIsSpeaking(false);
  }, []);

  const speakNative = useCallback((text: string, onEnded?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    
    if (voiceSettings.nativeVoiceURI) {
      const voice = nativeVoices.find(v => v.voiceURI === voiceSettings.nativeVoiceURI);
      if (voice) utterance.voice = voice;
    }
    utterance.rate = Number(voiceSettings.nativeRate) || 1.0;
    utterance.pitch = Number(voiceSettings.nativePitch) || 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnded) onEnded();
    };
    utterance.onerror = () => {
        setIsSpeaking(false);
        if (onEnded) onEnded();
    };

    synthesisRef.current.speak(utterance);
  }, [voiceSettings, nativeVoices]);

  const speak = useCallback(async (text: string, onEnded?: () => void) => {
    if (!text) {
        if (onEnded) onEnded();
        return;
    }

    // Cancel current audio
    synthesisRef.current.cancel();
    stopPlaybackRef.current = true; // Stop any running pipeline
    
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    setIsSpeaking(false);

    // Give a micro-delay to let audio context reset if needed
    if (voiceSettings.provider === 'gemini' && apiKey) {
        const sentences = splitTextIntoSentences(text);
        if (sentences.length > 0) {
            playGeminiPipeline(sentences, onEnded);
        } else {
            speakNative(text, onEnded);
        }
    } else {
      speakNative(text, onEnded);
    }
  }, [voiceSettings, apiKey, speakNative]);

  return {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    speak,
    isSpeaking,
    nativeVoices
  };
};
