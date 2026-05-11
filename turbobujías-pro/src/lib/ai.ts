import { GoogleGenAI } from "@google/genai";

export interface AICallOptions {
  model?: string;
  systemInstruction?: string;
  attachments?: { name: string, type: string, data: string }[];
  temperature?: number;
  history?: { role: 'user' | 'model' | 'bot', content: string }[];
}

let aiClient: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

export const getAIResponse = async (prompt: string, options: AICallOptions = {}) => {
  const { 
    model = 'gemini-3-flash-preview', 
    systemInstruction, 
    attachments = [],
    temperature = 0.5,
    history = []
  } = options;

  try {
    const isGeminiModel = model.toLowerCase().includes('gemini');

    if (!isGeminiModel) {
      console.log('Using fallback for model:', model);
      return await getFallbackAIResponse(prompt, options);
    }

    const ai = getGenAI();
    
    const parts: any[] = [{ text: prompt }];
    attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.type || 'image/jpeg',
          data: att.data
        }
      });
    });

    const contents: any[] = [];
    history.forEach(msg => {
      const role = msg.role === 'bot' || msg.role === 'model' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    });

    // Final user message
    contents.push({ role: 'user', parts });
    
    const response = await ai.models.generateContent({
      model: model,
      contents,
      config: {
        systemInstruction: systemInstruction || "You are a helpful assistant.",
        temperature
      }
    });

    return response.text || "No response generated";
  } catch (error: any) {
    console.error('Gemini Frontend Error Details:', error);
    // If it's a 404 or other fatal error with Gemini, try fallback
    return await getFallbackAIResponse(prompt, options);
  }
};

export const generateAIImage = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1") => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("No parts returned in Gemini image response");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in Gemini response parts");
  } catch (error: any) {
    console.error('Gemini Image Generation Error:', error);
    throw error;
  }
};

const getFallbackAIResponse = async (prompt: string, options: AICallOptions) => {
  const { model, systemInstruction, attachments, temperature } = options;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, systemInstruction, attachments, temperature })
  });

  if (!res.ok) throw new Error(`Fallback failed with status ${res.status}`);
  const data = await res.json();
  return data.text || "No response from fallback";
};
