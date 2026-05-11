import React from 'react';
import { motion } from 'motion/react';
import { Home, Search, ShoppingBag, Bookmark, Menu, Camera } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { toggleCart } from '../store/cartSlice';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: 'home' | 'search' | 'wishlist' | 'profile';
  onTabChange: (tab: 'home' | 'search' | 'wishlist' | 'profile') => void;
  onSearchClick: () => void;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onScannerClick?: () => void;
}

export function BottomNav({ activeTab, onTabChange, onSearchClick, onWishlistClick, onCartClick, onScannerClick }: BottomNavProps) {
  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm">
      <div className="absolute inset-0 bg-orange-500/10 blur-3xl -z-10 rounded-full" />
      <nav className="bg-black/90 backdrop-blur-2xl border border-neutral-800/50 rounded-3xl p-2.5 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => onTabChange('home')}
          className={cn(
            "relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-colors duration-300",
            activeTab === 'home' ? "text-orange-500" : "text-neutral-500"
          )}
        >
          {activeTab === 'home' && (
            <motion.div 
              layoutId="activeTabMobile"
              className="absolute inset-0 bg-orange-500/10 border border-orange-500/20 rounded-2xl"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Home size={20} fill={activeTab === 'home' ? "currentColor" : "none"} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Home</span>
        </motion.button>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onSearchClick}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl text-neutral-500 hover:text-white"
        >
          <Search size={20} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Search</span>
        </motion.button>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onScannerClick}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl text-neutral-500 hover:text-white"
        >
          <Camera size={20} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Scan</span>
        </motion.button>

        <div className="relative -top-8 px-1">
          <motion.button 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.8 }}
            onClick={onCartClick}
            className="w-14 h-14 bg-orange-500 text-white rounded-3xl flex items-center justify-center shadow-[0_10px_20px_rgba(249,115,22,0.4)] relative border-4 border-black"
          >
            <ShoppingBag size={24} />
            {totalItems > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white text-orange-600 text-[9px] font-black rounded-full flex items-center justify-center shadow-lg"
              >
                {totalItems}
              </motion.span>
            )}
          </motion.button>
        </div>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onWishlistClick}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl text-neutral-500 hover:text-white"
        >
          <Bookmark size={20} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Saved</span>
        </motion.button>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => onTabChange('profile')}
          className={cn(
            "relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-colors duration-300",
            activeTab === 'profile' ? "text-orange-500" : "text-neutral-500"
          )}
        >
          {activeTab === 'profile' && (
            <motion.div 
              layoutId="activeTabMobile"
              className="absolute inset-0 bg-orange-500/10 border border-orange-500/20 rounded-2xl"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Menu size={20} />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Menu</span>
        </motion.button>
      </nav>
    </div>
  );
}
