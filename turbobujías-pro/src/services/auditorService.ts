import { GoogleGenAI } from "@google/genai";

export interface AuditResult {
  isAccurate: boolean;
  refinedContent: string;
  correctionsMade: string[];
}

class AuditorService {
  private aiClient: GoogleGenAI | null = null;

  private getGenAI() {
    if (!this.aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }
    return this.aiClient;
  }

  /**
   * Performs a technical audit on a draft AI response.
   * Compares the draft against the physical RAG context provided.
   */
  async auditResponse(
    userQuery: string,
    draftResponse: string,
    contextInfo: string
  ): Promise<AuditResult> {
    try {
      const prompt = `
        YOU ARE THE TURBOBUJÍAS PRO TECHNICAL AUDITOR AGENT.
        
        YOUR MISSION:
        1. Review the DRAFT RESPONSE provided below.
        2. Compare it against the TECHNICAL CONTEXT (RAG data).
        3. Identify any technical hallucinations, incorrect Part IDs, or inaccurate partner recommendations.
        4. If the response is accurate, return it as is.
        5. If there are errors, provide a REFINED version that strictly adheres to the context.
        6. IMPORTANT: The refinedContent MUST NOT contain any reasoning chains, '<reasoning>' tags, or text like "**RAZONAMIENTO TÉCNICO:**". Just the final clear answer to the user.
        
        TECHNICAL CONTEXT (The Truth):
        ${contextInfo}
        
        USER ORIGINAL QUERY:
        ${userQuery}
        
        DRAFT RESPONSE TO AUDIT:
        ${draftResponse}
        
        RESPONSE FORMAT (JSON ONLY):
        {
          "isAccurate": boolean,
          "refinedContent": "string",
          "correctionsMade": ["list", "of", "corrections"]
        }
      `;

      const ai = this.getGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Auditor model");
      }

      try {
        const auditData = JSON.parse(responseText);
        return {
          isAccurate: auditData.isAccurate ?? true,
          refinedContent: auditData.refinedContent || draftResponse,
          correctionsMade: auditData.correctionsMade || []
        };
      } catch (parseErr) {
        console.warn('Auditor JSON parse failure - falling back to draft');
        return {
          isAccurate: true,
          refinedContent: draftResponse,
          correctionsMade: []
        };
      }
    } catch (err: any) {
      // Only log if it's not a transient RPC error to avoid flooding
      if (!err?.message?.includes('Rpc failed')) {
        console.error('Auditor Agent Failure:', err);
      }
      return {
        isAccurate: true, // Fail-safe: return draft if auditor fails
        refinedContent: draftResponse,
        correctionsMade: []
      };
    }
  }
}

export const auditorService = new AuditorService();
