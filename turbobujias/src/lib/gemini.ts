import { getAIResponse } from './ai';

export const generateTechnicalInsight = async (query: string) => {
  try {
    return await getAIResponse(query);
  } catch (error: any) {
    console.error('AI Insight Error:', error);
    return 'Could not generate technical insight at this time. Please try again later.';
  }
};
