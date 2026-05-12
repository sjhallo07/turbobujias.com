import { GoogleGenAI } from "@google/genai";

// Initialize the AI SDK. The environment variable GEMINI_API_KEY
// is required and will be supplied by the platform.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "512px" | "1K" | "2K" | "4K";
}

export async function generateProductImage(options: ImageGenerationOptions): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: options.prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: options.aspectRatio || "1:1",
          imageSize: options.imageSize || "1K"
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    throw new Error('No image generated');
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}
