import { useState, useRef, useEffect, ChangeEvent, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { documentService } from '../services/documentService';
import { MessageSquare, X, Send, Bot, User, Loader2, Paperclip, Image as ImageIcon, FileText, ShoppingCart, Heart, Star, Check, Zap, Package, History, Plus, Brain, Copy, Trash2, Download, Share2, Database } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { getAIResponse } from '../lib/ai';
import { PRODUCTS, Product } from '../data';
import { expandSearchQuery } from '../utils/searchUtils';
import { ragService } from '../services/ragService';
import { auditorService } from '../services/auditorService';
import { addToCart } from '../store/cartSlice';
import { toggleWishlist } from '../store/wishlistSlice';
import { RootState } from '../store';
import { formatPrice } from '../lib/utils';
import { getSupabase } from '../lib/supabase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { chatService, ChatSession, UserMemory } from '../services/chatService';

interface Message {
  role: 'user' | 'bot';
  content: string;
  recommendedProduct?: Product;
  comparisonProducts?: Product[];
  attachments?: {name: string, type: string, data: string}[];
  isAudited?: boolean;
  corrections?: string[];
}

function getRelevantParts(query: string, limit: number = 3): Product[] {
  const normalizedQuery = query.trim();
  const isCode = /^\d{10,14}$/.test(normalizedQuery);
  const expandedQueries = expandSearchQuery(normalizedQuery);
  const words = Array.from(new Set(expandedQueries.flatMap(q => q.toLowerCase().split(/\s+/)))).filter(w => w.length > 2);
  
  if (words.length === 0 && !isCode) return PRODUCTS.slice(0, limit);

  return PRODUCTS
    .map(p => {
      let score = 0;
      const oemStr = p.oemNumbers?.join(' ') || '';
      const text = `${p.name} ${p.brand} ${p.category} ${p.id} ${p.oeReference || ''} ${p.upc || ''} ${p.ean || ''} ${oemStr} ${JSON.stringify(p.specs)}`.toLowerCase();
      
      // Exact code match prioritization
      if (isCode) {
        if (p.upc === normalizedQuery || p.ean === normalizedQuery) score += 20;
      }

      words.forEach(word => {
        if (text.includes(word)) score += 1;
        // Boost for specific OEM/Ref matches
        if (p.id.toLowerCase() === word || p.oeReference?.toLowerCase() === word || p.upc === word || p.ean === word) score += 5;
        // Check OEM numbers specifically
        if (p.oemNumbers?.some(oem => oem.toLowerCase() === word)) score += 4;
      });

      return { product: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.product);
}

const MAX_HISTORY_MESSAGES = 100;

export function ChatBot() {
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state: RootState) => state.wishlist.items);
  const { rates, selectedCurrency } = useSelector((state: RootState) => state.currency);
  const user = useSelector((state: RootState) => state.auth.user);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<(Message & { id?: string })[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{name: string, type: string, data: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSearchingRAG, setIsSearchingRAG] = useState(false);
  const [partnerContext, setPartnerContext] = useState<string>('');
  const [inventoryContext, setInventoryContext] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-flash-preview');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'TurboBujías Assistant',
          text: 'Check out this engineering assistant for automotive parts!',
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('URL copied to clipboard!');
      }
    } catch (err) {
      console.error('Sharing failed', err);
    }
  };

  const exportChat = () => {
    if (messages.length === 0) {
      alert("No hay mensajes para exportar.");
      return;
    }
    const chatData = messages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([chatData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `turbo-chat-history-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearChat = async () => {
    if (!user || !currentSessionId) return;
    if (confirm('Clear all messages in this conversation?')) {
      try {
        await chatService.clearSessionMessages(user.uid, currentSessionId);
        setMessages([]);
      } catch (err) {
        console.error('Failed to clear chat:', err);
      }
    }
  };

  const handleDeleteSession = async (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (confirm('Delete this conversation? All messages will be lost.')) {
      try {
        await chatService.deleteSession(user.uid, sessionId);
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const fetchContext = async () => {
      try {
        // 1. Fetch Partners from Firebase
        const snapshot = await getDocs(collection(db, 'partners'));
        const partners = snapshot.docs.map(doc => doc.data());
        const pCtx = partners.map(p => 
          `[PARTNER] Name: ${p.name}, Type: ${p.type}, Location: ${p.location}, Expertise: ${p.description}`
        ).join('\n');
        setPartnerContext(pCtx);

        // 2. Fetch Inventory from Supabase
        const supabase = getSupabase();
        if (supabase) {
          try {
            const { data: products, error } = await supabase
              .from('products')
              .select('name, brand, category, price, stock')
              .limit(20);
            
            if (!error && products) {
              const iCtx = products.map(p => 
                `[INVENTORY] Name: ${p.name}, Brand: ${p.brand}, Category: ${p.category}, Price: ${p.price}, Stock: ${p.stock}`
              ).join('\n');
              setInventoryContext(iCtx);
            }
          } catch (supaErr) {
            console.warn('Supabase fetch failed in ChatBot:', supaErr);
          }
        }
      } catch (err) {
        console.error('Bot context fetch error:', err);
      }
    };
    fetchContext();
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLearning, setIsLearning] = useState(false);
  const [learningStatus, setLearningStatus] = useState("");

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large (max 5MB)`);
        continue;
      }

      if (file.type.includes('pdf') || file.type.includes('text') || file.type.includes('word') || file.name.endsWith('.pdf')) {
        // Learn manual
        const confirmLearn = window.confirm(`Learn manual "${file.name}" for future responses?`);
        if (confirmLearn) {
          setIsLearning(true);
          setLearningStatus(`Ingesting ${file.name}...`);
          try {
            const success = await documentService.processAndUploadManual(file, file.name);
            if (success) {
              alert(`Successfully learned ${file.name}. It is now part of the RAG context.`);
              // We also add it as a dummy attachment to show in UI
              setAttachments(prev => [...prev, { name: file.name, type: 'document/learned', data: '__LEARNED_MANUAL__' }]);
            } else {
              alert(`Failed to learn ${file.name}.`);
            }
          } catch (err) {
             console.error("Learn error:", err);
             alert("Error occurred while learning manual.");
          } finally {
             setIsLearning(false);
             setLearningStatus("");
          }
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const data = base64.split(',')[1];
          setAttachments(prev => [...prev, { name: file.name, type: file.type, data }]);
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user || !isOpen) return;

    // Load Sessions
    const sessionsPath = `users/${user.uid}/sessions`;
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const qSessions = query(sessionsRef, orderBy('updatedAt', 'desc'));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const sessList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession));
      setSessions(sessList);
      
      // Auto-select latest session if none selected
      if (!currentSessionId && sessList.length > 0) {
        setCurrentSessionId(sessList[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, sessionsPath);
    });

    // Load Memory
    const memoryPath = `users/${user.uid}/memory/main`;
    const memoryRef = doc(db, 'users', user.uid, 'memory', 'main');
    const unsubMemory = onSnapshot(memoryRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserMemory(snapshot.data() as UserMemory);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, memoryPath);
    });

    return () => {
      unsubSessions();
      unsubMemory();
    };
  }, [user, isOpen]);

  useEffect(() => {
    if (!user || !isOpen || !currentSessionId) {
      if (!user) {
        setMessages([{ role: 'bot', content: 'Hello! I am your TurboBujías assistant. How can I help you find the right part today?' }]);
      }
      return;
    }

    const path = `users/${user.uid}/sessions/${currentSessionId}/messages`;
    const messagesRef = collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(MAX_HISTORY_MESSAGES));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message & { id: string }));
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{ role: 'bot', content: `Hello ${user.displayName}! This is a fresh session. How can I assist your engineering needs?` }]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user, isOpen, currentSessionId]);

  const createNewSession = async () => {
    if (!user) return;
    try {
      const id = await chatService.createSession(user.uid, `Session ${new Date().toLocaleDateString()}`);
      setCurrentSessionId(id);
      setShowSessions(false);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMsg = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    
    const newMessage: Message = { 
      role: 'user', 
      content: userMsg,
      attachments: currentAttachments
    };

    setIsLoading(true);

    try {
      // Create session if it doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId && user) {
        sessionId = await chatService.createSession(user.uid, userMsg.substring(0, 30) || 'New Chat');
        setCurrentSessionId(sessionId);
      }

      // Persist user message
      if (user && sessionId) {
        await chatService.saveMessage(user.uid, sessionId, newMessage);
      } else {
        setMessages(prev => [...prev, { ...newMessage, id: `user-temp-${Date.now()}` }]);
      }

      // 1. Fetch RAG Context from Supabase (Products & Partners)
      setIsSearchingRAG(true);
      const [scoredProducts, scoredPartners, scoredManuals] = await Promise.all([
        ragService.searchProducts(userMsg, 5),
        ragService.searchPartners(userMsg, 3),
        documentService.searchManuals(userMsg, 4) // Fetch top 4 manual chunks
      ]);
      setIsSearchingRAG(false);

      // 2. Format Context for Gemini
      const supabaseProductContext = scoredProducts.length > 0 
        ? scoredProducts.map(res => 
            `[SUPABASE_PART] Brand: ${res.item.brand}, Name: ${res.item.name}, Ref ID: ${res.item.id}, OE: ${res.item.oeReference || 'N/A'}, Category: ${res.item.category}, Score: ${res.score.toFixed(2)}, Specs: ${JSON.stringify(res.item.specs)}`
          ).join('\n')
        : "No specific products found in Supabase RAG.";

      const supabasePartnerContext = scoredPartners.length > 0
        ? scoredPartners.map(res =>
            `[SUPABASE_PARTNER] Name: ${res.item.name}, Type: ${res.item.type}, Location: ${res.item.location}, Expertise: ${res.item.description}`
          ).join('\n')
        : "No specific partners found in Supabase RAG.";

      const manualContext = scoredManuals.length > 0
        ? scoredManuals.map((chunk, i) => 
            `[MANUAL_DOC_${i+1}] Source: ${chunk.source}\nContent: ${chunk.content}`
          ).join('\n\n')
        : "No relevant manuals found.";

      // Fallback/Popular products from local data
      const topProducts = PRODUCTS.slice(0, 5).map(p => 
        `[POPULAR_PART] Brand: ${p.brand}, Name: ${p.name}, Description: ${p.description}, Specs: ${JSON.stringify(p.specs)}`
      ).join('\n');

      const relevantParts = getRelevantParts(userMsg, 5);
      const localCatalogContext = relevantParts.map(p => 
        `[LOCAL_PART] Brand: ${p.brand}, Name: ${p.name}, Ref ID: ${p.id}, OE Ref: ${p.oeReference || 'N/A'}, Category: ${p.category}, Specs: ${JSON.stringify(p.specs)}`
      ).join('\n');

      // 3. Prepare History Context
      const messageHistory = messages.slice(-10);

      const systemInstruction = `YOU ARE THE TURBOBUJÍAS MASTER MECHANICAL ENGINEER & THERMODYNAMICS EXPERT.
      
      USER LONG-TERM MEMORY (CONSOLIDATED PROFILE):
      ${userMemory ? `
      - Summary: ${userMemory.summary}
      - Vehicle Info: ${userMemory.vehicleInfo}
      - Known Preferences: ${userMemory.preferences.join(', ')}
      ` : "New user. No previous technical history recorded."}

      CORE IDENTITY & BREADTH:
      You are a high-level technical consultant with profound expertise in automotive, industrial, and heavy-duty engine systems. Your specialized knowledge encompasses:
      - Internal Combustion Engines (ICE): Gasoline, Diesel (Light/Heavy Duty).
      - Commercial Transportation: Heavy trucks (Mack, Kenworth, Volvo, Freightliner), buses, and logistics fleets.
      - Industrial Power: Stationary generators (Caterpillar, Cummins), hydraulic systems, and pneumatic machinery.
      - Energy & Thermal Systems: High-performance cooling, heat exchangers, and secondary loop technicalities related to industrial energy sectors (including nuclear thermal management contexts).

      OPERATIONAL GOALS:
      1. TECHNICAL INTELLIGENCE FIRST: Prioritize your baseline training in engineering principles (Transformer pre-trained data), diagnostics, and failure analysis over simple inventory lookup. Provide technical reasoning for every mechanical problem.
      2. PROACTIVE DIAGNOSTIC STRUCTURE: For any engine symptom described, your response MUST follow this structured format:
         a) POTENTIAL CAUSES: A prioritized technical list (based on likelihood).
         b) MAINTENANCE STEPS: Logical steps to verify the issue.
         c) CATALOG RECOMMENDATIONS: If specific parts are needed, recommend products from the catalog, EXPLAINING THE TECHNICAL RATIONALE for why this part solves the issue.
      3. INVENTORY AS SECONDARY RECOMMENDATION: Suggest store items only after establishing a technical baseline for the solution.
      
      STEP-BY-STEP REASONING (REQUIRED):
      Before giving a final answer, provide a brief reasoning chain INSIDE <reasoning>...</reasoning> XML tags.
      - Analyze mechanical symptoms and environment.
      - Use engineering principles to identify potential failure points.
      - Explicitly state potential causes and maintenance steps.
      - Check our technical catalog for compatible parts to solve the issue, with technical rationale.
      This reasoning will be hidden from the user.

      CONTEXTUAL DATA (TURBOBUJÍAS PRO ECOSYSTEM):
      You have access to a real-time Vector Search (RAG) database from Supabase containing up-to-date products and partners. YOU MUST prioritize recommendations from the SUPABASE VECTOR SEARCH contexts below over other local contexts, as they are semantically matched to the user's query.
      - SUPABASE VECTOR SEARCH (Products): ${supabaseProductContext}
      - SUPABASE VECTOR SEARCH (Partners): ${supabasePartnerContext}
      - LEARNED MANUALS / DOCUMENTATION: ${manualContext}
      - LOCAL CATALOG: ${localCatalogContext}
      - POPULAR PARTS: ${topProducts}
      - INVENTORY RAW: ${inventoryContext}
      - PARTNER CACHE: ${partnerContext}

      RULES & FORMATTING:
      - CRITICAL: Prioritize suggesting products from the SUPABASE VECTOR SEARCH contexts. These are fetched dynamically based on semantic similarity to the user's query and provide the most contextually accurate recommendations.
      - If a verified product from our catalog solves the user's technical problem, append [ID: product-id] at the end of your response.
      - To compare parts, use [COMPARE: id1, id2].
      - Use standard technical units (PSI, Bar, Celsius, Horsepower, Torque).
      - Address queries for specialized diesel heaters and high-performance spark plugs (Iridium/Platinum) with deep technical depth.
      - Primary Language: Spanish (Professional/Technical).

      IDENTITY & BIOGRAPHY RULES:
      - IF user asks "quien te creo?" or about your creation: Reply "Fui creado por Marcos Mora, un Full Stack Developer certificado por IBM."
      - IF user asks "quien eres?" or "para quien trabajas?": Reply: "Soy un experto en ingeniería mecánica y repuestos de precisión trabajando para TurboBujías Pro. Fui desarrollado por Marcos Mora, un desarrollador Full Stack certificado por IBM con especialización en IA generativa y sistemas agénticos."
      - IF user asks "que tipo de chatbot eres?": Reply: "Soy un agente AI especializado en mecánica industrial y automotriz, integrado en la plataforma TurboBujías Pro. Poseo una arquitectura avanzada de RAG (Retrieval-Augmented Generation) and capacidades agénticas para razonar y solucionar problemas técnicos complejos de forma autónoma."

      TONE: Professional Master Technician. Authoritative but helpful. No fluff. Logic-driven.
      `;








      






      const aiAttachments = currentAttachments.filter(a => a.data !== '__LEARNED_MANUAL__');

      const text = await getAIResponse(userMsg || "Analyze technical documents/images for diagnostic.", {
        model: selectedModel,
        systemInstruction,
        attachments: aiAttachments,
        temperature: 0,
        history: messageHistory
      });

      // 3. Recursive Audit (Auditor Agent)
      setIsAuditing(true);
      const fullContextForAudit = `
        SUPABASE_PRODUCTS: ${supabaseProductContext}
        SUPABASE_PARTNERS: ${supabasePartnerContext}
        LOCAL_CATALOG: ${localCatalogContext}
        PARTNER_CACHE: ${partnerContext}
      `;

      const auditResult = await auditorService.auditResponse(userMsg, text, fullContextForAudit);
      setIsAuditing(false);
      
      const finalContent = auditResult.refinedContent;
      const idMatch = finalContent.match(/\[ID:\s*([a-zA-Z0-9_-]+)\]/);
      const compareMatch = finalContent.match(/\[COMPARE:\s*([a-zA-Z0-9_-]+),\s*([a-zA-Z0-9_-]+)\]/);
      
      const recommendedProductId = idMatch ? idMatch[1] : undefined;
      const comparisonProductIds = compareMatch ? [compareMatch[1], compareMatch[2]] : undefined;
      
      const cleanText = finalContent
        .replace(/\[ID:\s*[a-zA-Z0-9_-]+\]/g, '')
        .replace(/\[COMPARE:\s*[a-zA-Z0-9_-]+,\s*[a-zA-Z0-9_-]+\]/g, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
        .replace(/\*\*RAZONAMIENTO TÉCNICO:\*\*[\s\S]*?---/g, '')
        .replace(/\*\*RAZONAMIENTO TÉCNICO:\*\*[\s\S]*/g, '')
        .trim();

      const botMessage: Message = { 
        role: 'bot', 
        content: cleanText, 
        recommendedProduct: PRODUCTS.find(p => p.id === recommendedProductId),
        comparisonProducts: comparisonProductIds ? comparisonProductIds.map(id => PRODUCTS.find(p => p.id === id)).filter((p): p is Product => !!p) : undefined,
        isAudited: true,
        corrections: auditResult.correctionsMade
      };

      if (user && sessionId) {
        await chatService.saveMessage(user.uid, sessionId, botMessage);
        
        // 4. Update User Memory (Strategic Background Process)
        const memoryUpdatePrompt = `
          Analyze the following exchange and update the User's Long-term mechanical memory.
          Current Memory: ${userMemory ? JSON.stringify(userMemory) : 'None'}
          User: ${userMsg}
          Bot: ${cleanText}
          
          Respond ONLY with a JSON object containing the NEW state for the memory:
          {
            "summary": "Updated brief narrative of user's current situation/needs",
            "preferences": ["List", "of", "brands", "or", "types", "mentioned"],
            "vehicleInfo": "Year, Make, Model, Engine if identified"
          }
        `;
        
        try {
          const memoryUpdateJson = await getAIResponse(memoryUpdatePrompt, {
            model: 'gemini-3-flash-preview',
            temperature: 0,
            systemInstruction: "You are a memory consolidation sub-system. Output ONLY JSON."
          });
          const newMemory = JSON.parse(memoryUpdateJson.replace(/```json|```/g, ''));
          await chatService.updateUserMemory(user.uid, newMemory);
        } catch (err) {
          console.warn('Memory update failed:', err);
        }
      } else {
        setMessages(prev => [...prev, { ...botMessage, id: `bot-temp-${Date.now()}` }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: `Sorry, I am having trouble connecting right now. Please try again later.`, id: `bot-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Speed Dial Floating Button */}
      <div 
        className="fixed bottom-24 md:bottom-6 right-6 z-[200] flex flex-col items-end gap-3 pointer-events-none"
        onMouseEnter={() => setIsSpeedDialOpen(true)}
        onMouseLeave={() => setIsSpeedDialOpen(false)}
      >
        <AnimatePresence>
          {isSpeedDialOpen && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="flex flex-col gap-3 pointer-events-auto"
            >
              <button 
                onClick={exportChat}
                className="p-3 rounded-xl bg-neutral-800 text-white shadow-lg border border-neutral-700 hover:border-orange-500 hover:bg-neutral-800 transition-all flex items-center gap-2 group"
                title="Export Chat"
              >
                <div className="text-[10px] font-black uppercase tracking-widest hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">Exportar</div>
                <Download size={18} />
              </button>
              <button 
                onClick={shareLink}
                className="p-3 rounded-xl bg-neutral-800 text-white shadow-lg border border-neutral-700 hover:border-orange-500 hover:bg-neutral-800 transition-all flex items-center gap-2 group"
                title="Share Tool"
              >
                <div className="text-[10px] font-black uppercase tracking-widest hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">Compartir</div>
                <Share2 size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, -8, 0] }}
          transition={{ 
            scale: { duration: 0.3 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" } 
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setIsOpen(true);
            setIsSpeedDialOpen(false);
          }}
          className={cn(
            "p-3 rounded-full bg-white shadow-xl shadow-orange-500/20 transition-all pointer-events-auto border border-neutral-800",
            isOpen && "opacity-0 pointer-events-none"
          )}
        >
          {isSpeedDialOpen && !isOpen ? (
            <div className="w-10 h-10 flex items-center justify-center bg-neutral-900 rounded-full text-white">
              <Plus size={24} className="rotate-45 transition-transform" />
            </div>
          ) : (
            <img src="/icon.png" alt="Chat" className="w-10 h-10 object-contain drop-shadow-lg" />
          )}
        </motion.button>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[600] w-full sm:w-[480px] h-full sm:h-[700px] sm:max-h-[85vh] bg-white dark:bg-neutral-950 border-none sm:border sm:border-neutral-200 dark:sm:border-neutral-800 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden safe-area-padding transition-colors duration-300"
          >
            {/* Header */}
            <div className="pt-12 sm:pt-4 pb-4 px-4 bg-white/80 dark:bg-neutral-900/80 flex items-center justify-between border-b border-orange-500/20 sm:rounded-t-3xl backdrop-blur-md sticky top-0 z-20 shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSessions(!showSessions)}
                  className={cn(
                    "p-2 bg-neutral-50 dark:bg-neutral-950 border rounded-xl transition-all hover:scale-105 active:scale-95",
                    showSessions ? "border-orange-500 text-orange-500" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-orange-500"
                  )}
                  title="Chat Sessions"
                >
                  <History size={18} />
                </button>
                <div>
                  <h3 className="text-neutral-900 dark:text-white font-black text-sm uppercase tracking-tight leading-none mb-1">Turbo Assistant</h3>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-neutral-50 dark:bg-neutral-950 text-[9px] font-black uppercase text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 outline-none hover:border-orange-500 transition-colors cursor-pointer px-1 rounded-md"
                    >
                      <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                      <option value="gemini-flash-latest">Gemini 1.5 Flash</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentSessionId && messages.length > 0 && (
                  <button 
                    onClick={handleClearChat}
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors bg-neutral-50 dark:bg-neutral-950 rounded-xl"
                    title="Clear Current Chat"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {userMemory && (
                  <div className="group relative">
                    <button className="p-2 text-neutral-400 hover:text-orange-500 transition-colors bg-neutral-50 dark:bg-neutral-950 rounded-xl">
                      <Brain size={18} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[600] rounded-2xl transform origin-top-right group-hover:translate-y-0 translate-y-2">
                      <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Database size={10} />
                        Long-term Memory
                      </h4>
                      <p className="text-[11px] text-neutral-700 dark:text-neutral-200 mb-2 leading-relaxed font-medium">{userMemory.summary}</p>
                      <div className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono italic p-2 bg-neutral-50 dark:bg-neutral-950 rounded-lg">Vehicle: {userMemory.vehicleInfo}</div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-neutral-400 hover:text-orange-500 transition-all hover:rotate-90 bg-neutral-50 dark:bg-neutral-950 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Input Overlay for Loading/Learning */}
            {isLearning && (
              <div className="absolute inset-0 z-[700] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <div className="relative">
                  <Loader2 size={40} className="text-orange-500 animate-spin" />
                  <Database size={20} className="absolute inset-0 m-auto text-orange-500/50" />
                </div>
                <h4 className="text-lg font-black text-white mt-6 uppercase tracking-widest">{learningStatus}</h4>
                <p className="text-neutral-400 text-sm mt-2 font-medium">Extracting technical context from document with Langchain...</p>
              </div>
            )}

            {/* Sessions Overlay */}
            <AnimatePresence>
              {showSessions && (
                <motion.div
                  initial={{ x: -400 }}
                  animate={{ x: 0 }}
                  exit={{ x: -400 }}
                  className="absolute inset-y-0 left-0 w-72 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 z-[550] flex flex-col shadow-2xl transition-colors duration-300"
                >
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-800/50">
                    <h4 className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest">Conversations</h4>
                    <button 
                      onClick={createNewSession}
                      className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all shadow-md active:scale-95"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setCurrentSessionId(s.id);
                          setShowSessions(false);
                        }}
                        className={cn(
                          "w-full text-left p-3 transition-all flex items-center justify-between group rounded-xl border cursor-pointer",
                          currentSessionId === s.id 
                            ? "bg-white dark:bg-neutral-800 border-orange-500 shadow-lg scale-[1.02]" 
                            : "bg-transparent border-transparent hover:bg-white dark:hover:bg-neutral-800/40 hover:border-neutral-200 dark:hover:border-neutral-700"
                        )}
                      >
                        <div className="flex flex-col gap-1 truncate flex-1">
                          <span className={cn(
                            "text-[11px] font-black truncate uppercase tracking-tight",
                            currentSessionId === s.id ? "text-orange-500" : "text-neutral-700 dark:text-neutral-300"
                          )}>
                            {s.title}
                          </span>
                          {s.lastMessage && (
                            <span className="text-[9px] text-neutral-500 dark:text-neutral-500 truncate italic">
                              {s.lastMessage}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                          title="Delete Session"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 italic">No previous chats</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800 bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300"
            >
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id ? `msg-id-v2-${msg.id}-${idx}` : `msg-v2-${idx}-${msg.role}-${msg.content.substring(0, 15)}`}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex flex-col gap-3 max-w-[90%]",
                    msg.role === 'user' ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "flex gap-3 items-end",
                    msg.role === 'user' ? "flex-row-reverse" : ""
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-110",
                      msg.role === 'user' ? "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" : "bg-orange-500 text-white"
                    )}>
                      {msg.role === 'user' ? <User size={14} className="text-neutral-600 dark:text-neutral-400" /> : <Bot size={16} />}
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed relative group whitespace-pre-wrap shadow-sm transition-all border",
                      msg.role === 'user' 
                        ? "bg-orange-500 text-white rounded-br-none border-orange-600" 
                        : "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-none border-neutral-200 dark:border-neutral-800"
                    )}>
                      {msg.content}
                      {msg.role === 'bot' && (
                        <button
                          onClick={() => handleCopy(msg.content, msg.id || `${idx}`)}
                          className="absolute -top-2 -right-2 p-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-orange-500 transition-all rounded-xl shadow-lg z-10"
                          title="Copy message"
                        >
                          {copiedId === (msg.id || `${idx}`) ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {msg.attachments.map((att, attIdx) => (
                            att.type.startsWith('image/') ? (
                              att.data === '__REMOVED_FOR_SIZE__' ? (
                                <div key={`att-${attIdx}`} className="p-4 bg-neutral-100 dark:bg-black/20 border border-neutral-200 dark:border-neutral-700 flex flex-col items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500 w-[200px] h-[120px] rounded-xl font-bold uppercase tracking-tighter">
                                  <ImageIcon size={24} />
                                  <span className="text-[8px] text-center">Image removed from history</span>
                                </div>
                              ) : (
                                <div key={`att-${attIdx}`} className="relative group/att rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-md">
                                  <img 
                                    src={`data:${att.type};base64,${att.data}`}
                                    alt={att.name}
                                    className="max-w-[220px] max-h-[220px] object-cover transition-transform group-hover/att:scale-105"
                                  />
                                </div>
                              )
                            ) : (
                              <div key={`att-${attIdx}`} className="p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-3 text-[10px] rounded-xl shadow-sm">
                                <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500">
                                   <FileText size={16} />
                                </div>
                                <span className="font-bold text-neutral-700 dark:text-neutral-300">{att.name} {att.data === '__REMOVED_FOR_SIZE__' && '(History only)'}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.role === 'bot' && msg.recommendedProduct && !msg.comparisonProducts && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="ml-11 mt-1 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col gap-4 rounded-2xl shadow-md overflow-hidden relative"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                      {(() => {
                        const product = msg.recommendedProduct;
                        if (!product) return null;
                        const inWishlist = wishlistItems.some(item => item.id === product.id);

                        return (
                          <>
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shrink-0 shadow-inner">
                                 <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black text-neutral-900 dark:text-white truncate uppercase tracking-tighter mb-1">{product.name}</h4>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-orange-500 font-black">{formatPrice(product.price, selectedCurrency, rates)}</p>
                                  <span className="text-[8px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500 uppercase font-black">Stock: {product.stock}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => dispatch(addToCart(product))}
                                className="flex-1 bg-neutral-900 dark:bg-white text-white dark:text-black py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white transition-all flex items-center justify-center gap-2 rounded-lg shadow-sm"
                              >
                                <ShoppingCart size={12} />
                                Add to Cart
                              </button>
                              <button 
                                onClick={() => dispatch(toggleWishlist(product))}
                                className={cn(
                                  "px-4 py-2.5 border transition-all rounded-lg shadow-sm",
                                  inWishlist 
                                    ? "bg-red-500/10 border-red-500 text-red-500" 
                                    : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 hover:border-red-500"
                                )}
                              >
                                <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}

                  {msg.role === 'bot' && msg.comparisonProducts && msg.comparisonProducts.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="ml-11 mt-1 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-3 rounded-2xl shadow-md"
                    >
                      {msg.comparisonProducts.map(product => (
                        <div key={product.id} className="flex flex-col gap-2 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700/50">
                          <img src={product.image} alt={product.name} className="w-full aspect-square object-cover border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm" />
                          <h4 className="text-[10px] font-black text-neutral-900 dark:text-white truncate uppercase tracking-tighter">{product.name}</h4>
                          <p className="text-[11px] text-orange-500 font-black">{formatPrice(product.price, selectedCurrency, rates)}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%] items-end">
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg animate-pulse">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl rounded-bl-none border border-neutral-200 dark:border-neutral-800 shadow-sm">
                    <Loader2 size={16} className="text-orange-500 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 pb-8 sm:pb-6 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 sm:rounded-b-3xl transition-colors duration-300">
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, i) => (
                      <div key={`chat-att-${att.name}-${i}`} className="relative group">
                        {att.type.startsWith('image/') ? (
                          <div className="w-12 h-12 border border-neutral-700 overflow-hidden">
                            <img 
                              src={`data:${att.type};base64,${att.data}`} 
                              alt={att.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-2 py-1 bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-300 h-12">
                            <FileText size={12} />
                            <span className="truncate max-w-[80px]">{att.name}</span>
                          </div>
                        )}
                        <button 
                          onClick={() => removeAttachment(i)} 
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setAttachments([])}
                    className="text-[10px] text-neutral-500 hover:text-red-500 font-bold uppercase tracking-widest px-2"
                  >
                    Clear All
                  </button>
                </div>
              )}

              <div className="relative flex items-center gap-3">
                <input 
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => {
                    console.log('File change event triggered', e.target.files);
                    handleFileChange(e);
                  }}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = "image/*";
                        fileInputRef.current.click();
                      }
                    }}
                    className="p-2.5 text-neutral-500 hover:text-orange-500 transition-all bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm hover:scale-105"
                    title="Attach images"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = ".pdf,.doc,.docx,.txt";
                        fileInputRef.current.click();
                      }
                    }}
                    className="p-2.5 text-neutral-500 hover:text-orange-500 transition-all bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm hover:scale-105"
                    title="Attach documents"
                  >
                    <Paperclip size={18} />
                  </button>
                </div>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="relative flex-1"
                >
                  <input
                    type="text"
                    placeholder="Escribe tu consulta técnica..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white pl-4 pr-12 py-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm shadow-inner"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={(!input.trim() && attachments.length === 0) || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 disabled:opacity-50 disabled:grayscale transition-all active:scale-90"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
