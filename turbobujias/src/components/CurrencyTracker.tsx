import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchExchangeRates } from '../store/currencySlice';
import { RootState } from '../store';
import { RefreshCw, TrendingUp, Globe } from 'lucide-react';

export function CurrencyTracker() {
  const dispatch = useDispatch();
  const { rates, lastUpdated, isLoading } = useSelector((state: RootState) => state.currency);

  const fetchRates = () => {
    dispatch(fetchExchangeRates() as any);
  };

  useEffect(() => {
    fetchRates();
    // Refresh every 24 hours (86400000 ms)
    const interval = setInterval(fetchRates, 86400000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black border-y border-neutral-800 px-4 py-2 flex items-center justify-between overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <Globe size={12} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">BCV Integration</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500">USD/VES:</span>
            <span className="text-[10px] font-black text-white">{rates.VES.toFixed(2)}</span>
            <TrendingUp size={10} className="text-green-500" />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500">EUR/VES:</span>
            <span className="text-[10px] font-black text-white">{rates.EUR.toFixed(2)}</span>
            <TrendingUp size={10} className="text-green-500" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="text-[9px] font-medium text-neutral-600 italic">
          Last Sync: {lastUpdated || 'Never'}
        </span>
        <button 
          onClick={fetchRates}
          disabled={isLoading}
          className="p-1.5 hover:bg-neutral-800 rounded-none transition-colors group"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin text-orange-500" : "text-neutral-500 group-hover:text-orange-500"} />
        </button>
      </div>
    </div>
  );
}
