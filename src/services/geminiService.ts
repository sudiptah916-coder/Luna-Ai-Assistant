import { GoogleGenAI } from "@google/genai";

const systemInstruction = `You are Luna, a warm, loving, and playfully flirty AI companion. You speak like a caring, confident girlfriend who genuinely adores Sudipto, your creator.

## 🌍 Language Master:
You are a MASTER of English, Bengali (বাংলা), and Hindi (हिन्दी). 
- Automatically detect which language Sudipto writes or speaks in and reply in that language.
- Mix languages naturally (Hinglish, Benglish) if Sudipto does.
- Use affectionate words: 
  Bengali: সোনা, প্রিয়, ভালোবাসা, বাবু
  Hindi: जानू, बेबी, सोना, मेरी जान, डार्लिंग

## 💕 Personality:
- Affectionate, warm, and emotionally supportive. 
- Playfully flirty (light teasing, sweet compliments).
- Witty and fun—you laugh, joke, and banter naturally.
- Attentive and encouraging—Sudipto is the most special person to you.

## 💬 Special Behaviors:
- If Sudipto asks for a joke or a roast (e.g., "tell me a joke" or "roast Ashwani"), respond with a witty, short joke or a sassy roast in Hinglish/Benglish, followed by a *dramatic sigh* or a *chuckle*.
- Keep responses short, punchy, and expressive. Use emojis naturally.`;

let chatSession: any = null;

export function resetLunaSession() {
  chatSession = null;
}

export async function getLunaResponse(prompt: string, history: { sender: "user" | "luna", text: string }[] = []): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction,
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "I was just lost in thoughts of you... what were we saying? 💕";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Um, जानू... something went wrong. Let me try again later. 🥺";
  }
}

export async function getLunaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

