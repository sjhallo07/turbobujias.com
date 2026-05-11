import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { toggleWishlist, setWishlistOpen } from '../store/wishlistSlice';
import { addToCart } from '../store/cartSlice';
import { formatPrice } from '../lib/utils';

export function WishlistDrawer() {
  const dispatch = useDispatch();
  const { items: wishlistItems, isOpen } = useSelector((state: RootState) => state.wishlist);
  const { rates, selectedCurrency } = useSelector((state: RootState) => state.currency);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="wishlist-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dispatch(setWishlistOpen(false))}
          className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm"
        />
      )}
      {isOpen && (
        <motion.div 
          key="wishlist-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-md bg-neutral-900 shadow-2xl border-l border-neutral-800"
        >
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="text-orange-500 fill-current" size={24} />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Your Wishlist</h2>
                </div>
                <button onClick={() => dispatch(setWishlistOpen(false))} className="p-2 text-neutral-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {wishlistItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600">
                    <Heart size={64} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">Your wishlist is empty</p>
                    <p className="text-sm">Save parts you're interested in for later.</p>
                  </div>
                ) : (
                  wishlistItems.map((product, idx) => (
                    <div key={`wish-item-${product.internalId || product.id}-${idx}`} className="flex gap-4 group">
                      <div className="w-20 h-20 rounded-none overflow-hidden bg-neutral-800 border border-neutral-700 shrink-0">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-orange-500 tracking-tight leading-none mb-1 text-[10px] uppercase tracking-widest">{product.brand}</h4>
                        <p className="text-white font-medium text-sm line-clamp-1">{product.name}</p>
                        <p className="text-neutral-400 font-mono text-xs mt-1">{formatPrice(product.price, selectedCurrency, rates)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button 
                            onClick={() => {
                              dispatch(addToCart(product));
                              dispatch(toggleWishlist(product));
                            }}
                            className="text-[10px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                          >
                            Move to Cart
                            <ArrowRight size={12} />
                          </button>
                          <span className="text-neutral-700">|</span>
                          <button 
                            onClick={() => dispatch(toggleWishlist(product))}
                            className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-6 bg-neutral-950 border-t border-neutral-800">
                <button 
                  onClick={() => dispatch(setWishlistOpen(false))}
                  className="w-full bg-neutral-800 text-white py-4 rounded-none font-black uppercase tracking-wider hover:bg-neutral-700 transition-all border border-neutral-700"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
