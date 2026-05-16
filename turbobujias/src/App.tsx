import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';
import { useSelector, useDispatch } from 'react-redux';
import { X, ShoppingBag, Trash2, ArrowRight, Package, Calculator, Camera, Search, Check, Plus, Instagram, MessageCircle, Zap, Scale, Archive, Bookmark, Globe, Loader2, LayoutDashboard, Truck } from 'lucide-react';
import { PRODUCTS, Product } from './data';
import { expandSearchQuery } from './utils/searchUtils';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
const ChatBot = React.lazy(() => import('./components/ChatBot'));
const CheckoutModal = React.lazy(() => import('./components/CheckoutModal'));
const WishlistDrawer = React.lazy(() => import('./components/WishlistDrawer'));
const ScannerModal = React.lazy(() => import('./components/ScannerModal'));
import { CurrencyTracker } from './components/CurrencyTracker';
import { Reviews } from './components/Reviews';
import { RootState } from './store';
import { addToCart, removeFromCart, toggleCart as setToggleCart, saveForLater, moveToCart, removeFromSaved, updateQuantity, selectCartTotalItems, selectCartTotalAmount } from './store/cartSlice';
import { generateTechnicalInsight } from './lib/gemini';
import { cn, formatPrice, serializeUserDoc } from './lib/utils';

import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { setUser } from './store/authSlice';
import { fetchExchangeRates, setSelectedCurrency } from './store/currencySlice';
import { AuthModal } from './components/AuthModal';

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const UserSessionDrawer = React.lazy(() => import('./components/UserSessionDrawer'));
import { PartnerShowcase } from './components/PartnerShowcase';
const MapSearch = React.lazy(() => import('./components/MapSearch'));
import { ProductSkeleton } from './components/ProductSkeleton';

import { aiSearch } from './services/aiSearchService';
import { BottomNav } from './components/BottomNav';

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserSessionOpen, setIsUserSessionOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          // Fetch additional data like role
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          
          const role = (adminDoc.exists() || firebaseUser.email === 'marcossmora528@gmail.com') ? 'admin' : 'customer';
          
          // Auto-promote specifically for the requested developer email
          if (firebaseUser.email === 'marcossmora528@gmail.com' && !adminDoc.exists()) {
            await setDoc(doc(db, 'admins', firebaseUser.uid), { uid: firebaseUser.uid, email: firebaseUser.email });
          }

          const userDataRaw = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: role as 'customer' | 'admin',
            ...(userDoc.exists() ? userDoc.data() : {}),
          };

          const userData = serializeUserDoc(userDataRaw);
          dispatch(setUser(userData as any));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      } else {
        dispatch(setUser(null));
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  const cart = useSelector((state: RootState) => state.cart.items);
  const cartTotalItems = useSelector(selectCartTotalItems);
  const cartTotalAmount = useSelector(selectCartTotalAmount);
  const savedItems = useSelector((state: RootState) => state.cart.savedItems);
  const isCartOpen = useSelector((state: RootState) => state.cart.isOpen);
  const { rates, selectedCurrency } = useSelector((state: RootState) => state.currency);

  useEffect(() => {
    dispatch(fetchExchangeRates() as any);
  }, [dispatch]);

  const [search, setSearch] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'wishlist' | 'profile'>('home');

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // SEO Calculation
  const seoTitle = useMemo(() => {
    if (selectedProduct) return `${selectedProduct.name} | ${selectedProduct.brand} | TurboBujías`;
    return "TurboBujías | Premium Automotive Spare Parts & Spark Plugs";
  }, [selectedProduct]);

  const seoDescription = useMemo(() => {
    if (selectedProduct) {
      return `Buy ${selectedProduct.name} by ${selectedProduct.brand}. Premium ${selectedProduct.category} for high-performance automotive engines. ${selectedProduct.description.slice(0, 150)}...`;
    }
    return "Buy high-quality spark plugs, filters, and automotive spare parts. Authorized distributor of NGK, Denso, Bosch. Real-time BCV currency tracking and international shipping.";
  }, [selectedProduct]);

  const seoKeywords = useMemo(() => {
    if (selectedProduct) {
      return `${selectedProduct.name}, ${selectedProduct.brand}, ${selectedProduct.category}, automotive parts, spark plugs, ${selectedProduct.brand} parts, TurboBujías`;
    }
    return "automotive parts, spark plugs, NGK, Denso, Bosch, filters, Venezuela, BCV rate, car maintenance";
  }, [selectedProduct]);

  const structuredData = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": selectedProduct.name,
      "image": [selectedProduct.image],
      "description": selectedProduct.description,
      "sku": selectedProduct.specs.sku || selectedProduct.id,
      "brand": {
        "@type": "Brand",
        "name": selectedProduct.brand
      },
      "offers": {
        "@type": "Offer",
        "url": window.location.href,
        "priceCurrency": "USD",
        "price": selectedProduct.price,
        "itemCondition": "https://schema.org/NewCondition",
        "availability": selectedProduct.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      }
    };
  }, [selectedProduct]);
  const [crossRefQuery, setCrossRefQuery] = useState('');
  const [crossRefResults, setCrossRefResults] = useState<any[]>([]);
  const [isCrossRefSearching, setIsCrossRefSearching] = useState(false);
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeCategory, selectedBrand, inStockOnly]);

  useEffect(() => {
    const performAiSearch = async () => {
      const searchTerm = search.trim();
      if (!searchTerm || searchTerm.length < 3) {
        setAiSearchResults([]);
        return;
      }
      setIsAiSearching(true);
      try {
        const results = await aiSearch.search(searchTerm);
        setAiSearchResults(results);
      } catch (err) {
        console.error('AI Search Error:', err);
      } finally {
        setIsAiSearching(false);
      }
    };

    const timer = setTimeout(performAiSearch, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleScanSuccess = (decodedText: string) => {
    setSearch(decodedText);
    setTimeout(() => {
      document.getElementById('search-input')?.focus();
      const productsGrid = document.querySelector('main');
      if (productsGrid) {
        productsGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleGenerateInsight = async () => {
    if (!selectedProduct) return;
    setIsGeneratingInsight(true);
    setAiInsight(null); // Clear previous insight
    try {
      const specs = Object.entries(selectedProduct.specs).map(([k, v]) => `${k}: ${v}`).join(', ');
      const prompt = `Provide a professional technical insight for an automotive technician about this part:
      Brand: ${selectedProduct.brand}
      Name: ${selectedProduct.name}
      Specs: ${specs}
      Category: ${selectedProduct.category}
      
      Focus on specialized installation tips, performance expectations, or common diagnostic signs related to this specific type of component. Keep it brief (2-3 sentences).`;
      
      const insight = await generateTechnicalInsight(prompt);
      setAiInsight(insight);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleCrossRefSearch = async () => {
    if (crossRefQuery.length < 3) return;
    setIsCrossRefSearching(true);
    setCrossRefResults([]);
    try {
      const results = await aiSearch.search(crossRefQuery);
      setCrossRefResults(results);
    } catch (err) {
      console.error('Cross Reference Error:', err);
    } finally {
      setIsCrossRefSearching(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    mouseX.set(x);
    mouseY.set(y);
  };

  const transformOrigin = useMotionTemplate`${mouseX}% ${mouseY}%`;

  const categories = ['All', 'Spark Plug', 'Heater', 'Filter'];

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const path = 'products';
      try {
        setIsProductsLoading(true);
        const snapshot = await getDocs(collection(db, path));
        const items = snapshot.docs.map(doc => {
          const data = doc.data() as Product;
          return { ...data, internalId: doc.id, id: data.id || doc.id };
        });
        if (items.length > 0) setFirestoreProducts(items);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      } finally {
        setIsProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const allProducts = useMemo(() => {
    const combined = [...PRODUCTS];
    firestoreProducts.forEach(fp => {
      const idx = combined.findIndex(p => p.id === fp.id);
      if (idx > -1) combined[idx] = fp;
      else combined.push(fp);
    });
    
    // Ensure absolute uniqueness by id
    const seen = new Set<string>();
    return combined.filter(product => {
      if (!product.id || seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }, [firestoreProducts, PRODUCTS]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set(allProducts.map(p => p.brand));
    brands.delete('All');
    const list = ['All', ...Array.from(brands)].sort();
    console.log('BRANDS_LIST:', JSON.stringify(list));
    return list;
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    // If AI results exist and are high confidence, prioritize them
    let baseProducts = allProducts;
    const searchTerm = search.trim();
    
    if (searchTerm.length >= 3 && aiSearchResults.length > 0) {
      baseProducts = aiSearchResults;
    }

    return baseProducts.filter(p => {
      const expandedTerms = expandSearchQuery(searchTerm).map(t => t.toLowerCase());
      
      const matchesSearch = !searchTerm || expandedTerms.some(term => 
                           p.name.toLowerCase().includes(term) || 
                           p.brand.toLowerCase().includes(term) ||
                           p.id.toLowerCase().includes(term) ||
                           p.upc?.includes(term) ||
                           p.ean?.includes(term) ||
                           p.description.toLowerCase().includes(term) ||
                           p.category.toLowerCase().includes(term) ||
                           p.oemNumbers?.some(oem => oem.toLowerCase().includes(term)) ||
                           Object.values(p.specs).some(val => String(val).toLowerCase().includes(term))
      );
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      const matchesBrand = selectedBrand === 'All' || p.brand === selectedBrand;
      const matchesStock = !inStockOnly || p.stock > 0;
      
      return matchesSearch && matchesCategory && matchesBrand && matchesStock;
    });
  }, [search, activeCategory, selectedBrand, inStockOnly, allProducts, aiSearchResults]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    console.log('PRODUCTS_COUNT:', allProducts.length);
    console.log('FILTERED_COUNT:', filteredProducts.length);
  }, [allProducts.length, filteredProducts.length]);

  const toggleCompare = (product: Product) => {
    setCompareList(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.filter(p => p.id !== product.id);
      if (prev.length >= 4) return prev; // Limit to 4 for UX
      return [...prev, product];
    });
  };

  const allSpecKeys = useMemo(() => {
    const keys = new Set<string>();
    compareList.forEach(p => {
      Object.keys(p.specs).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [compareList]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-orange-500/30 selection:text-orange-500 relative transition-colors duration-300">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content={selectedProduct ? "product" : "website"} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={selectedProduct?.image || "https://turbobujias.com/og-image.jpg"} />
        <meta property="og:url" content={window.location.href} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={selectedProduct?.image || "https://turbobujias.com/og-image.jpg"} />

        {/* Structured Data */}
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>
      {/* Global Background Image Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] grayscale bg-[url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1920')] bg-cover bg-center bg-fixed" />
      
      <Navbar 
        onCartClick={() => dispatch(setToggleCart(true))}
        onSearchChange={(val) => {
          setSearch(val);
          if (val === '') {
            setActiveCategory('All');
            setSelectedBrand('All');
          }
        }}
        searchValue={search}
        onAuthClick={() => {
          if (user) setIsUserSessionOpen(true);
          else setIsAuthModalOpen(true);
        }}
        onAdminDashboardClick={() => setIsAdminDashboardOpen(true)}
        onScannerClick={() => setIsScannerOpen(true)}
      />

      <CurrencyTracker />

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Hero Section */}
        <section className="relative mb-12 rounded-none overflow-hidden bg-neutral-900 border border-neutral-800 min-h-[500px] flex items-center">
          <div className="absolute inset-0 z-0">
            <motion.div 
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.4 }}
              transition={{ duration: 2 }}
              className="w-full h-full bg-[url('https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=1920')] bg-cover bg-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 p-6 md:p-16 flex flex-col items-start gap-4 md:gap-6 max-w-4xl">
            <div className="flex items-center gap-4 mb-2 md:mb-4">
              <motion.img 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src="/logotipo.png" 
                alt="Logo" 
                className="h-16 md:h-28 w-auto drop-shadow-[0_0_20px_rgba(249,115,22,0.2)]"
              />
            </div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] sm:leading-[0.85] text-white"
            >
              SMART <br /> 
              <span className="text-blue-500">ADVANCED</span> <br />
              <span className="text-orange-500">TOOL</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-neutral-400 text-base sm:text-lg md:text-xl font-medium max-w-xl"
            >
              El sistema de inteligencia definitivo en combustión y filtración. 
              Basado en excelencia técnica y precisión.
            </motion.p>
            
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="flex flex-col sm:flex-row gap-4 mt-2 sm:mt-4 w-full sm:w-auto"
            >
              <button className="bg-orange-500 text-white px-8 md:px-10 py-4 md:py-5 rounded-none font-black text-xs md:text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 group shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                Explorar Catálogo
                <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
              </button>
              <button className="bg-neutral-900/50 backdrop-blur-md text-white border border-neutral-700 px-8 md:px-10 py-4 md:py-5 rounded-none font-black text-xs md:text-sm uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-3">
                <Archive size={18} className="text-orange-500" />
                Acceso Especialistas
              </button>
            </motion.div>
          </div>
        </section>

        {/* Brands Marquee */}
        <section className="mb-20 overflow-hidden py-10 border-y border-neutral-900">
          <div className="flex items-center gap-8 mb-10">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 whitespace-nowrap">Marcas Autorizadas</span>
            <div className="h-px w-full bg-neutral-900" />
          </div>
          <div className="relative">
            <motion.div 
              animate={{ x: [0, -1200] }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="flex items-center gap-24 whitespace-nowrap"
            >
              {[
                { name: 'NGK', logo: '/ngk.jpg', url: 'https://ngksparkplugs.com/es' },
                { name: 'DENSO', logo: '/denso.png', url: 'https://www.densoautoparts.com/' },
                { name: 'CHAMPION', logo: '/champion.jpg', url: 'https://www.championautoparts.com/es-es/' },
                { name: 'BOSCH', logo: '/bosch.jpg', url: 'https://www.bosch.com/' },
                { name: 'AUTOLITE', logo: '/autolite.png', url: 'https://www.autolite.com/' },
                { name: 'MOTORCRAFT', logo: '/motorcraft.jpg', url: 'https://motorcraft.com.co/' },
                { name: 'CUMMINS', logo: '/cummins.png', url: 'https://www.cummins.com/es-la' },
                { name: 'MSD IGNITION', logo: '/msd.png', url: 'https://www.msdignition.com/' },
                /* Duplicate for seamless marquee */
                { name: 'NGK_2', logo: '/ngk.jpg', url: 'https://ngksparkplugs.com/es', displayName: 'NGK' },
                { name: 'DENSO_2', logo: '/denso.png', url: 'https://www.densoautoparts.com/', displayName: 'DENSO' },
                { name: 'CHAMPION_2', logo: '/champion.jpg', url: 'https://www.championautoparts.com/es-es/', displayName: 'CHAMPION' },
                { name: 'BOSCH_2', logo: '/bosch.jpg', url: 'https://www.bosch.com/', displayName: 'BOSCH' },
                { name: 'AUTOLITE_2', logo: '/autolite.png', url: 'https://www.autolite.com/', displayName: 'AUTOLITE' },
                { name: 'MOTORCRAFT_2', logo: '/motorcraft.jpg', url: 'https://motorcraft.com.co/', displayName: 'MOTORCRAFT' },
                { name: 'CUMMINS_2', logo: '/cummins.png', url: 'https://www.cummins.com/es-la', displayName: 'CUMMINS' },
                { name: 'MSD IGNITION_2', logo: '/msd.png', url: 'https://www.msdignition.com/', displayName: 'MSD IGNITION' }
              ].map((brand, bIdx) => (
                <a key={`brand-marquee-v2-${brand.name}-${bIdx}`} href={brand.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-4 group cursor-pointer">
                  <div className="w-20 h-20 md:w-28 md:h-28 opacity-80 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center p-4 bg-white/5 rounded-none border border-transparent group-hover:border-neutral-800">
                    <img src={brand.logo} alt={brand.displayName || brand.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-neutral-600 group-hover:text-orange-500 transition-colors uppercase">{brand.displayName || brand.name.replace('_2', '')}</span>
                </a>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { title: "Precisión Técnica", desc: "Verificación cruzada con OEM/UPC/EAN para 100% garantía de fabricante.", icon: Scale },
            { title: "Integración BCV", desc: "Tipos de cambio USD/VES/EUR sincronizados en tiempo real del BCV.", icon: Globe },
            { title: "Diagnósticos con IA", desc: "Asistente inteligente con similitud vectorial para diagnósticos automotrices.", icon: Zap },
            { title: "Dashboard Avanzado", desc: "Gestión completa de inventario y marketing asistido por IA.", icon: LayoutDashboard },
            { title: "Soporte Experto", desc: "Asistencia técnica especializada disponible 24/7 vía chat inteligente.", icon: MessageCircle },
            { title: "Logística Global", desc: "Envíos nacionales e internacionales con seguimiento en tiempo real.", icon: Truck }
          ].map((feature, fIdx) => (
            <div key={`feat-item-${feature.title}-${fIdx}`} className="bg-neutral-900 border border-neutral-800 p-8 rounded-none group hover:border-orange-500/50 transition-all border-b-2">
              <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-orange-500 mb-6 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <feature.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 tracking-tight">{feature.title}</h3>
              <p className="text-neutral-500 leading-relaxed text-sm">{feature.desc}</p>
            </div>
          ))}
        </section>

        {/* Filters and Scanner */}
        <div className="flex flex-col mb-8 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest pl-2">Categoría</span>
              <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-none border border-neutral-800 overflow-x-auto no-scrollbar">
                {categories.map((cat, cIdx) => {
                  const esCat = cat === 'All' ? 'Todas' : 
                                cat === 'Spark Plug' ? 'Bujía' : 
                                cat === 'Heater' ? 'Calentador' : 
                                cat === 'Filter' ? 'Filtro' : cat;
                  return (
                  <button
                    key={`cat-filter-${cat}-${cIdx}`}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-none text-xs font-bold uppercase tracking-widest transition-all shrink-0",
                      activeCategory === cat 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/10" 
                        : "text-neutral-500 hover:text-neutral-300"
                    )}
                  >
                    {esCat}
                  </button>
                )})}
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4 sm:mt-0">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest ml-1">Marca</span>
                <select 
                  value={selectedBrand} 
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white focus:border-orange-500 outline-none transition-colors"
                >
                  {uniqueBrands.map((brand, bIdx) => (
                    <option key={`brand-opt-v2-${brand}-${bIdx}`} value={brand}>{brand === 'All' ? 'Todas las marcas' : brand}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 mt-6">
                <input 
                  type="checkbox" 
                  id="stockFilter" 
                  checked={inStockOnly} 
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 bg-neutral-900 border-neutral-800"
                />
                <label htmlFor="stockFilter" className="text-xs font-bold text-neutral-400 uppercase tracking-widest cursor-pointer select-none">
                  Solo en Stock
                </label>
              </div>

              <button 
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2 sm:gap-3 bg-neutral-900 border border-neutral-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-none text-xs sm:text-sm font-bold uppercase tracking-wider hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group mt-6"
              >
                <Camera size={20} className="text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Escanear QR</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Search Status */}
        {isAiSearching && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6 bg-orange-500/10 border border-orange-500/20 p-4 rounded-none shadow-lg shadow-orange-500/5 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <div className="relative flex items-center justify-center">
              <Loader2 size={18} className="text-orange-500 animate-spin" />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-orange-500 rounded-full blur-md"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                Sincronizando con Red Neuronal
              </span>
              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">
                Consultando base de conocimientos TurboBujías...
              </span>
            </div>
            <div className="ml-auto flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={`dot-${i}`}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 bg-orange-500 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Product Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="wait">
            { (isProductsLoading || isAiSearching) ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <motion.div 
                  key={`skeleton-grid-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ProductSkeleton />
                </motion.div>
              ))
            ) : (
              paginatedProducts.map((product, idx) => (
                <motion.div
                  key={`product-card-${product.internalId || product.id}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ProductCard 
                    product={product} 
                    onOpenDetails={setSelectedProduct}
                    isComparing={compareList.some(p => p.id === product.id)}
                    onToggleCompare={toggleCompare}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>

        {filteredProducts.length === 0 && (
          <div className="py-20 text-center">
            <div className="inline-flex p-6 rounded-full bg-neutral-900 mb-4 border border-neutral-800">
              <Search className="text-neutral-600" size={48} />
            </div>
            <h2 className="text-xl font-bold text-neutral-400">No parts found matching your criteria</h2>
            <p className="text-neutral-600">Try adjusting your search or category filters.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-12">
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                document.querySelector('main')?.scrollIntoView({ behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 disabled:opacity-50 hover:bg-neutral-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-neutral-400 text-sm mx-4">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                document.querySelector('main')?.scrollIntoView({ behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 disabled:opacity-50 hover:bg-neutral-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}
        
        {/* Localization & Map Section */}
        <section className="mt-20 p-8 border border-neutral-800 bg-neutral-900">
           <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-orange-500">Localización y Tiendas</h2>
           <React.Suspense fallback={<ProductSkeleton />}>
             <MapSearch />
           </React.Suspense>
        </section>
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div 
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(setToggleCart(false))}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
        )}
        {isCartOpen && (
          <motion.div 
            key="cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-[101] w-full max-w-md bg-neutral-900 shadow-2xl border-l border-neutral-800"
          >
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="text-orange-500" size={24} />
                      <h2 className="text-xl font-black uppercase tracking-tighter">Your Order</h2>
                    </div>
                    <button onClick={() => dispatch(setToggleCart(false))} title="Close Cart" className="p-2 text-neutral-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Active Cart Section */}
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
                        <ShoppingBag size={12} />
                        Active Items ({cartTotalItems})
                      </h3>
                      {cart.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center text-neutral-600 border border-dashed border-neutral-800 rounded-none">
                          <p className="font-bold text-sm uppercase tracking-widest">Active cart is empty</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {cart.map((item, idx) => (
                            <div key={`cart-item-${item.product?.internalId || item.product?.id || 'no-id'}-${idx}`} className="flex gap-4 group">
                              <div className="w-16 h-16 rounded-none overflow-hidden bg-neutral-800 border border-neutral-700 shrink-0">
                                <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-bold text-orange-500 tracking-tight leading-none mb-1 text-[10px] uppercase tracking-widest">{item.product.brand}</h4>
                                    <p className="text-white font-medium text-xs line-clamp-1">{item.product.name}</p>
                                  </div>
                                  <span className="text-white font-mono text-[10px]">{formatPrice(item.product.price * item.quantity, selectedCurrency, rates)}</span>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center bg-neutral-800 border border-neutral-700 p-0.5">
                                    <button 
                                      onClick={() => dispatch(updateQuantity({ id: item.product.id, quantity: Math.max(1, item.quantity - 1) }))}
                                      className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center text-[10px] font-black text-white">{item.quantity}</span>
                                    <button 
                                      onClick={() => dispatch(updateQuantity({ id: item.product.id, quantity: item.quantity + 1 }))}
                                      className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => dispatch(saveForLater(item.product.id))} 
                                      className="p-1 px-2 text-neutral-500 hover:text-orange-500 rounded-none transition-all"
                                      title="Save for Later"
                                    >
                                      <Bookmark size={14} />
                                    </button>
                                    <button 
                                      onClick={() => dispatch(removeFromCart(item.product.id))} 
                                      className="p-1 px-2 text-red-500 hover:bg-red-500/10 rounded-none transition-all"
                                      title="Remove"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Saved for Later Section */}
                    {savedItems.length > 0 && (
                      <div className="pt-8 border-t border-neutral-800">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
                          <Archive size={12} />
                          Saved for later ({savedItems.length})
                        </h3>
                        <div className="space-y-4">
                          {savedItems.map((item, idx) => (
                            <div key={`saved-item-${item.product?.internalId || item.product?.id || 'no-id'}-${idx}`} className="flex gap-4 opacity-60 hover:opacity-100 transition-opacity">
                              <div className="w-16 h-16 rounded-none overflow-hidden bg-neutral-800 border border-neutral-700 shrink-0 grayscale">
                                <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-neutral-500 tracking-tight leading-none mb-1 text-[10px] uppercase tracking-widest">{item.product.brand}</h4>
                                <p className="text-white font-medium text-xs line-clamp-1">{item.product.name}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-neutral-500 font-mono text-[10px]">{formatPrice(item.product.price, selectedCurrency, rates)}</span>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => dispatch(moveToCart(item.product.id))} 
                                      className="flex items-center gap-1 p-1 px-2 bg-white text-black font-black text-[8px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all"
                                    >
                                      <Plus size={10} />
                                      Move to Cart
                                    </button>
                                    <button 
                                      onClick={() => dispatch(removeFromSaved(item.product.id))} 
                                      className="p-1 px-2 text-neutral-700 hover:text-red-500 transition-all"
                                      title="Remove"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cart.length === 0 && savedItems.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600">
                        <ShoppingBag size={64} className="mb-4 opacity-20" />
                        <p className="font-bold text-lg">Your cart is empty</p>
                        <button 
                          onClick={() => dispatch(setToggleCart(false))}
                          className="mt-4 text-orange-500 font-bold uppercase tracking-widest text-xs hover:underline"
                        >
                          Browse Catalog
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-neutral-950 border-t border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Total</span>
                      <span className="text-2xl font-mono font-black">{formatPrice(cartTotalAmount, selectedCurrency, rates)}</span>
                    </div>
                    <button 
                      onClick={() => {
                        dispatch(setToggleCart(false));
                        setIsCheckoutOpen(true);
                      }}
                      className="w-full bg-orange-500 text-white py-4 rounded-none font-black uppercase tracking-wider hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50" 
                      disabled={cart.length === 0}
                    >
                      Process Order
                    </button>
                  </div>
                </div>
              </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            key="product-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProduct(null)}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md"
          />
        )}
        {selectedProduct && (
          <motion.div 
            key="product-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[201] md:w-[800px] md:max-h-[90vh] bg-neutral-900 border-2 border-neutral-800 rounded-none overflow-hidden flex flex-col md:flex-row shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          >
              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                className="w-full md:w-1/2 aspect-square md:aspect-auto bg-neutral-800 overflow-hidden cursor-zoom-in relative group/modal-img"
              >
                <motion.img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  style={{
                    transformOrigin,
                  }}
                  whileHover={{ scale: 2 }}
                  transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
                  className="w-full h-full object-cover" 
                  onError={(e: any) => {
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
                    if (e.currentTarget.dataset.errorFallback) return;
                    e.currentTarget.dataset.errorFallback = 'true';
                    e.currentTarget.src = brandLogos[selectedProduct.brand] || '/logotipo.png';
                    e.currentTarget.className = "w-full h-full object-contain p-12 bg-neutral-900";
                  }}
                />
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-none border border-neutral-700 pointer-events-none opacity-0 group-hover/modal-img:opacity-100 transition-opacity">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Interactive Zoom Active</p>
                </div>
              </div>
              <div className="flex-1 p-8 md:p-12 flex flex-col overflow-y-auto">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  title="Close Details"
                  className="absolute top-6 right-6 p-2 rounded-full bg-black/20 text-white hover:bg-black/40"
                >
                  <X size={20} />
                </button>
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-orange-500 font-black uppercase tracking-[0.2em] text-xs">{selectedProduct.category}</span>
                    {selectedProduct.tags && selectedProduct.tags.map((tag, tIdx) => (
                      <span key={`modal-tag-${tIdx}`} className="bg-orange-600 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter leading-none mb-2">{selectedProduct.name}</h2>
                  <p className="text-neutral-500 text-sm">{selectedProduct.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-2">Technical Specifications</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedProduct.specs).map(([key, val], sIdx) => (
                      <div key={`spec-v2-${key}-${sIdx}`}>
                        <p className="text-[10px] uppercase text-neutral-600 font-bold">{key}</p>
                        <p className="text-sm font-medium">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Reviews productId={selectedProduct.id} user={user} />
                
                <div className="mt-auto flex items-center justify-between gap-6 pt-6 border-t border-neutral-800">
                  <div className="flex flex-col">
                    <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-tighter">Price Per Unit</span>
                    <span className="text-3xl font-mono font-black">{formatPrice(selectedProduct.price, selectedCurrency, rates)}</span>
                  </div>
                  <div className="flex gap-4">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        if (!selectedProduct) return;
                        dispatch(addToCart(selectedProduct));
                        // Feedback state visually
                        const btn = document.getElementById('modal-add-btn');
                        if (btn) {
                          btn.innerText = 'Added!';
                          btn.classList.add('bg-green-500');
                          btn.classList.remove('bg-orange-500');
                        }
                        setTimeout(() => setSelectedProduct(null), 600);
                      }}
                      id="modal-add-btn"
                      className="flex-1 bg-orange-500 text-white px-8 py-4 rounded-none font-black uppercase tracking-wider hover:bg-orange-600 transition-all shadow-lg"
                    >
                      Add to Cart
                    </motion.button>
                    <button 
                      onClick={handleGenerateInsight}
                      disabled={isGeneratingInsight}
                      className="bg-neutral-800 text-white p-4 hover:bg-neutral-700 transition-all disabled:opacity-50 group/ai-btn"
                      title="Generate AI Technical Insight"
                    >
                      <Zap size={24} className={cn(isGeneratingInsight && "animate-pulse text-orange-500")} />
                    </button>
                  </div>

                  {aiInsight && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-none relative overflow-hidden"
                    >
                      <div className="flex items-center gap-2 mb-2 text-orange-500">
                        <Zap size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">AI Technical Insight</span>
                      </div>
                      <p className="text-sm text-neutral-300 italic leading-relaxed">"{aiInsight}"</p>
                      <button 
                        onClick={() => setAiInsight(null)}
                        className="absolute top-4 right-4 text-neutral-500 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={<ProductSkeleton />}>
        <ChatBot />
      </React.Suspense>

      <BottomNav 
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'profile') {
            setIsUserSessionOpen(true);
          } else {
            setActiveTab(tab);
            // Optionally, we might want to reset scroll or do other things based on tab
          }
        }}
        onSearchClick={() => {
          document.getElementById('search-input')?.focus();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onWishlistClick={() => setIsWishlistOpen(true)}
        onCartClick={() => dispatch(setToggleCart(true))}
        onScannerClick={() => setIsScannerOpen(true)}
      />

      {/* Floating WhatsApp Button */}
      <motion.a
        href="https://wa.me/584244342107"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        className="fixed bottom-40 right-6 z-50 p-4 rounded-xl bg-[#25D366] text-white shadow-xl shadow-green-500/20 flex items-center gap-3 group"
      >
        <MessageCircle size={24} className="fill-current" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-[200px] transition-all duration-500 whitespace-nowrap font-bold text-sm">
          WhatsApp Us
        </span>
      </motion.a>

      {/* Floating Compare Bar */}
      <AnimatePresence>
        {compareList.length > 0 && !isCompareOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 shadow-2xl flex items-center gap-6 backdrop-blur-xl">
              <div className="flex -space-x-4">
                {compareList.map((p, idx) => (
                  <motion.div 
                    key={`comp-bubble-${p.internalId || p.id}-${idx}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-12 h-12 rounded-xl border-2 border-neutral-900 overflow-hidden bg-neutral-800"
                  >
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </div>
              <div className="h-8 w-px bg-neutral-800" />
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-tight">{compareList.length} Items Selected</span>
                <span className="text-[10px] text-neutral-500 uppercase font-black">Max 4 items</span>
              </div>
              <button 
                onClick={() => setIsCompareOpen(true)}
                className="bg-white text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all flex items-center gap-2"
              >
                <Scale size={16} />
                Compare Now
              </button>
              <button 
                onClick={() => setCompareList([])}
                className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
                title="Clear comparison"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {isCompareOpen && (
          <motion.div 
            key="compare-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCompareOpen(false)}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md"
          />
        )}
        {isCompareOpen && (
          <motion.div 
            key="compare-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 top-12 z-[301] bg-neutral-950 rounded-none border-t border-neutral-800 shadow-2xl flex flex-col"
          >
              <div className="p-8 flex items-center justify-between border-b border-neutral-900">
                <div className="flex items-center gap-6">
                  <img src="/logotipo.png" alt="Logo" className="h-12 w-auto hidden md:block" />
                  <div className="h-10 w-px bg-neutral-800 hidden md:block" />
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500 rounded-none text-white">
                      <Scale size={28} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter">Technical Matrix</h2>
                      <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest">Compare expert precision</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCompareOpen(false)}
                  className="p-4 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-all hover:rotate-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-x-auto p-8 pt-0">
                <div className="min-w-[800px] h-full">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-6 text-left border-b border-neutral-800 w-1/5">
                          <span className="text-xs font-black text-neutral-600 uppercase tracking-widest">Specifications</span>
                        </th>
                        {compareList.map((p, compareIdx) => (
                          <th key={`comp-th-${p.internalId || p.id}-${compareIdx}`} className="p-6 text-left border-b border-neutral-800 group">
                            <div className="relative aspect-square w-32 rounded-2xl overflow-hidden mb-4 bg-neutral-900 border border-neutral-800">
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => toggleCompare(p)}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <h4 className="text-orange-500 font-black text-[10px] uppercase tracking-widest mb-1">{p.brand}</h4>
                            <p className="text-white font-bold text-sm leading-tight">{p.name}</p>
                            <p className="text-xl font-mono font-black mt-2">${p.price.toFixed(2)}</p>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Price Row (Already in head but could be repeated or separate) */}
                      {allSpecKeys.map((key, rowIdx) => (
                        <tr key={`matrix-row-${key}-${rowIdx}`} className="hover:bg-neutral-900/30 transition-colors group">
                          <td className="p-6 border-b border-neutral-900">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{key}</span>
                          </td>
                          {compareList.map((p, pIdx) => (
                            <td key={`matrix-cell-${p.internalId || p.id}-${key}-${pIdx}`} className="p-6 border-b border-neutral-900 text-neutral-300 font-medium italic">
                              {p.specs[key] || <span className="text-neutral-700 strike-through">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Action Row */}
                      <tr>
                        <td className="p-6" />
                        {compareList.map((p, footerIdx) => (
                          <td key={`compare-footer-btn-${p.internalId || p.id}-${footerIdx}`} className="p-6">
                            <button 
                              onClick={() => {
                                dispatch(addToCart(p));
                                setIsCompareOpen(false);
                              }}
                              className="w-full bg-neutral-800 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={16} />
                              Add to Order
                            </button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      {isScannerOpen && (
        <React.Suspense fallback={<ProductSkeleton />}>
          <ScannerModal 
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={handleScanSuccess}
          />
        </React.Suspense>
      )}

      {isAdminDashboardOpen && (
        <React.Suspense fallback={<ProductSkeleton />}>
          <AdminDashboard 
            isOpen={isAdminDashboardOpen}
            onClose={() => setIsAdminDashboardOpen(false)}
          />
        </React.Suspense>
      )}

      {isUserSessionOpen && (
        <React.Suspense fallback={<ProductSkeleton />}>
          <UserSessionDrawer 
            isOpen={isUserSessionOpen}
            onClose={() => setIsUserSessionOpen(false)}
            onAdminClick={() => {
              setIsUserSessionOpen(false);
              setIsAdminDashboardOpen(true);
            }}
          />
        </React.Suspense>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {isCheckoutOpen && (
        <React.Suspense fallback={<ProductSkeleton />}>
          <CheckoutModal 
            isOpen={isCheckoutOpen} 
            onClose={() => setIsCheckoutOpen(false)} 
          />
        </React.Suspense>
      )}

      {isWishlistOpen && (
        <React.Suspense fallback={<ProductSkeleton />}>
          <WishlistDrawer 
            isOpen={isWishlistOpen} 
            onClose={() => setIsWishlistOpen(false)} 
          />
        </React.Suspense>
      )}

      <PartnerShowcase />

      {/* Cross Reference Toolkit Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 border-t border-neutral-900 mt-20">
        <div className="mb-12">
          <div className="flex items-center gap-3 text-orange-500 mb-6">
            <Globe size={24} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Referencia Cruzada Inteligente</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">
            BUSCAR REFERENCIA CRUZADA
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed mb-8 max-w-2xl">
            Ingresa un código de parte (UPC, EAN, OEM) para buscar compatibilidades en nuestro catálogo técnico mediante IA.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <input 
              type="text"
              placeholder="Ingresa número de parte..."
              className="flex-1 bg-neutral-900 border border-neutral-800 p-5 text-white focus:border-orange-500 outline-none transition-all"
              value={crossRefQuery}
              onChange={(e) => setCrossRefQuery(e.target.value)}
            />
            <button 
              onClick={handleCrossRefSearch}
              disabled={isCrossRefSearching || crossRefQuery.length < 3}
              className="bg-orange-500 text-white px-8 py-5 font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-50"
            >
              {isCrossRefSearching ? 'Buscando...' : 'Find Cross-Reference'}
            </button>
          </div>

          {crossRefResults.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-400">
                <thead className="bg-neutral-950 uppercase text-xs font-bold text-neutral-500">
                  <tr>
                    <th className="p-4">Parte Original</th>
                    <th className="p-4">Marca Orig.</th>
                    <th className="p-4">SKU Encontrado</th>
                    <th className="p-4">Parte Encontrada</th>
                    <th className="p-4">Marca Final</th>
                    <th className="p-4">Specs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {crossRefResults.map((res: any, idx: number) => (
                    <tr key={`cross-ref-${idx}`}>
                      <td className="p-4 text-white font-bold">{crossRefQuery}</td>
                      <td className="p-4 text-neutral-500">N/A</td>
                      <td className="p-4 text-white font-mono">{res.id || 'N/A'}</td>
                      <td className="p-4 text-white font-bold">{res.name}</td>
                      <td className="p-4 text-orange-500 font-bold">{res.brand}</td>
                      <td className="p-4">{res.specs ? Object.entries(res.specs).map(([k, v]) => `${k}:${v}`).join(', ') : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-4 py-16 border-t border-neutral-900 mt-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <img src="/logotipo.png" alt="TurboBujías Logo" className="h-16 w-auto" />
            </div>
            <p className="text-neutral-500 text-sm max-w-sm leading-relaxed">
              Excellence in performance parts. Specialized in spark plugs, diesel heaters, and high-performance engineering for your engine.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-8 text-neutral-600">Connect</h4>
            <div className="flex flex-col gap-5">
              <a 
                href="https://www.instagram.com/turbobujias?igsh=MXN6Y2NkNTVzbXNmdg==" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 text-neutral-500 hover:text-white transition-all group"
              >
                <div className="w-10 h-10 rounded-none bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-orange-500 transition-colors">
                  <Instagram size={18} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider">Instagram</span>
              </a>
              <a 
                href="https://wa.me/584244342107" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 text-neutral-500 hover:text-white transition-all group"
              >
                <div className="w-10 h-10 rounded-none bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-green-500 transition-colors">
                  <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider">WhatsApp Contact</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <img src="/icon_v2.jpg" alt="TB Icon" className="relative w-20 h-20 rounded-none mb-4 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700 cursor-none" />
            </div>
            <span className="text-[10px] font-black text-neutral-800 uppercase tracking-[0.3em]">Quality Assured Spec</span>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-900/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-neutral-600 text-xs font-mono">© 2026 TURBOBUJIAS. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-8">
            <a href="#" className="text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Privacy Policy</a>
            <a href="#" className="text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Terms of Service</a>
            <a href="#" className="text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Merchant Portal</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
