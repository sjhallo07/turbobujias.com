import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { PartnerSkeleton } from './PartnerSkeleton';
import { Globe, Instagram, MessageCircle, MapPin, ExternalLink, ShieldCheck, Search } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Partner {
  internalId: string;
  name: string;
  image: string;
  type: 'brand' | 'store' | 'workshop';
  location: string;
  description: string;
  isPromoted: boolean;
  socials: {
    instagram?: string;
    whatsapp?: string;
    web?: string;
  };
}

export function PartnerShowcase() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'partners'));
        const items = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id } as Partner));
        setPartners(items);
      } catch (err) {
        console.error('Error fetching partners:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    if (!searchQuery) return partners;
    const lowerQuery = searchQuery.toLowerCase();
    return partners.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      (p.location && p.location.toLowerCase().includes(lowerQuery)) ||
      p.type.toLowerCase().includes(lowerQuery) ||
      (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
      (p.isPromoted && (lowerQuery.includes("promoted") || lowerQuery.includes("certified")))
    );
  }, [partners, searchQuery]);

  if (loading) {
    return (
      <section className="py-20 border-t border-neutral-900 bg-black/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => <PartnerSkeleton key={`partner-skeleton-${i}`} />)}
          </div>
        </div>
      </section>
    );
  }
  if (partners.length === 0) return null;

  return (
    <section className="py-20 border-t border-neutral-900 bg-black/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Technical Network</h2>
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Authorized Brands, Workshops & Specialized Stores</p>
          </div>
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="Search by name, location, description, or status..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm pl-10 pr-4 py-3 outline-none focus:border-orange-500 transition-colors placeholder:text-neutral-600"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
          </div>
        </div>

        {filteredPartners.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900/50 border border-neutral-900">
            <Search className="mx-auto text-neutral-700 mb-4" size={32} />
            <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">No partners found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPartners.map((partner, i) => (
              <motion.div
                key={`partner-card-${partner.internalId || i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.5) }}
                className="group relative bg-neutral-900 border border-neutral-800 p-6 rounded-none hover:border-orange-500/50 transition-all"
              >
                {partner.isPromoted && (
                  <div className="absolute -top-3 left-6 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 flex items-center gap-1 shadow-lg">
                    <ShieldCheck size={10} /> Certified Partner
                  </div>
                )}

                <div className="flex gap-6">
                  <div className="w-20 h-20 shrink-0 bg-black border border-neutral-800 flex items-center justify-center p-2 overflow-hidden">
                    {partner.image ? (
                      <img 
                        src={partner.image} 
                        alt={partner.name} 
                        className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" 
                        onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                      />
                    ) : (
                      <Globe size={24} className="text-neutral-800" />
                    )}
                  </div>

                  <div className="flex-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 mb-1 block">{partner.type}</span>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 group-hover:text-orange-500 transition-colors">{partner.name}</h3>
                    
                    {partner.location && (
                      <div className="flex items-center gap-1.5 text-neutral-500 mb-4">
                        <MapPin size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">{partner.location}</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {partner.socials?.instagram && (
                        <a href={partner.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-white transition-colors">
                          <Instagram size={16} />
                        </a>
                      )}
                      {partner.socials?.whatsapp && (
                        <a href={`https://wa.me/${partner.socials.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-white transition-colors">
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {partner.socials?.web && (
                        <a href={partner.socials.web} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-white transition-colors">
                          <Globe size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {partner.description && (
                  <p className="mt-6 text-xs text-neutral-500 leading-relaxed italic border-l-2 border-neutral-800 pl-4">
                    "{partner.description}"
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
