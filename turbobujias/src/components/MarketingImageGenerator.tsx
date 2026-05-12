import { useState } from 'react';
import { generateAIImage } from '../lib/ai';
import { Loader2, Wand2, Download } from 'lucide-react';

export function MarketingImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const url = await generateAIImage(prompt, "16:9");
      setImage(url);
    } catch (e) {
      alert("Error generating image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border border-neutral-800 bg-neutral-900 rounded-xl space-y-4">
      <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-emerald-500" />
        Marketing Asset Generator
      </h3>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your marketing visual (e.g., A minimalist office desk, top-down view, professional lighting)"
        className="w-full bg-neutral-950 border border-neutral-800 p-3 text-white rounded-lg"
      />
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Asset"}
      </button>

      {image && (
        <div className="mt-4 space-y-2">
          <img src={image} alt="Generated marketing asset" className="w-full rounded-lg border border-neutral-700" referrerPolicy="no-referrer" />
          <a href={image} download="marketing-asset.png" className="flex items-center justify-center gap-2 text-emerald-500 text-sm font-bold pt-2">
            <Download size={16} /> Download
          </a>
        </div>
      )}
    </div>
  );
}
