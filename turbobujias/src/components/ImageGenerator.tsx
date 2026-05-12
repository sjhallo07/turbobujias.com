import { useState } from 'react';
import { generateProductImage } from '../services/imageGenerationService';
import { Loader2, Wand2 } from 'lucide-react';

export function ImageGenerator({ onGenerate }: { onGenerate: (url: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const url = await generateProductImage({ prompt });
      onGenerate(url);
    } catch (e) {
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border border-neutral-800 bg-neutral-900 rounded-xl space-y-4">
      <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-orange-500" />
        Generate Product Asset
      </h3>
      <textarea
        className="w-full h-24 p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-orange-500"
        placeholder="Describe the image you want (e.g., A minimalist ceramic vase on a wooden table, studio lighting, photorealistic)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Image'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
