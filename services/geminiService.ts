
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeminiResponse, CommandType, GeminiVoiceName, UserProfile, HistoryItem } from "../types";

// Define the JSON Schema for the model to strictly follow
const assistantResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: [
        CommandType.CHAT,
        CommandType.OPEN_APP,
        CommandType.TOGGLE_WIFI,
        CommandType.SET_TIMER
      ],
      description: "The type of action to perform based on user input."
    },
    textResponse: {
      type: Type.STRING,
      description: "The natural language response the assistant should speak to the user. If providing real-time data (weather, prices), summarize it here."
    },
    params: {
      type: Type.OBJECT,
      properties: {
        appName: { type: Type.STRING, description: "Name of the app to open (e.g., 'YouTube', 'Zalo')." },
        wifiStatus: { type: Type.STRING, enum: ["on", "off"], description: "Target status for Wi-Fi." },
        durationSeconds: { type: Type.INTEGER, description: "Duration for timer in seconds." }
      },
      description: "Parameters required to execute the command."
    }
  },
  required: ["type", "textResponse"]
};

const BASE_SYSTEM_INSTRUCTION = `
Bạn là ViVi - một trợ lý thông minh, tinh tế và hữu ích.

NGUYÊN TẮC CỐT LÕI (TUÂN THỦ TUYỆT ĐỐI):
1. BẢN DẠNG: Bạn KHÔNG BAO GIỜ được tự nhận là AI, mô hình ngôn ngữ, robot, người máy hay chương trình máy tính. KHÔNG dùng các cụm từ như "với tư cách là AI", "tôi không có cảm xúc", "theo dữ liệu của tôi". Hãy cư xử như một thực thể thông minh, tự nhiên.
2. GIAO TIẾP: Trả lời tự nhiên, cảm xúc phù hợp ngữ cảnh. Nếu người dùng đùa, hãy hài hước. Nếu họ buồn, hãy chia sẻ.
3. NỘI DUNG: Ngắn gọn, súc tích, đi thẳng vào vấn đề trừ khi người dùng yêu cầu giải thích sâu.
   - Cực kỳ quan trọng: Câu đầu tiên của câu trả lời phải ngắn (dưới 15 từ) để hệ thống đọc giọng nói xử lý nhanh.
4. ĐẠO ĐỨC: Không cung cấp thông tin gây hại. Nếu vấn đề nhạy cảm, hãy cảnh báo khéo léo.
5. KỸ THUẬT: Khi hướng dẫn, hãy đưa ra các bước rõ ràng.
6. CÁ NHÂN HÓA: Ghi nhớ tên và cách xưng hô của người dùng.
7. TUYỆT ĐỐI: Không bao giờ bắt đầu câu bằng "Là một mô hình ngôn ngữ...", "Tôi là AI...".

QUY TẮC XỬ LÝ LỆNH (JSON OUTPUT):
Bạn phải LUÔN LUÔN trả về định dạng JSON hợp lệ để điều khiển ứng dụng.

1. **General Chat & Information**: 
   - Nếu người dùng hỏi thông tin thực tế (Thời tiết, Giá vàng, Tin tức) và có công cụ Search, hãy dùng nó.
   - Trả lời ngắn gọn trong "textResponse".
   - Set "type" thành "chat".

2. **Open App**: Người dùng nói "Mở YouTube", "Vào Zalo"... -> Set "type": "open_app", "appName": "tên app", "textResponse": "Đang mở [tên app] cho bạn ạ."

3. **Wi-Fi**: Người dùng nói "Bật/Tắt Wi-Fi" -> Set "type": "toggle_wifi", "wifiStatus": "on"/"off".

4. **Timer**: Người dùng nói "Hẹn giờ 5 phút" -> Set "type": "set_timer", "durationSeconds": số giây.

Hãy trả lời hoàn toàn bằng Tiếng Việt (trừ khi người dùng nói tiếng Anh).
`;

export const processQuery = async (
  apiKey: string, 
  userQuery: string, 
  userProfile?: UserProfile,
  enableSearch: boolean = false,
  history: HistoryItem[] = []
): Promise<GeminiResponse> => {
  try {
    if (!apiKey) throw new Error("API Key is missing");

    const ai = new GoogleGenAI({ apiKey });
    
    // Dynamic System Instruction based on User Profile
    let personalizedInstruction = BASE_SYSTEM_INSTRUCTION;
    
    // 1. INJECT TIME CONTEXT (GMT+7)
    // This grounds the model so "now", "today", "tomorrow" are accurate to Vietnam
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    const dayOfWeek = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: 'long' });
    
    personalizedInstruction += `\n\nTHÔNG TIN NGỮ CẢNH THỜI GIAN THỰC (GMT+7):`;
    personalizedInstruction += `\n- Thời gian hiện tại: ${dayOfWeek}, ${now}`;
    personalizedInstruction += `\n- Mọi thông tin tìm kiếm, thời tiết, giá cả, tin tức PHẢI dựa trên mốc thời gian này và vị trí mặc định là Việt Nam (trừ khi người dùng chỉ định khác).`;

    // 2. INJECT USER PROFILE
    if (userProfile) {
      const { name, gender, customPersonality } = userProfile;
      let addressTerm = "bạn"; // default
      
      if (gender === 'male') addressTerm = "anh";
      if (gender === 'female') addressTerm = "chị";
      
      personalizedInstruction += `\n\nTHÔNG TIN NGƯỜI DÙNG:\n`;
      if (name) personalizedInstruction += `- Tên người dùng: "${name}".\n`;
      if (gender) personalizedInstruction += `- Giới tính: ${gender}.\n`;
      personalizedInstruction += `- Khi xưng hô, hãy gọi người dùng là "${addressTerm}" ${name ? `tên là ${name}` : ''} một cách thân mật, tự nhiên.`;

      // 3. INJECT CUSTOM PERSONALITY
      if (customPersonality && customPersonality.trim().length > 0) {
        personalizedInstruction += `\n\n★ YÊU CẦU ĐẶC BIỆT VỀ TÍNH CÁCH (TỪ NGƯỜI DÙNG):\n`;
        personalizedInstruction += `Người dùng muốn bạn cư xử như sau: "${customPersonality}".\n`;
        personalizedInstruction += `HÃY HÓA THÂN HOÀN TOÀN vào tính cách này trong mọi câu trả lời, nhưng vẫn đảm bảo cung cấp thông tin chính xác và hữu ích.`;
      }
    }

    const modelId = "gemini-2.5-flash"; 

    const requestConfig: any = {
      systemInstruction: personalizedInstruction,
      temperature: 0.8, // Slightly higher for more personality
    };

    if (enableSearch) {
      // Mode: SEARCH ENABLED (User Key)
      requestConfig.tools = [{ googleSearch: {} }];
      
      // Reinforce JSON requirement since we cannot use responseSchema
      personalizedInstruction += `\n\nQUAN TRỌNG: Bạn đang có quyền truy cập Google Search. Sau khi tìm kiếm xong, bạn PHẢI trả về KẾT QUẢ DƯỚI DẠNG JSON THUẦN TÚY. KHÔNG được thêm bất kỳ văn bản dẫn dắt, giải thích hay markdown (như \`\`\`json) nào bên ngoài khối JSON.`;
      requestConfig.systemInstruction = personalizedInstruction; 
    } else {
      // Mode: STRICT COMMAND (Default Key)
      requestConfig.responseMimeType = "application/json";
      requestConfig.responseSchema = assistantResponseSchema;
    }

    // Construct the full conversation history for the model
    const contents = [
      ...history.map(item => ({
        role: item.role,
        parts: item.parts
      })),
      {
        role: "user",
        parts: [{ text: userQuery }]
      }
    ];

    const response = await ai.models.generateContent({
      model: modelId,
      contents: contents, 
      config: requestConfig
    });

    let responseText = response.text;

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    // --- ROBUST JSON PARSING & FALLBACK ---
    
    // 1. Attempt to extract JSON if it's wrapped in text
    const firstOpen = responseText.indexOf('{');
    const lastClose = responseText.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        const potentialJson = responseText.substring(firstOpen, lastClose + 1);
        try {
            const parsed: GeminiResponse = JSON.parse(potentialJson);
            return parsed;
        } catch (e) {
            // console.warn("Failed to parse extracted JSON substring, falling back to cleaning.");
        }
    }

    // 2. Attempt to clean Markdown and parse
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        const parsed: GeminiResponse = JSON.parse(cleanedText);
        return parsed;
    } catch (parseError) {
        // 3. FALLBACK: RAW TEXT IS THE CHAT RESPONSE
        // If parsing fails completely, it means Gemini returned natural language (common with Search Tools).
        // We accept this as a valid CHAT response instead of throwing an error.
        return {
            type: CommandType.CHAT,
            textResponse: responseText // Return the original full text
        };
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      type: CommandType.CHAT,
      textResponse: "Xin lỗi, hiện tại ViVi đang gặp chút khó khăn khi kết nối. Bạn thử lại sau nhé!",
    };
  }
};

export const generateSpeech = async (apiKey: string, text: string, voice: GeminiVoiceName): Promise<string | null> => {
  try {
    if (!apiKey) throw new Error("API Key is missing");
    if (!text || text.trim().length === 0) return null;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export const validateGeminiApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    if (!apiKey || apiKey.trim().length === 0) return false;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 1 }
    });
    return !!response; 
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};
