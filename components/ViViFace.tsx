
import React, { useEffect, useState, useRef } from 'react';

interface ViViFaceProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
}

// --- TYPES ---
type MouthShape = 'smile' | 'bigSmile' | 'flat' | 'sad' | 'o' | 'd' | 'smirkLeft' | 'smirkRight' | 'zigZag' | 'cat';

interface MoodConfig {
  id: string;
  leftEyeOpen: number; // 0.0 to 1.0 (0 = closed, 1 = normal, >1 = wide)
  rightEyeOpen: number; // 0.0 to 1.0
  eyeRotation: number; // degrees (positive = sad brows, negative = angry brows)
  mouthShape: MouthShape;
  pupilY?: number; // Optional override for fixed gaze
  pupilX?: number; // Optional override for fixed gaze
  blush?: boolean;
  isHeartEyes?: boolean; // New flag for Love mode
}

// --- 50 EXPRESSIONS LIBRARY (Mapped from Vietnamese Descriptions) ---
const MOOD_LIBRARY: MoodConfig[] = [
  // 1. Cười tươi – miệng mở rộng, mắt cong như vầng trăng.
  { id: 'smileFresh', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'bigSmile' },
  
  // 2. Cười mỉm – môi hơi cong, ánh mắt nhẹ nhàng.
  { id: 'smileGentle', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'smile' },
  
  // 3. Cười nhăn mắt – mắt nhắm lại vì cười quá vui.
  { id: 'smileEyeCrinkle', leftEyeOpen: 0.1, rightEyeOpen: 0.1, eyeRotation: 0, mouthShape: 'bigSmile' },
  
  // 4. Cười rạng rỡ có má lúm – má hóp nhẹ, nụ cười sáng.
  { id: 'smileRadiant', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'bigSmile', blush: true },
  
  // 5. Cười lém lỉnh – mắt hơi nghiêng, miệng nhếch một bên.
  { id: 'smileCheeky', leftEyeOpen: 0.8, rightEyeOpen: 0.8, eyeRotation: -5, mouthShape: 'smirkRight' },
  
  // 6. Cười ngại ngùng – mặt ửng đỏ, mắt nhìn sang chỗ khác.
  { id: 'smileShy', leftEyeOpen: 0.9, rightEyeOpen: 0.9, eyeRotation: 0, mouthShape: 'smile', blush: true, pupilX: 10, pupilY: 5 },
  
  // 7. Cười gượng – miệng cười nhưng mắt mệt mỏi.
  { id: 'smileForced', leftEyeOpen: 0.6, rightEyeOpen: 0.6, eyeRotation: 10, mouthShape: 'zigZag' },
  
  // 8. Cười xấu hổ – che miệng (simulated), má đỏ.
  { id: 'smileEmbarrassed', leftEyeOpen: 0.2, rightEyeOpen: 0.2, eyeRotation: 0, mouthShape: 'smile', blush: true },
  
  // 9. Cười gian – mắt nheo lại, miệng nhếch kiểu tinh quái.
  { id: 'smileSneaky', leftEyeOpen: 0.5, rightEyeOpen: 0.5, eyeRotation: -10, mouthShape: 'smirkLeft' },
  
  // 10. Cười xí hổ kiểu anime – mắt tròn long lanh, mặt đỏ.
  { id: 'smileAnimeShy', leftEyeOpen: 1.3, rightEyeOpen: 1.3, eyeRotation: 0, mouthShape: 'o', blush: true },
  
  // 11. Buồn nhẹ – mắt cụp xuống, miệng nhỏ lại.
  { id: 'sadSlight', leftEyeOpen: 0.8, rightEyeOpen: 0.8, eyeRotation: 15, mouthShape: 'flat' },
  
  // 12. Buồn sâu – nước mắt lưng tròng (simulated with sad eyes).
  { id: 'sadDeep', leftEyeOpen: 0.6, rightEyeOpen: 0.6, eyeRotation: 25, mouthShape: 'sad' },
  
  // 13. Khóc to – nước mắt chảy thành dòng.
  { id: 'cryLoud', leftEyeOpen: 0.2, rightEyeOpen: 0.2, eyeRotation: 20, mouthShape: 'o' },
  
  // 14. Khóc tức tưởi – miệng méo, lông mày nhíu chặt.
  { id: 'crySob', leftEyeOpen: 0.1, rightEyeOpen: 0.1, eyeRotation: 30, mouthShape: 'zigZag' },
  
  // 15. Sắp khóc – môi run run, mắt ướt.
  { id: 'cryAboutTo', leftEyeOpen: 1.1, rightEyeOpen: 1.1, eyeRotation: 20, mouthShape: 'sad', pupilY: 2 },
  
  // 16. Thẫn thờ – ánh mắt vô hồn.
  { id: 'dazed', leftEyeOpen: 0.8, rightEyeOpen: 0.8, eyeRotation: 0, mouthShape: 'flat', pupilY: 0, pupilX: 0 },
  
  // 17. Cúi đầu buồn – mắt nhắm, mặt hơi nghiêng xuống.
  { id: 'sadHeadDown', leftEyeOpen: 0.3, rightEyeOpen: 0.3, eyeRotation: 15, mouthShape: 'sad', pupilY: 15 },
  
  // 18. Buồn + sợ – môi run, mắt mở to.
  { id: 'sadScared', leftEyeOpen: 1.2, rightEyeOpen: 1.2, eyeRotation: 20, mouthShape: 'zigZag' },
  
  // 19. Giận nhẹ – mày nhíu, miệng cong xuống.
  { id: 'angrySlight', leftEyeOpen: 0.9, rightEyeOpen: 0.9, eyeRotation: -15, mouthShape: 'flat' },
  
  // 20. Giận đỏ mặt – mặt đậm màu, má phồng.
  { id: 'angryBlush', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: -20, mouthShape: 'flat', blush: true },
  
  // 21. Giận bốc khói đầu – icon khói bốc lên (simulated with extreme brows).
  { id: 'angryFuming', leftEyeOpen: 0.7, rightEyeOpen: 0.7, eyeRotation: -30, mouthShape: 'flat' },
  
  // 22. Giận cắn răng – răng nghiến, mắt nheo.
  { id: 'angryGritting', leftEyeOpen: 0.5, rightEyeOpen: 0.5, eyeRotation: -25, mouthShape: 'zigZag' },
  
  // 23. Giận hét – miệng mở lớn, mắt sắc.
  { id: 'angryScream', leftEyeOpen: 1.2, rightEyeOpen: 1.2, eyeRotation: -35, mouthShape: 'd' },
  
  // 24. Giận bí mật – mím môi, ánh mắt lạnh.
  { id: 'angrySecret', leftEyeOpen: 0.6, rightEyeOpen: 0.6, eyeRotation: -15, mouthShape: 'flat' },
  
  // 25. Ngạc nhiên nhẹ – mắt mở to, miệng chữ O nhỏ.
  { id: 'surprisedMild', leftEyeOpen: 1.1, rightEyeOpen: 1.1, eyeRotation: 0, mouthShape: 'o' },
  
  // 26. Ngạc nhiên lớn – miệng chữ O to.
  { id: 'surprisedBig', leftEyeOpen: 1.3, rightEyeOpen: 1.3, eyeRotation: 0, mouthShape: 'o' },
  
  // 27. Sững sờ – mắt mở rất to, mày giật lên.
  { id: 'stunned', leftEyeOpen: 1.4, rightEyeOpen: 1.4, eyeRotation: 5, mouthShape: 'flat', pupilX: 0, pupilY: 0 },
  
  // 28. Sốc toàn tập – đổ mồ hôi, miệng há hốc.
  { id: 'shocked', leftEyeOpen: 0.8, rightEyeOpen: 0.8, eyeRotation: 0, mouthShape: 'o', pupilY: 0 },
  
  // 29. Ồ wow – mắt sáng, miệng O đầy phấn khích.
  { id: 'wow', leftEyeOpen: 1.2, rightEyeOpen: 1.2, eyeRotation: 0, mouthShape: 'o', blush: true },
  
  // 30. Sợ hãi – mắt mở to, miệng run.
  { id: 'fear', leftEyeOpen: 1.3, rightEyeOpen: 1.3, eyeRotation: 0, mouthShape: 'zigZag', pupilY: 0 },
  
  // 31. Hoảng loạn – mồ hôi lạnh, miệng méo.
  { id: 'panic', leftEyeOpen: 1.4, rightEyeOpen: 1.2, eyeRotation: 0, mouthShape: 'zigZag', pupilX: 2, pupilY: -2 },
  
  // 32. Giật mình – biểu cảm bật ngược.
  { id: 'startled', leftEyeOpen: 1.5, rightEyeOpen: 1.5, eyeRotation: 0, mouthShape: 'flat' },
  
  // 33. Lo lắng – mày cụp, môi nén lại.
  { id: 'worried', leftEyeOpen: 0.9, rightEyeOpen: 0.9, eyeRotation: 20, mouthShape: 'flat' },
  
  // 34. Sợ + bất lực – khóe miệng run, ánh mắt hoảng.
  { id: 'scaredHelpless', leftEyeOpen: 1.2, rightEyeOpen: 1.2, eyeRotation: 25, mouthShape: 'sad' },
  
  // 35. Tự tin – nụ cười kiêu hãnh, mắt hẹp.
  { id: 'confident', leftEyeOpen: 0.8, rightEyeOpen: 0.8, eyeRotation: -10, mouthShape: 'smirkLeft' },
  
  // 36. Tự hào – cười ngẩng đầu, mắt long lanh.
  { id: 'proud', leftEyeOpen: 0.5, rightEyeOpen: 0.5, eyeRotation: 0, mouthShape: 'bigSmile', pupilY: -5 },
  
  // 37. Đắc ý – mắt nheo lại, miệng nhếch.
  { id: 'smug', leftEyeOpen: 0.4, rightEyeOpen: 0.4, eyeRotation: -5, mouthShape: 'smirkRight' },
  
  // 38. Lạnh lùng – mắt sắc, môi thẳng.
  { id: 'cold', leftEyeOpen: 0.6, rightEyeOpen: 0.6, eyeRotation: -10, mouthShape: 'flat' },
  
  // 39. Chán nản – mắt lờ đờ, miệng buông thõng.
  { id: 'bored', leftEyeOpen: 0.5, rightEyeOpen: 0.5, eyeRotation: 0, mouthShape: 'flat', pupilY: 5 },
  
  // 40. Mệt mỏi – quầng mắt, miệng mím.
  { id: 'tired', leftEyeOpen: 0.4, rightEyeOpen: 0.4, eyeRotation: 15, mouthShape: 'flat' },
  
  // 41. Ngủ gật – mắt nặng, đầu nghiêng.
  { id: 'dozing', leftEyeOpen: 0.2, rightEyeOpen: 0.2, eyeRotation: 0, mouthShape: 'o' },
  
  // 42. Ngủ say – mắt nhắm, thở “zZz”.
  { id: 'sleeping', leftEyeOpen: 0, rightEyeOpen: 0, eyeRotation: 0, mouthShape: 'flat' },
  
  // 43. Ngáp dài – miệng mở rộng.
  { id: 'yawning', leftEyeOpen: 0.1, rightEyeOpen: 0.1, eyeRotation: 0, mouthShape: 'o' },
  
  // 44. Nghĩ ngợi – tay đặt cằm, mắt liếc lên.
  { id: 'thinking', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'flat', pupilX: 10, pupilY: -12 },
  
  // 45. Bối rối – dấu hỏi quanh đầu, má đỏ nhẹ.
  { id: 'confused', leftEyeOpen: 1, rightEyeOpen: 0.6, eyeRotation: -15, mouthShape: 'zigZag' },
  
  // 46. Xấu hổ – mắt né tránh, má đỏ.
  { id: 'ashamed', leftEyeOpen: 0.3, rightEyeOpen: 0.3, eyeRotation: 10, mouthShape: 'flat', blush: true, pupilY: 10 },
  
  // 47. Nháy mắt – một mắt nhắm, miệng cười.
  { id: 'wink', leftEyeOpen: 0.1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'smile' },
  
  // 48. Trái tim trên mắt – mắt hình trái tim.
  { id: 'love', leftEyeOpen: 1.1, rightEyeOpen: 1.1, eyeRotation: 0, mouthShape: 'bigSmile', blush: true, isHeartEyes: true },
  
  // 49. Rất thích thú – mắt sáng long lanh, miệng cười rộng.
  { id: 'excited', leftEyeOpen: 1.3, rightEyeOpen: 1.3, eyeRotation: 0, mouthShape: 'bigSmile', blush: true },
  
  // 50. Biểu cảm “…” – mặt đơ, mắt nhìn xa xăm.
  { id: 'speechless', leftEyeOpen: 1, rightEyeOpen: 1, eyeRotation: 0, mouthShape: 'flat', pupilX: 0, pupilY: 0 },
];

const ViViFace: React.FC<ViViFaceProps> = ({ state }) => {
  // --- STATE ---
  const [currentMood, setCurrentMood] = useState<MoodConfig>(MOOD_LIBRARY[0]);
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });
  const [mouthOpen, setMouthOpen] = useState(0);

  // --- REFS ---
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. REACTIVE STATE (System Overrides) ---
  useEffect(() => {
    if (state === 'speaking') {
      setCurrentMood({ ...MOOD_LIBRARY[0], mouthShape: 'd' }); // Talking base
    } else if (state === 'listening') {
      setCurrentMood({ ...MOOD_LIBRARY[24], mouthShape: 'o' }); // Mild surprise/listening
      setPupilPos({ x: 0, y: 0 });
    } else if (state === 'processing') {
      setCurrentMood(MOOD_LIBRARY[43]); // Thinking
      setPupilPos({ x: 0, y: -8 });
    } else {
      // Return to Idle Loop
      setCurrentMood(MOOD_LIBRARY[0]);
    }
  }, [state]);

  // --- 2. IDLE MOOD LOOP (The 50 Moods Randomizer) ---
  useEffect(() => {
    if (state !== 'idle') return;

    const triggerRandomMood = () => {
      // 30% chance to be "Neutral/Gentle", 70% chance to pick a random expressive mood
      // This keeps ViVi feeling "alive" but not manic
      if (Math.random() > 0.7) {
         setCurrentMood(MOOD_LIBRARY[1]); // Gentle smile
      } else {
         const randomIndex = Math.floor(Math.random() * MOOD_LIBRARY.length);
         setCurrentMood(MOOD_LIBRARY[randomIndex]);
      }
      
      // Schedule next mood change (2s to 5s)
      idleTimerRef.current = setTimeout(triggerRandomMood, 2000 + Math.random() * 3000);
    };

    triggerRandomMood();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [state]);

  // --- 3. EYE SACCADES (Smooth & Natural Gaze) ---
  useEffect(() => {
    // Allow eye movement in idle AND speaking (natural gaze while talking)
    if (state !== 'idle' && state !== 'speaking') return;

    const moveEyes = () => {
      // Only move eyes if the current mood doesn't lock them (pupilX/Y undefined)
      if (currentMood.pupilX === undefined && currentMood.pupilY === undefined) {
         const rand = Math.random();
         
         if (rand < 0.5) {
           setPupilPos({ x: 0, y: 0 }); // Center Gaze (Most frequent)
         } else if (rand < 0.65) {
           setPupilPos({ x: -18, y: 0 }); // Look Left
         } else if (rand < 0.8) {
           setPupilPos({ x: 18, y: 0 }); // Look Right
         } else if (rand < 0.9) {
           setPupilPos({ x: 0, y: -12 }); // Look Up (Thinking/Daydreaming)
         } else {
           setPupilPos({ x: 0, y: 10 }); // Look Down (Shy/Sad)
         }
      }
      // Gaze holds for 1s to 4s
      eyeMoveTimerRef.current = setTimeout(moveEyes, 1000 + Math.random() * 3000);
    };

    moveEyes();
    return () => { if (eyeMoveTimerRef.current) clearTimeout(eyeMoveTimerRef.current); };
  }, [state, currentMood]); 

  // --- 4. BLINK SYSTEM (Including Winks & Sleep Sequence) ---
  useEffect(() => {
    const blinkLoop = () => {
      // Don't blink if we have heart eyes (it ruins the effect)
      if (currentMood.isHeartEyes) {
          blinkTimerRef.current = setTimeout(blinkLoop, 2000);
          return;
      }

      const rand = Math.random();
      const prevLeft = currentMood.leftEyeOpen;
      const prevRight = currentMood.rightEyeOpen;

      // 10% chance for a "Playful Sequence" (Wink Right -> Wink Left -> Open)
      if (rand > 0.9 && prevLeft > 0.5) {
          // Step 1: Wink Right
          setCurrentMood(prev => ({ ...prev, rightEyeOpen: 0.1 }));
          
          setTimeout(() => {
             // Step 2: Open Right, Wink Left
             setCurrentMood(prev => ({ ...prev, rightEyeOpen: prevRight, leftEyeOpen: 0.1 }));
             
             setTimeout(() => {
                // Step 3: Open Both
                setCurrentMood(prev => ({ ...prev, leftEyeOpen: prevLeft }));
             }, 250);
          }, 250);

          blinkTimerRef.current = setTimeout(blinkLoop, 4000 + Math.random() * 3000);
      } 
      // Standard Blink logic
      else if (prevLeft > 0.4 && prevRight > 0.4) {
          // Close eyes
          setCurrentMood(prev => ({ ...prev, leftEyeOpen: 0.1, rightEyeOpen: 0.1 }));
          // Re-open shortly
          setTimeout(() => {
             setCurrentMood(prev => ({ ...prev, leftEyeOpen: prevLeft, rightEyeOpen: prevRight }));
          }, 180);
          
          blinkTimerRef.current = setTimeout(blinkLoop, 3000 + Math.random() * 4000);
      } else {
          // If eyes are already closed (sleeping/laughing), check again later
          blinkTimerRef.current = setTimeout(blinkLoop, 2000);
      }
    };

    blinkTimerRef.current = setTimeout(blinkLoop, 2000);
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [currentMood.id, currentMood.isHeartEyes]);

  // --- 5. ADVANCED LIP SYNC & EXPRESSION ---
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const speakLoop = () => {
      // Variable timing for realistic syllable length (50ms fast - 200ms slow)
      const duration = 50 + Math.random() * 150;
      
      // Variable opening intensity
      // Bias towards closed (consonants) with bursts of open (vowels)
      const intensity = Math.random();
      const targetOpen = 0.1 + (intensity * 0.7); // 0.1 to 0.8 range

      setMouthOpen(targetOpen);

      // Randomly emphasize words with eyebrows or eye widening
      if (!currentMood.isHeartEyes && Math.random() > 0.85) {
          setCurrentMood(prev => ({
              ...prev,
              // Slight brow raise/furrow
              eyeRotation: (Math.random() - 0.5) * 15,
              // Slight widen
              leftEyeOpen: 1.0 + Math.random() * 0.15,
              rightEyeOpen: 1.0 + Math.random() * 0.15
          }));
      } else if (!currentMood.isHeartEyes && Math.random() > 0.9) {
          // Reset to neutral speaking eyes
          setCurrentMood(prev => ({ ...prev, eyeRotation: 0, leftEyeOpen: 1, rightEyeOpen: 1 }));
      }

      timeout = setTimeout(speakLoop, duration);
    };

    if (state === 'speaking') {
      speakLoop();
    } else {
      setMouthOpen(0);
    }
    return () => clearTimeout(timeout);
  }, [state, currentMood.isHeartEyes]);


  // --- RENDER HELPERS ---
  const getMouthPath = (shape: MouthShape, openAmount: number) => {
    const cx = 50; const cy = 40; const w = 20;
    const currentW = shape === 'd' ? w * (1 - openAmount * 0.25) : w;

    switch (shape) {
      case 'd': // Speaking / Shouting
      case 'bigSmile': 
        const h = shape === 'd' ? (openAmount * 18 + 4) : 15;
        return `M ${cx-currentW},${cy} Q ${cx},${cy+h} ${cx+currentW},${cy} Z`; 
      case 'o':
        return `M ${cx-8},${cy+5} Q ${cx},${cy+18} ${cx+8},${cy+5} Q ${cx},${cy-8} ${cx-8},${cy+5}`;
      case 'sad':
        return `M ${cx-w},${cy+10} Q ${cx},${cy} ${cx+w},${cy+10}`;
      case 'flat':
        return `M ${cx-10},${cy+8} L ${cx+10},${cy+8}`;
      case 'zigZag':
        return `M ${cx-15},${cy+8} L ${cx-5},${cy+4} L ${cx+5},${cy+12} L ${cx+15},${cy+8}`;
      case 'smirkLeft':
        return `M ${cx-w},${cy+5} Q ${cx},${cy+10} ${cx+w},${cy}`;
      case 'smirkRight':
        return `M ${cx-w},${cy} Q ${cx},${cy+10} ${cx+w},${cy+5}`;
      case 'cat':
        return `M ${cx-10},${cy+5} Q ${cx-5},${cy+10} ${cx},${cy+5} Q ${cx+5},${cy+10} ${cx+10},${cy+5}`;
      case 'smile':
      default:
        return `M ${cx-w},${cy+5} Q ${cx},${cy+15} ${cx+w},${cy+5}`;
    }
  };

  const renderEye = (isLeft: boolean) => {
    const openness = isLeft ? currentMood.leftEyeOpen : currentMood.rightEyeOpen;
    const rotation = isLeft ? currentMood.eyeRotation : -currentMood.eyeRotation;
    
    const targetX = currentMood.pupilX !== undefined ? currentMood.pupilX : pupilPos.x;
    const targetY = currentMood.pupilY !== undefined ? currentMood.pupilY : pupilPos.y;

    if (currentMood.isHeartEyes) {
        return (
            <div 
                className="relative w-16 h-20 flex items-center justify-center transition-transform duration-500"
                style={{ transform: `rotate(${rotation}deg)` }}
            >
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)] animate-pulse">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
               </svg>
            </div>
        );
    }

    return (
      <div 
        className="relative w-16 h-20 bg-white rounded-full overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-transform duration-500"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* PUPIL - Updated with cubic-bezier for smoother movement */}
        <div 
            className="absolute top-1/2 left-1/2 w-8 h-9 bg-slate-800 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{ 
                transform: `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px))`,
                backgroundColor: state === 'listening' ? '#10b981' : state === 'processing' ? '#3b82f6' : state === 'speaking' ? '#ec4899' : '#1e293b'
            }}
        >
             <div className="absolute top-1 right-2 w-2 h-3 bg-white opacity-90 rounded-full rotate-12" />
        </div>

        {/* EYELIDS - Updated duration for smoother blinks */}
        <div 
            className="absolute top-0 left-0 w-full bg-black transition-all duration-300 ease-in-out"
            style={{ height: `${(1 - openness) * 55}%` }}
        />
        <div 
            className="absolute bottom-0 left-0 w-full bg-black transition-all duration-300 ease-in-out"
            style={{ height: `${(1 - openness) * 45}%` }}
        />
      </div>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center animate-float transition-transform duration-500 transform scale-75 landscape:scale-75 md:scale-100 lg:scale-110 origin-center">
      {/* AURA */}
      <div className={`absolute inset-0 rounded-full blur-[70px] opacity-20 transition-colors duration-1000 ${
         state === 'listening' ? 'bg-emerald-500' :
         state === 'speaking' ? 'bg-pink-500' :
         state === 'processing' ? 'bg-blue-600' : 
         currentMood.id.includes('angry') ? 'bg-red-500' : 
         currentMood.isHeartEyes ? 'bg-pink-600' : 'bg-slate-400'
      }`} style={{ width: '120%', height: '120%' }} />

      <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="flex gap-8">
             {renderEye(true)}
             {renderEye(false)}
          </div>

          {/* BLUSH */}
          <div className="absolute top-[4.5rem] w-full flex justify-center gap-20 pointer-events-none">
             <div className={`w-12 h-6 bg-pink-500/40 blur-xl rounded-full transition-opacity duration-1000 ${currentMood.blush ? 'opacity-100' : 'opacity-0'}`} />
             <div className={`w-12 h-6 bg-pink-500/40 blur-xl rounded-full transition-opacity duration-1000 ${currentMood.blush ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          <div className="h-12 w-full flex justify-center -mt-2">
            <svg width="100" height="60" viewBox="0 0 100 60" className="overflow-visible">
              <path 
                d={getMouthPath(currentMood.mouthShape, mouthOpen)} 
                fill={state === 'speaking' || ['o', 'd', 'bigSmile'].includes(currentMood.mouthShape) ? '#334155' : 'transparent'} 
                stroke="white" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`transition-all ease-out ${state === 'speaking' ? 'duration-100' : 'duration-300'}`}
                style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.3))' }}
              />
            </svg>
          </div>
      </div>
    </div>
  );
};

export default ViViFace;
