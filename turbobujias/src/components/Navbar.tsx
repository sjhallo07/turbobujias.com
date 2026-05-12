import { ShoppingCart, Search, Menu, User, Heart, Truck, ExternalLink, Globe, Sun, Moon, Scale, Camera, X } from 'lucide-react';
import React from 'react';
import { motion } from 'motion/react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setWishlistOpen } from '../store/wishlistSlice';
import { setSelectedCurrency } from '../store/currencySlice';
import { selectCartTotalItems } from '../store/cartSlice';
import { cn } from '../lib/utils';

interface NavbarProps {
  onCartClick: () => void;
  onSearchChange: (val: string) => void;
  searchValue: string;
  onAuthClick: () => void;
  onAdminDashboardClick?: () => void;
  onScannerClick?: () => void;
}

export function Navbar({ onCartClick, onSearchChange, searchValue, onAuthClick, onAdminDashboardClick, onScannerClick }: NavbarProps) {
  const dispatch = useDispatch();
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const user = useSelector((state: RootState) => state.auth.user);
  const cartCount = useSelector(selectCartTotalItems);
  const wishlistCount = useSelector((state: RootState) => state.wishlist.items.length);
  const { selectedCurrency } = useSelector((state: RootState) => state.currency);

  const handleHomeClick = () => {
    onSearchChange('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button 
          onClick={handleHomeClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0 group/logo"
        >
          <img src="/logotipo.png" alt="TurboBujías Logo" className="h-10 md:h-12 w-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] group-hover/logo:drop-shadow-[0_0_12px_rgba(249,115,22,0.3)] transition-all" />
        </button>

        {/* Currency Switcher Dropdown */}
        <div className="hidden lg:flex items-center gap-2 group relative">
          <Globe size={14} className="text-neutral-500" />
          <select
            value={selectedCurrency}
            onChange={(e) => dispatch(setSelectedCurrency(e.target.value as any))}
            className="bg-black border border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white px-2 py-1 outline-none hover:border-orange-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="USD">USD ($)</option>
            <option value="VES">VES (Bs.)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
            {/* Custom arrow if needed, but standard appearance-none might hide it */}
          </div>
        </div>

        {/* Mercado Libre Link - Web Only/Prominent */}
        <a 
          href="https://www.mercadolibre.com.ve/pagina/turbobujias3646#from=share_eshop" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-2 bg-[#FFF159] text-[#2D3277] px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#ffe600] transition-colors rounded-none border-b-2 border-[#2D3277]/20"
        >
          <Truck size={14} />
          <span>Compra con Envío Gratis</span>
        </a>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-xl relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input
            id="search-input"
            type="text"
            placeholder="Buscar repuestos, marcas o referencias..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-neutral-800 text-neutral-200 pl-10 pr-20 py-2 rounded-none border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchValue && (
              <button
                onClick={() => onSearchChange('')}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
            {onScannerClick && (
              <button
                onClick={onScannerClick}
                className="p-2 text-neutral-500 hover:text-orange-500 transition-colors"
                title="Escaneo QR / Código de Barras"
              >
                <Camera size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAuthClick}
            className="group relative flex items-center gap-2 p-2 bg-neutral-800 text-neutral-400 hover:text-white rounded-none border border-neutral-700 transition-all"
            title="User Profile"
          >
            {user ? (
              <>
                <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">{user.displayName?.split(' ')[0] || 'Perfil'}</span>
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-5 h-5 rounded-full" />
                ) : (
                  <User size={18} />
                )}
              </>
            ) : (
              <User size={22} className="group-hover:scale-110 transition-transform" />
            )}
          </motion.button>

          {user?.role === 'admin' && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAdminDashboardClick}
              className="hidden lg:flex items-center gap-2 p-2 bg-orange-500 text-white rounded-none hover:bg-orange-600 transition-all"
              title="Admin Control Hub"
            >
              <Scale size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Panel de Control</span>
            </motion.button>
          )}

          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => dispatch(setWishlistOpen(true))}
            className="relative p-2 text-neutral-400 hover:text-white transition-colors"
            title="Wishlist"
          >
            <Heart size={22} />
            {wishlistCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              >
                {wishlistCount}
              </motion.span>
            )}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCartClick}
            className="relative p-2 text-neutral-400 hover:text-white transition-colors"
            title="Shopping Cart"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>

          <button 
            className="md:hidden p-2 text-neutral-400 hover:text-white"
            title="Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>
    </nav>
  );
}
