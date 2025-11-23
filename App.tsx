
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Message, 
  Sender, 
  CommandType, 
  GeminiResponse, 
  AppState,
  VoiceSettings,
  GEMINI_VOICES,
  GeminiVoiceName,
  UserProfile,
  SystemSettings,
  HistoryItem
} from './types';
import { processQuery, validateGeminiApiKey } from './services/geminiService';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import ViViFace from './components/ViViFace';

// Initial system state simulation
const INITIAL_STATE: AppState = {
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  wifiEnabled: true,
  activeTimer: null,
};

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  provider: 'native',
  geminiVoice: 'Kore',
  nativeVoiceURI: '',
  nativeRate: 1.0,
  nativePitch: 1.0
};

const DEFAULT_USER_PROFILE: UserProfile = {
  name: '',
  gender: '',
  customPersonality: ''
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  geminiApiKey: ''
};

const STORAGE_KEY_VOICE = 'VIVI_VOICE_SETTINGS';
const STORAGE_KEY_USER = 'VIVI_USER_PROFILE';
const STORAGE_KEY_SYSTEM = 'VIVI_SYSTEM_SETTINGS';
const STORAGE_KEY_WELCOME = 'VIVI_HAS_SEEN_WELCOME';

// 20,000 Characters Limit for Context Memory
const MAX_CONTEXT_CHARS = 20000;

type SettingsTab = 'user' | 'voice' | 'system' | 'about';

const App: React.FC = () => {
  // Application Logic State
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConversationActive, setIsConversationActive] = useState(false);
  
  // CLOCK STATE
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // CONTEXT MEMORY STATE (For Custom Key Only)
  const [chatContext, setChatContext] = useState<HistoryItem[]>([]);
  
  // Use a Ref to track conversation state inside callbacks to avoid stale closures
  const conversationActiveRef = useRef(false);

  // --- PERSISTENT SETTINGS STATE ---

  // 1. Voice Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOICE);
      if (saved) return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { console.error(e); }
    return DEFAULT_VOICE_SETTINGS;
  });

  // 2. User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return { ...DEFAULT_USER_PROFILE, ...JSON.parse(saved) };
    } catch (e) { console.error(e); }
    return DEFAULT_USER_PROFILE;
  });

  // 3. System Settings (API Key)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SYSTEM);
      if (saved) return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { console.error(e); }
    return DEFAULT_SYSTEM_SETTINGS;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('voice');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // UI States for Save/Validation
  const [showToast, setShowToast] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // --- CRITICAL LOGIC: API KEY PRIORITY ---
  const effectiveApiKey = (systemSettings.geminiApiKey && systemSettings.geminiApiKey.trim().length > 0)
      ? systemSettings.geminiApiKey.trim() 
      : (process.env.API_KEY || '');

  const isUsingCustomKey = systemSettings.geminiApiKey && systemSettings.geminiApiKey.trim().length > 0;

  // Callback Ref for the Voice Hook
  const onInputCompleteRef = useRef<((text: string) => void) | null>(null);

  // Voice Hooks
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    speak, 
    isSpeaking,
    setTranscript,
    nativeVoices
  } = useVoiceAssistant(voiceSettings, effectiveApiKey, onInputCompleteRef);

  // Check for First Time Visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(STORAGE_KEY_WELCOME);
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, []);

  // CLOCK EFFECT
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcceptWelcome = () => {
    localStorage.setItem(STORAGE_KEY_WELCOME, 'true');
    setShowWelcomeModal(false);
    // Automatically open settings to System tab to guide user to enter API Key
    setSettingsTab('system');
    setShowSettings(true);
  };

  // Manual Save Handler for ALL Settings
  const handleSaveSettings = async () => {
    // 1. If currently in System Tab and a key is provided, VALIDATE first
    if (settingsTab === 'system' && systemSettings.geminiApiKey.trim().length > 0) {
        setIsValidating(true);
        const isValid = await validateGeminiApiKey(systemSettings.geminiApiKey.trim());
        setIsValidating(false);

        if (!isValid) {
            setShowToast({ type: 'error', message: 'Kết nối thất bại! API Key không hợp lệ.' });
            setTimeout(() => setShowToast(null), 3000);
            return; // STOP SAVE
        } else {
             setShowToast({ type: 'success', message: 'Kết nối thành công!' });
        }
    } else {
        setShowToast({ type: 'success', message: 'Đã lưu cài đặt thành công!' });
    }

    // 2. Save Logic
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(voiceSettings));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
      localStorage.setItem(STORAGE_KEY_SYSTEM, JSON.stringify(systemSettings));
      setTimeout(() => setShowToast(null), 2000);
    } catch (error) {
      console.error("Failed to save settings", error);
      setShowToast({ type: 'error', message: 'Lỗi khi lưu vào bộ nhớ máy!' });
    }
  };

  // Sync listening state
  useEffect(() => {
    setState(prev => ({ ...prev, isListening, isSpeaking }));
  }, [isListening, isSpeaking]);

  // Timer countdown effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state.activeTimer !== null && state.activeTimer > 0) {
      interval = setInterval(() => {
        setState(prev => {
          if (prev.activeTimer === null || prev.activeTimer <= 0) return prev;
          const newVal = prev.activeTimer - 1;
          if (newVal === 0) {
            speak("Hết giờ hẹn!", () => {
                 if (conversationActiveRef.current) startListening();
            });
          }
          return { ...prev, activeTimer: newVal };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.activeTimer, speak, startListening]);

  // --- Logic Handlers ---

  const executeCommand = (res: GeminiResponse) => {
    const { type, params } = res;
    switch (type) {
      case CommandType.TOGGLE_WIFI:
        const shouldEnable = params?.wifiStatus === 'on';
        setState(prev => ({ ...prev, wifiEnabled: shouldEnable }));
        break;
      case CommandType.SET_TIMER:
        const duration = params?.durationSeconds || 0;
        if (duration > 0) {
          setState(prev => ({ ...prev, activeTimer: duration }));
        }
        break;
      default:
        break;
    }
  };

  // HELPER: Manage Context Size
  const pruneContext = (history: HistoryItem[]): HistoryItem[] => {
      let currentLength = history.reduce((acc, item) => acc + (item.parts[0]?.text?.length || 0), 0);
      const newHistory = [...history];

      // Remove oldest messages (from the top) until within limit
      while (currentLength > MAX_CONTEXT_CHARS && newHistory.length > 0) {
          const removed = newHistory.shift();
          if (removed) {
              currentLength -= (removed.parts[0]?.text?.length || 0);
          }
      }
      return newHistory;
  };

  // MAIN LOGIC: Process the user's voice input
  const handleUserVoiceEnd = useCallback(async (text: string) => {
    if (!text.trim()) return;

    stopListening();

    // 1. Check for "Exit" keywords
    const exitKeywords = /(tạm biệt|goodbye|kết thúc|dừng lại|thôi đi)/i;
    if (exitKeywords.test(text)) {
        setIsConversationActive(false);
        conversationActiveRef.current = false;
        
        const userMsg: Message = {
            id: Date.now().toString(),
            sender: Sender.USER,
            text: text,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        
        speak("Tạm biệt bạn! Hẹn gặp lại.", () => {
             // Do NOT restart listening
        });
        return;
    }

    // 2. Standard Processing
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    setState(prev => ({ ...prev, isProcessing: true }));

    // --- CONTEXT PREPARATION ---
    let historyToSend: HistoryItem[] = [];
    
    if (isUsingCustomKey) {
        // Use accumulated context
        historyToSend = chatContext; 
    } else {
        // Clear context for default key (Stateless)
        historyToSend = []; 
    }

    // Call Gemini
    const response: GeminiResponse = await processQuery(
      effectiveApiKey, 
      text,
      userProfile,
      isUsingCustomKey, // enableSearch
      historyToSend // Pass the history
    );

    setState(prev => ({ ...prev, isProcessing: false }));

    // Process Response
    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: Sender.BOT,
      text: response.textResponse,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMsg]);
    
    // --- CONTEXT UPDATE ---
    if (isUsingCustomKey) {
        setChatContext(prev => {
            // Append current turn
            const newTurn: HistoryItem[] = [
                { role: 'user', parts: [{ text: text }] },
                { role: 'model', parts: [{ text: response.textResponse }] }
            ];
            const updated = [...prev, ...newTurn];
            // Prune if > 20k chars
            return pruneContext(updated);
        });
    }

    executeCommand(response);
    
    // 3. Speak Response & Loop
    speak(response.textResponse, () => {
        if (conversationActiveRef.current) {
            setTimeout(() => {
                if (conversationActiveRef.current) {
                    startListening();
                }
            }, 200);
        }
    });
  }, [userProfile, effectiveApiKey, isUsingCustomKey, chatContext, speak, startListening, stopListening]);

  // Keep the Ref updated
  useEffect(() => {
    onInputCompleteRef.current = handleUserVoiceEnd;
  }, [handleUserVoiceEnd]);

  // Toggle Conversation Mode
  const toggleConversation = () => {
    if (isConversationActive) {
        setIsConversationActive(false);
        conversationActiveRef.current = false;
        stopListening();
    } else {
        setIsConversationActive(true);
        conversationActiveRef.current = true;
        startListening();
    }
  };

  // --- Render Helpers ---

  const getVisualizerState = () => {
    if (state.isProcessing) return 'processing';
    if (state.isListening) return 'listening';
    if (state.isSpeaking) return 'speaking';
    return 'idle';
  };

  const lastBotMessage = messages.filter(m => m.sender === Sender.BOT).pop()?.text;
  const lastUserMessage = messages.filter(m => m.sender === Sender.USER).pop()?.text;

  const currentSubtitle = state.isSpeaking 
    ? lastBotMessage 
    : (isListening || state.isProcessing ? (transcript || lastUserMessage) : lastBotMessage);

  // FORMAT TIME
  const timeString = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateString = currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    // Use h-[100dvh] for mobile viewport fix. 
    <div className="h-[100dvh] w-full bg-black text-slate-100 flex flex-col relative overflow-hidden font-sans">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in zoom-in duration-300 w-max max-w-[90%] text-center">
          <div className={`px-6 py-3 rounded-full shadow-lg flex items-center justify-center gap-2 text-sm font-medium border ${
            showToast.type === 'success' 
            ? 'bg-emerald-500 text-white border-emerald-400' 
            : 'bg-red-500 text-white border-red-400'
          }`}>
            {showToast.message}
          </div>
        </div>
      )}

      {/* CLOCK DISPLAY (Top Left) */}
      <div className="absolute top-4 left-6 z-40 flex flex-col items-start pointer-events-none opacity-80">
          <div className="text-4xl sm:text-5xl font-light tracking-tight text-white font-mono drop-shadow-lg">
              {timeString}
          </div>
          <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wide mt-1 drop-shadow-md">
              {dateString}
          </div>
      </div>

      {/* Settings Button (Top Right) */}
      <div className="absolute top-4 right-4 z-50">
          <button 
              onClick={() => setShowSettings(true)}
              className="p-3 text-slate-600 hover:text-white transition-colors rounded-full hover:bg-slate-800/50 bg-black/20 backdrop-blur-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
      </div>

      {/* Main Content Area - Optimized for Mobile/Landscape */}
      {/* Portrait: Flex Col (Face Top, Text Bottom) */}
      {/* Landscape: Flex Row (Face Left, Text Right) */}
      {/* NEW LAYOUT: Using justify-between to keep face and text apart, no overlap */}
      <div className="flex-1 flex flex-col landscape:flex-row items-center justify-between landscape:justify-around relative p-4 gap-4 landscape:gap-12 h-full overflow-hidden">
        
        {/* FACE AREA - Takes remaining space in portrait to center vertically, or specific space */}
        <div 
          onClick={toggleConversation}
          className="flex-1 flex items-center justify-center w-full landscape:w-auto cursor-pointer z-10 mt-8 landscape:mt-0"
        >
          <div className="transform hover:scale-105 active:scale-95 transition-transform duration-300">
            <ViViFace state={getVisualizerState()} />
          </div>
        </div>

        {/* Start/Stop Hint (Only show if inactive) */}
        {!isConversationActive && (
          <div className="absolute bottom-1/4 text-slate-500 text-xs sm:text-sm animate-pulse pointer-events-none z-0">
            Chạm vào khuôn mặt để bắt đầu
          </div>
        )}

        {/* SUBTITLE AREA - Natural flow in portrait, Right side in landscape */}
        <div className={`
            transition-opacity duration-500 z-20
            ${isConversationActive || currentSubtitle ? 'opacity-100' : 'opacity-0'}
            w-full landscape:w-1/2 
            flex items-end justify-center landscape:items-center
            pb-4 landscape:pb-0
            pointer-events-none
            shrink-0
        `}>
           {/* Content Box with Max Height & Scroll */}
           <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl w-full max-w-lg text-center border border-white/10 shadow-2xl max-h-[35dvh] landscape:max-h-[80dvh] overflow-y-auto custom-scrollbar pointer-events-auto">
              {state.isProcessing ? (
                  <div className="flex items-center gap-2 justify-center text-slate-300 h-8">
                     <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></span>
                     <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></span>
                  </div>
              ) : (
                  <p className={`text-lg sm:text-xl font-medium leading-relaxed ${
                      isSpeaking ? 'text-pink-200' : 'text-emerald-200'
                  }`}>
                    {currentSubtitle || "..."}
                  </p>
              )}
           </div>
        </div>

      </div>

      {/* WELCOME / TERMS OF SERVICE MODAL */}
      {showWelcomeModal && (
        <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85dvh] flex flex-col shadow-2xl">
             {/* Modal Header */}
             <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl shrink-0">
                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg shrink-0">
                     <span className="text-white font-bold text-xl">V</span>
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        Siêu trợ lý ViVi
                     </h2>
                     <p className="text-xs text-slate-500">Trợ lý ảo miễn phí & thông minh</p>
                 </div>
             </div>

             {/* Modal Content (Scrollable) */}
             <div className="p-6 overflow-y-auto text-slate-300 space-y-6 text-sm leading-relaxed custom-scrollbar">
                 
                 {/* Important Notice */}
                 <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl">
                     <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                        </svg>
                        Lưu ý quan trọng
                     </h3>
                     <p>
                        Đây là ứng dụng hoàn toàn miễn phí. Tuy nhiên, để kích hoạt các tính năng thông minh (Chat, Tìm kiếm, Giọng nói AI), bạn cần truy cập phần <b>Cài đặt &gt; Hệ thống</b> để nhập <b>Gemini API Key</b> của riêng bạn.
                     </p>
                 </div>

                 {/* TOS Content */}
                 <div className="space-y-4">
                     <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                         ⭐ ĐIỀU KHOẢN NGƯỜI DÙNG – TRỢ LÝ ViVi
                     </h3>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">1. Giới thiệu</h4>
                         <p>Điều khoản này quy định cách thức người dùng sử dụng ViVi. Việc sử dụng ViVi đồng nghĩa với việc bạn chấp nhận toàn bộ điều khoản dưới đây.</p>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">2. Quyền sử dụng</h4>
                         <ul className="list-disc pl-5 space-y-1 opacity-80">
                             <li><b>Được phép:</b> Sử dụng để đặt câu hỏi, tìm thông tin, sáng tạo nội dung, hỗ trợ kỹ thuật.</li>
                             <li><b>Không được phép:</b> Lợi dụng ViVi để vi phạm pháp luật, lừa đảo, tạo mã độc, hoặc lan truyền thông tin sai lệch.</li>
                         </ul>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">3. Quyền riêng tư & Dữ liệu</h4>
                         <p>ViVi tôn trọng quyền riêng tư và không tự ý chia sẻ dữ liệu. Bạn chịu trách nhiệm về nội dung mình gửi lên. Không nên gửi thông tin mật hoặc nhạy cảm.</p>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">4. Nội dung được tạo bởi ViVi</h4>
                         <p>Nội dung mang tính hỗ trợ và tham khảo. Người dùng tự chịu trách nhiệm khi áp dụng vào thực tế (pháp lý, y tế, tài chính...).</p>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">5. Hành vi bị cấm</h4>
                         <ul className="list-disc pl-5 space-y-1 opacity-80">
                             <li>Vi phạm pháp luật, hack, chiếm quyền.</li>
                             <li>Tạo nội dung bạo lực, thù hận, khiêu dâm.</li>
                             <li>Ép buộc ViVi thực hiện nhiệm vụ trái nguyên tắc vận hành.</li>
                         </ul>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">6. Giới hạn trách nhiệm</h4>
                         <p>ViVi không chịu trách nhiệm về thiệt hại phát sinh từ việc sử dụng nội dung. ViVi không bảo đảm độ chính xác tuyệt đối 100%.</p>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">7. Cập nhật điều khoản</h4>
                         <p>Điều khoản có thể được cập nhật. Việc tiếp tục sử dụng đồng nghĩa với sự chấp thuận.</p>
                     </section>

                     <section>
                         <h4 className="font-bold text-emerald-400 mb-1">8. Quyền chấm dứt</h4>
                         <p>Chúng tôi có quyền ngưng phục vụ nếu bạn vi phạm nghiêm trọng các điều khoản trên.</p>
                     </section>

                     <div className="pt-4 border-t border-slate-800 mt-4">
                        <h4 className="font-bold text-white mb-2">9. Liên hệ & Hỗ trợ</h4>
                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                            <p>Email: <a href="mailto:chuongxuanvuong@gmail.com" className="text-blue-400 hover:underline">chuongxuanvuong@gmail.com</a></p>
                            <p>Facebook: <a href="https://www.facebook.com/xuanvuongtv" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">https://www.facebook.com/xuanvuongtv</a></p>
                        </div>
                     </div>
                 </div>
             </div>

             {/* Modal Footer */}
             <div className="p-6 border-t border-slate-800 bg-slate-900 rounded-b-2xl shrink-0">
                 <button 
                    onClick={handleAcceptWelcome}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-lg shadow-lg transform hover:scale-[1.02] transition-all"
                 >
                    Tôi đồng ý & Bắt đầu
                 </button>
                 <p className="text-center text-[10px] text-slate-600 mt-3">
                    Bằng việc nhấn nút trên, bạn xác nhận đã đọc và đồng ý với điều khoản sử dụng.
                 </p>
             </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in duration-200 h-[100dvh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm shrink-0">
             <h2 className="text-lg font-semibold text-white tracking-wide">Cài đặt</h2>
             <button onClick={() => setShowSettings(false)} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full hover:bg-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
          </div>

          {/* Body - Optimized Navigation for Mobile */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden text-left">
            
            {/* Sidebar / Tab Bar */}
            {/* Mobile: Horizontal scrollable top bar. Desktop: Vertical sidebar */}
            <div className="
                w-full md:w-48 
                bg-slate-800/30 border-b md:border-b-0 md:border-r border-slate-700 
                flex flex-row md:flex-col 
                overflow-x-auto md:overflow-visible
                p-2 gap-2 shrink-0
            ">
                <button 
                  onClick={() => setSettingsTab('user')}
                  className={`p-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                    settingsTab === 'user' ? 'bg-pink-500/20 text-pink-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                  </svg>
                  <span className="md:hidden lg:block font-medium text-sm">Người dùng</span>
                </button>

                <button 
                  onClick={() => setSettingsTab('voice')}
                  className={`p-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                    settingsTab === 'voice' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 2.75 2.75 0 010-3.893.75.75 0 011.06-1.06c.46.46.46 1.205 0 1.665a4.25 4.25 0 000-6.01.75.75 0 01-1.06-1.06z" />
                    <path d="M16.463 8.288a.75.75 0 011.06 0 5.25 5.25 0 010 7.424.75.75 0 01-1.06-1.06 3.75 3.75 0 000-5.304.75.75 0 010-1.06z" />
                  </svg>
                  <span className="md:hidden lg:block font-medium text-sm">Giọng nói</span>
                </button>

                <button 
                  onClick={() => setSettingsTab('system')}
                  className={`p-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                    settingsTab === 'system' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0">
                     <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.608 7.45 7.45 0 00-.478.198.798.798 0 01-.796-.064l-.453-.324a1.875 1.875 0 00-2.416.2l-.043.044a1.875 1.875 0 00-.205 2.415l.323.452a.798.798 0 01.064.796 7.448 7.448 0 00-.198.478.798.798 0 01-.608.517l-.55.092a1.875 1.875 0 00-1.566 1.849v.044c0 .917.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 01-.064.796l-.324.453a1.875 1.875 0 00.2 2.416l.044.043a1.875 1.875 0 002.415.205l.452-.323a.798.798 0 01.796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.044c.917 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.608c.162-.06.321-.127.478-.198a.798.798 0 01.796.064l.453.324a1.875 1.875 0 002.416-.2l.043-.044a1.875 1.875 0 00.205-2.415l-.323-.452a.798.798 0 01-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.092a1.875 1.875 0 001.566-1.849v-.044c0-.917-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 01-.608-.517 7.407 7.407 0 00-.198-.478.798.798 0 01.064-.796l.324-.453a1.875 1.875 0 00-.2-2.416l-.044-.043a1.875 1.875 0 00-2.415-.205l-.452.323a.798.798 0 01-.796.064 7.462 7.462 0 00-.478-.198.798.798 0 01-.517-.608l-.092-.55a1.875 1.875 0 00-1.849-1.566h-.044zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                  </svg>
                  <span className="md:hidden lg:block font-medium text-sm">Hệ thống</span>
                </button>

                <button 
                  onClick={() => setSettingsTab('about')}
                  className={`p-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                    settingsTab === 'about' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                  </svg>
                  <span className="md:hidden lg:block font-medium text-sm">Giới thiệu</span>
                </button>

            </div>

            {/* Content Area - Use text-base to prevent iOS Zoom */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              
              {/* USER PROFILE TAB */}
              {settingsTab === 'user' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                  <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2">
                          Hồ sơ người dùng
                      </h3>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Name Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                        Tên của bạn
                      </label>
                      <input 
                        type="text"
                        value={userProfile.name}
                        onChange={(e) => setUserProfile(p => ({...p, name: e.target.value}))}
                        placeholder="Nhập tên để trợ lý gọi..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-base text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                      />
                    </div>

                    {/* Gender Selection */}
                    <div className="space-y-3">
                       <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                        Giới tính
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                         <button 
                           onClick={() => setUserProfile(p => ({...p, gender: 'male'}))}
                           className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                             userProfile.gender === 'male'
                             ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                             : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                           }`}
                         >
                            <span className="text-base font-bold">Nam</span>
                            <span className="text-xs opacity-70">"Anh"</span>
                         </button>
                         
                         <button 
                           onClick={() => setUserProfile(p => ({...p, gender: 'female'}))}
                           className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                             userProfile.gender === 'female'
                             ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                             : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                           }`}
                         >
                            <span className="text-base font-bold">Nữ</span>
                            <span className="text-xs opacity-70">"Chị"</span>
                         </button>

                         <button 
                           onClick={() => setUserProfile(p => ({...p, gender: 'other'}))}
                           className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                             userProfile.gender === 'other'
                             ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                             : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                           }`}
                         >
                            <span className="text-base font-bold">Khác</span>
                            <span className="text-xs opacity-70">"Bạn"</span>
                         </button>
                      </div>
                    </div>

                    {/* Custom Personality Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                        Tùy biến tính cách ViVi
                      </label>
                      <textarea 
                        value={userProfile.customPersonality || ''}
                        onChange={(e) => setUserProfile(p => ({...p, customPersonality: e.target.value}))}
                        placeholder="Ví dụ: Hãy hài hước, hơi châm biếm một chút. Hoặc: Hãy dịu dàng như người yêu..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-base text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all resize-none"
                      />
                      <div className="text-[10px] text-slate-500 italic">
                         ViVi sẽ cố gắng thay đổi thái độ và giọng điệu dựa trên mô tả của bạn.
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                          onClick={handleSaveSettings}
                          className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transform hover:scale-[1.02]"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                           </svg>
                           Lưu hồ sơ
                        </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VOICE TAB */}
              {settingsTab === 'voice' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                          Cấu hình Giọng nói
                      </h3>
                    </div>

                    {/* Voice Provider Section */}
                    <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Bộ máy giọng nói</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                        onClick={() => setVoiceSettings(s => ({ ...s, provider: 'native' }))}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            voiceSettings.provider === 'native' 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                        >
                        <div className="font-bold mb-1">Native (Hệ thống)</div>
                        <div className="text-xs opacity-80">Nhanh, offline, hơi máy móc.</div>
                        </button>
                        <button 
                        onClick={() => setVoiceSettings(s => ({ ...s, provider: 'gemini' }))}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            voiceSettings.provider === 'gemini' 
                            ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                        >
                        <div className="font-bold mb-1">Gemini AI</div>
                        <div className="text-xs opacity-80">Tự nhiên, cần internet & API.</div>
                        </button>
                    </div>
                    </div>

                    {/* Voice Selection Section */}
                    <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Người đọc (Persona)</label>
                    
                    {voiceSettings.provider === 'native' ? (
                        <div className="space-y-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <select 
                            value={voiceSettings.nativeVoiceURI}
                            onChange={(e) => setVoiceSettings(s => ({ ...s, nativeVoiceURI: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-base text-white outline-none focus:border-emerald-500 transition-colors"
                        >
                            <option value="">Giọng mặc định hệ thống</option>
                            {nativeVoices.map(v => (
                                <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang})
                                </option>
                            ))}
                        </select>
                        
                        {/* Rate Slider */}
                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Tốc độ (Rate)</span>
                            <span className="font-mono text-emerald-400">{voiceSettings.nativeRate.toFixed(1)}x</span>
                            </div>
                            <div className="relative flex items-center">
                                <span className="text-[10px] text-slate-600 absolute left-0 -bottom-4">0.5</span>
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="2" 
                                    step="0.1" 
                                    value={voiceSettings.nativeRate}
                                    onChange={(e) => setVoiceSettings(s => ({ ...s, nativeRate: parseFloat(e.target.value) }))}
                                    className="w-full h-4 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <span className="text-[10px] text-slate-600 absolute right-0 -bottom-4">2.0</span>
                            </div>
                        </div>

                        {/* Pitch Slider */}
                        <div className="mt-6">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Cao độ (Pitch)</span>
                            <span className="font-mono text-emerald-400">{voiceSettings.nativePitch.toFixed(1)}</span>
                            </div>
                            <div className="relative flex items-center">
                                <span className="text-[10px] text-slate-600 absolute left-0 -bottom-4">0.5</span>
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="2" 
                                    step="0.1" 
                                    value={voiceSettings.nativePitch}
                                    onChange={(e) => setVoiceSettings(s => ({ ...s, nativePitch: parseFloat(e.target.value) }))}
                                    className="w-full h-4 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <span className="text-[10px] text-slate-600 absolute right-0 -bottom-4">2.0</span>
                            </div>
                        </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {GEMINI_VOICES.map(voice => (
                            <button
                                key={voice}
                                onClick={() => setVoiceSettings(s => ({ ...s, geminiVoice: voice }))}
                                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                    voiceSettings.geminiVoice === voice
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {voice}
                            </button>
                            ))}
                        </div>
                    )}

                    {/* TEST VOICE & SAVE BUTTONS */}
                    <div className="pt-6 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                speak("Chào bạn. đây là giọng nói của bạn sau khi được lưu");
                            }}
                            disabled={isSpeaking}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border border-slate-700 hover:border-slate-500 ${
                                isSpeaking
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            {isSpeaking ? (
                                <>
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce delay-200"></span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 2.75 2.75 0 010-3.893.75.75 0 011.06-1.06c.46.46.46 1.205 0 1.665a4.25 4.25 0 000-6.01.75.75 0 01-1.06-1.06z" />
                                        <path d="M16.463 8.288a.75.75 0 011.06 0 5.25 5.25 0 010 7.424.75.75 0 01-1.06-1.06 3.75 3.75 0 000-5.304.75.75 0 010-1.06z" />
                                    </svg>
                                    Nghe thử
                                </>
                            )}
                        </button>

                        <button
                          onClick={handleSaveSettings}
                          className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transform hover:scale-[1.02]"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                           </svg>
                           Lưu cài đặt
                        </button>
                    </div>
                    </div>
                </div>
              )}

              {/* SYSTEM TAB */}
              {settingsTab === 'system' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-slate-300 pb-20">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                            Cài đặt hệ thống
                        </h3>
                        
                        {/* Status Badge */}
                        <div className={`text-xs px-3 py-1 rounded-full border ${
                            isUsingCustomKey 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                            : 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        }`}>
                            {isUsingCustomKey ? '✅ Đang dùng Key cá nhân' : 'ℹ️ Đang dùng Key mặc định'}
                        </div>
                    </div>

                    <p className="text-sm text-slate-500">Quản lý kết nối và hành vi ứng dụng.</p>
                    
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
                         <div className="text-sm font-semibold text-white">Quyền lợi khi dùng Key cá nhân:</div>
                         <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                             <li><b className="text-emerald-400">Giọng nói Gemini AI:</b> Đọc tự nhiên, truyền cảm.</li>
                             <li><b className="text-emerald-400">Kết nối Internet:</b> Tra cứu thời tiết, tin tức, giá vàng, ngoại tệ.</li>
                             <li><b className="text-emerald-400">Bộ nhớ thông minh:</b> Ghi nhớ cuộc trò chuyện liên tục (Lưu tạm 20.000 ký tự).</li>
                             <li><b className="text-emerald-400">Không giới hạn:</b> Tránh bị chia sẻ hạn ngạch với người khác.</li>
                         </ul>
                         {!isUsingCustomKey && (
                            <div className="text-xs text-yellow-500 mt-2 italic">
                                * Hiện tại bạn đang dùng bản miễn phí giới hạn (Chỉ Chat cơ bản).
                            </div>
                         )}
                    </div>

                    {/* GUIDE: HOW TO GET KEY */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-4">
                        <h4 className="text-blue-400 font-bold text-sm mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                            Hướng dẫn lấy API Key (Miễn phí)
                        </h4>
                        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                            <p>1. Truy cập <b>Google AI Studio</b>.</p>
                            <p>2. Đăng nhập bằng tài khoản Google của bạn.</p>
                            <p>3. Nhấn vào nút <b>Get API key</b> (góc trái).</p>
                            <p>4. Chọn <b>Create API key</b> và sao chép mã bắt đầu bằng <code>AIza...</code></p>
                        </div>
                        <a 
                            href="https://aistudio.google.com/app/apikey" 
                            target="_blank" 
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Lấy Key ngay tại đây
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </a>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                Gemini API Key
                            </label>
                            <div className="relative">
                                <input 
                                    type="password"
                                    value={systemSettings.geminiApiKey}
                                    onChange={(e) => setSystemSettings(s => ({...s, geminiApiKey: e.target.value}))}
                                    placeholder="AIza..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-base text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                />
                                <div className="absolute right-4 top-4 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                         <div className="pt-6">
                            <button
                                onClick={handleSaveSettings}
                                disabled={isValidating}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg text-white transform hover:scale-[1.02] ${
                                    isValidating 
                                    ? 'bg-slate-700 cursor-wait'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                                }`}
                            >
                                {isValidating ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Đang kiểm tra kết nối...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                        </svg>
                                        Lưu cấu hình hệ thống
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
              )}

              {/* ABOUT TAB - REWRITTEN TO BE STANDALONE PROPRIETARY STYLE */}
              {settingsTab === 'about' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-slate-300 pb-20">
                     <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                        Về trợ lý ảo ViVi
                    </h3>
                    
                    {/* Hero Branding - WITH NEW LOGO */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                         
                         {/* Background Glow */}
                         <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none"></div>

                         {/* LOGO SVG */}
                         <div className="relative z-10 py-4">
                             <svg viewBox="0 0 200 200" className="w-32 h-32 drop-shadow-2xl animate-float">
                                <defs>
                                    <linearGradient id="viviGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#10b981" /> 
                                        <stop offset="50%" stopColor="#3b82f6" /> 
                                        <stop offset="100%" stopColor="#ec4899" /> 
                                    </linearGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                                
                                {/* Outer Glow Ring */}
                                <circle cx="100" cy="100" r="85" fill="none" stroke="url(#viviGradient)" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="10 5" />
                                
                                {/* Main Shape */}
                                <circle cx="100" cy="100" r="70" fill="url(#viviGradient)" fillOpacity="0.1" />
                                
                                {/* The "Wave" V Logo */}
                                <path d="M55 70 L100 145 L145 70" fill="none" stroke="url(#viviGradient)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                                
                                {/* Tech Dots */}
                                <circle cx="55" cy="70" r="6" fill="#fff" />
                                <circle cx="145" cy="70" r="6" fill="#fff" />
                                <circle cx="100" cy="145" r="6" fill="#fff" />
                                
                                {/* Pulse Effect */}
                                <circle cx="100" cy="100" r="40" fill="none" stroke="white" strokeWidth="1" opacity="0.2">
                                   <animate attributeName="r" values="40;80;40" dur="4s" repeatCount="indefinite" />
                                   <animate attributeName="opacity" values="0.2;0;0.2" dur="4s" repeatCount="indefinite" />
                                </circle>
                            </svg>
                         </div>

                         <div className="relative z-10">
                             <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-pink-400 tracking-tight">
                                ViVi Assistant
                             </h2>
                             <div className="text-[10px] font-mono text-slate-400 mt-2 px-3 py-1 bg-slate-800 rounded-full inline-block border border-slate-700 uppercase tracking-widest">
                                Phiên bản v2.0.0 Pro
                             </div>
                         </div>
                         <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                            Người bạn đồng hành kỹ thuật số của bạn. Không chỉ lắng nghe, ViVi còn thấu hiểu và chia sẻ cảm xúc.
                         </p>
                    </div>

                    {/* Feature Highlights */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                <span className="text-pink-400">♥</span> Giao tiếp có hồn
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                ViVi được thiết kế để vượt xa những câu lệnh khô khan. Với hệ thống biểu cảm khuôn mặt linh hoạt và giọng nói tự nhiên, mỗi cuộc trò chuyện đều trở nên gần gũi như một người bạn thực sự.
                            </p>
                        </div>

                        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                <span className="text-blue-400">✦</span> Thông minh & Đa năng
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Từ việc tra cứu thông tin thời gian thực, cập nhật tin tức, giá cả thị trường cho đến việc tâm sự, kể chuyện. ViVi luôn sẵn sàng giải đáp mọi thắc mắc của bạn một cách chính xác nhất.
                            </p>
                        </div>
                    </div>

                    {/* DEVELOPER INFO & DONATION */}
                    <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700 mt-2">
                      <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                        👨‍💻 Thông tin nhà phát triển
                      </h4>
                      <div className="space-y-3 text-sm text-slate-300">
                        <p><span className="text-slate-500">Sáng lập:</span> <span className="font-semibold text-white">Chương Xuân Vương</span></p>
                        <p><span className="text-slate-500">Email:</span> <a href="mailto:chuongxuanvuong@gmail.com" className="text-blue-400 hover:underline">chuongxuanvuong@gmail.com</a></p>
                        <p><span className="text-slate-500">Facebook:</span> <a href="https://www.facebook.com/xuanvuongtv" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">xuanvuongtv</a></p>
                        <p><span className="text-slate-500">Zalo:</span> <span className="font-mono text-emerald-400">0906802199</span></p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-6 rounded-xl border border-pink-500/30 mt-4">
                      <h4 className="text-pink-400 font-bold mb-4 flex items-center gap-2">
                        ☕ Ủng hộ phát triển (Donate)
                      </h4>
                      <p className="text-xs text-slate-400 mb-4">
                        Nếu bạn yêu thích ViVi, hãy ủng hộ mình một ly cà phê nhé! ❤️
                      </p>
                      <div className="grid grid-cols-1 gap-3 text-sm">
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                           <span className="text-slate-400">Vietcombank</span>
                           <div className="text-right">
                              <div className="font-mono font-bold text-white">9906802199</div>
                              <div className="text-[10px] text-slate-500">xuanvuongtv</div>
                           </div>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                           <span className="text-slate-400">Lioabank</span>
                           <div className="font-mono font-bold text-white">678900006789</div>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                           <span className="text-slate-400">MoMo / ZaloPay</span>
                           <div className="font-mono font-bold text-pink-400">0906802199</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Signature */}
                    <div className="text-center pt-8 border-t border-slate-800">
                        <p className="text-xs text-slate-500 italic">
                            "ViVi luôn ở đây để lắng nghe bạn."
                        </p>
                        <div className="mt-4 text-[10px] text-slate-600 uppercase tracking-widest">
                            © 2025 Chương Xuân Vương
                        </div>
                    </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
