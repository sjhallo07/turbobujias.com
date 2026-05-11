import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, SyntheticEvent } from 'react';
import { ShoppingCart, Plus, Info, Scale, Heart, Star, Check, Zap } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../store/cartSlice';
import { toggleWishlist } from '../store/wishlistSlice';
import { RootState } from '../store';
import { Product } from '../data';
import { cn, formatPrice } from '../lib/utils';

export interface ProductCardProps {
  product: Product & { matchType?: string };
  onOpenDetails: (p: Product) => void;
  isComparing: boolean;
  onToggleCompare: (p: Product) => void;
}

export const ProductCard = ({ 
  product, 
  onOpenDetails, 
  isComparing, 
  onToggleCompare 
}: ProductCardProps) => {
  console.log(`RENDER_PRODUCT_ID: ${product.id}`);
  const dispatch = useDispatch();
  const { rates, selectedCurrency } = useSelector((state: RootState) => state.currency);
  const isWishlisted = useSelector((state: RootState) => 
    state.wishlist.items.some(item => item.id === product.id)
  );
  const reviews = useSelector((state: RootState) => state.reviews.items);
  const filteredReviews = useMemo(() => reviews.filter(r => r.productId === product.id), [reviews, product.id]);
  
  const avgRating = filteredReviews.length > 0 
    ? filteredReviews.reduce((s, r) => s + r.rating, 0) / filteredReviews.length 
    : 4.5 + (Math.random() * 0.5); // Mock initial rating for style
  const reviewCount = filteredReviews.length > 0 ? filteredReviews.length : Math.floor(Math.random() * 40) + 10;

  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleQuickAdd = () => {
    dispatch(addToCart(product));
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  };

  const brandLogos: Record<string, string> = {
    'NGK': '/ngk.jpg',
    'Denso': '/denso.png',
    'Bosch': '/bosch.jpg',
    'Autolite': '/autolite.png',
    'Champion': '/champion.jpg',
    'Cummins': '/cummins.png',
    'Fram': '/motorcraft.jpg',
    'Motorcraft': '/motorcraft.jpg',
    'MSD': '/msd.png',
  };

  const handleImageError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite loop if fallback also fails
    if (e.currentTarget.dataset.errorFallback) return;
    e.currentTarget.dataset.errorFallback = 'true';
    e.currentTarget.src = brandLogos[product.brand] || '/logotipo.png';
    e.currentTarget.className = "w-full h-full object-contain p-8 bg-neutral-900"; // Add padding and contain for better display of logo
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      itemScope
      itemType="https://schema.org/Product"
      className={cn(
        "group bg-neutral-900 border overflow-hidden transition-all flex flex-col h-full hover:-translate-y-1 relative rounded-none",
        isComparing ? "border-orange-500 shadow-lg shadow-orange-500/10" : "border-neutral-800 hover:border-neutral-700"
      )}
    >
      {/* Action Buttons Overlay */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Comparison Toggle */}
        <button
          onClick={() => onToggleCompare(product)}
          title="Toggle Compare"
          className={cn(
            "p-2.5 sm:p-3 rounded-sm transition-all border backdrop-blur-md",
            isComparing 
              ? "bg-orange-500 text-white border-orange-400" 
              : "bg-black/40 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-800"
          )}
        >
          <Scale size={16} className="sm:w-5 sm:h-5" />
        </button>

        {/* Wishlist Toggle */}
        <button
          onClick={() => dispatch(toggleWishlist(product))}
          title="Toggle Wishlist"
          className={cn(
            "p-2.5 sm:p-3 rounded-sm transition-all border backdrop-blur-md",
            isWishlisted 
              ? "bg-red-500 text-white border-red-400" 
              : "bg-black/40 text-neutral-400 border-neutral-700 hover:text-red-500 hover:bg-neutral-800"
          )}
        >
          <Heart size={16} className={cn("sm:w-5 sm:h-5", isWishlisted && "fill-current")} />
        </button>
      </div>

      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden bg-neutral-800 cursor-pointer" onClick={() => onOpenDetails(product)}>
        <motion.img
          whileHover={{ scale: 1.15 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
          src={product.image || 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800'}
          onError={handleImageError}
          alt={product.name}
          itemProp="image"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        {/* Quick View Overlay Button */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(product);
            }}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-none pointer-events-auto transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl"
          >
            <Info size={18} />
            Quick View
          </motion.button>
        </div>
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
          {product.matchType === 'rag' && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded-[2px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-blue-500/20 w-fit">
              <Zap size={10} className="fill-current" />
              AI Verified
            </span>
          )}
          {product.tags && product.tags.map((tag, tIdx) => (
            <span key={`${product.id}-tag-${tIdx}`} className="bg-orange-600 text-white px-2 py-1 rounded-[2px] text-[10px] font-black uppercase tracking-wider w-fit shadow-lg shadow-orange-500/20">
              {tag}
            </span>
          ))}
          {product.stock < 10 && product.stock > 0 && (
            <span className="bg-white text-black px-2 py-1 rounded-[2px] text-[10px] font-black uppercase tracking-wider w-fit">
              Low Stock
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          {/* Rating Microdata */}
          <div itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating" className="flex items-center gap-1.5">
            <meta itemProp="ratingValue" content={avgRating.toString()} />
            <meta itemProp="reviewCount" content={reviewCount.toString()} />
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={`star-${product.internalId || product.id}-${i}`} 
                  size={8} 
                  className={cn(
                    "fill-current sm:w-[10px] sm:h-[10px]",
                    i < Math.floor(avgRating) ? "text-orange-500" : "text-neutral-700"
                  )} 
                />
              ))}
            </div>
          </div>
          <span className="text-[8px] sm:text-[10px] font-mono text-neutral-500 uppercase tracking-widest leading-none">({reviewCount})</span>
        </div>
        <div className="mb-2">
          <span itemProp="category" className="text-orange-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest block mb-0.5 sm:mb-1">{product.category}</span>
          <div className="flex items-center justify-between gap-2">
            <h3 itemProp="name" className="text-white font-medium group-hover:text-orange-400 transition-colors line-clamp-1 flex-1 text-sm sm:text-base">{product.name}</h3>
            {brandLogos[product.brand] && (
              <div className="bg-white p-0.5 rounded-sm h-4 w-7 sm:h-5 sm:w-8 flex items-center justify-center shrink-0">
                <img 
                  src={brandLogos[product.brand]}
                  alt={product.brand} 
                  title={product.brand}
                  className="w-full h-full object-contain" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>
          <meta itemProp="brand" content={product.brand} />
        </div>

        <p itemProp="description" className="text-neutral-500 text-xs line-clamp-2 mb-4 flex-1">
          {product.description}
        </p>

        <div className="flex items-center justify-between gap-2 mt-auto" itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <div className="flex flex-col">
            <span className="text-neutral-500 text-[8px] sm:text-[10px] uppercase font-bold tracking-tighter leading-none mb-0.5">Price</span>
            <span className="text-white font-mono text-base sm:text-lg leading-none">
              <meta itemProp="priceCurrency" content={selectedCurrency || "USD"} />
              <span itemProp="price" content={product.price.toString()}>
                {formatPrice(product.price, selectedCurrency, rates)}
              </span>
            </span>
          </div>

          <div className="flex gap-1.5 flex-1 justify-end">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickAdd}
              title="Add to Cart"
              className={cn(
                "flex-1 max-w-[100px] sm:max-w-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-none font-bold text-xs sm:text-sm transition-all shadow-lg",
                showConfirmation 
                  ? "bg-green-500 text-white shadow-green-500/20" 
                  : "bg-white text-black hover:bg-orange-500 hover:text-white shadow-white/5"
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={showConfirmation ? 'check' : 'plus'}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1 sm:gap-2"
                >
                  {showConfirmation ? (
                    <>
                      <Check size={14} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="whitespace-nowrap">Added</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="whitespace-nowrap">Add</span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
