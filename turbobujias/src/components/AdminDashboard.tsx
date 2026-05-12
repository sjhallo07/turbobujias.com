import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Edit2, Trash2, Download, Upload, Search, Package, AlertCircle, CheckCircle2, QrCode, Globe, Instagram, MessageCircle, MapPin, Star, Zap, ExternalLink, FileText, RefreshCw, History, Image as ImageIcon } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, limit, startAfter, writeBatch } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product } from '../data';
import { generateAIImage } from '../lib/ai';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { testSupabaseConnection } from '../lib/supabase';
import { syncInventoryFromSupabaseToFirebase } from '../services/migrationService';
import { auditLogService, AuditAction } from '../services/auditLogService';
import { ScannerModal } from './ScannerModal';
import { MarketingImageGenerator } from './MarketingImageGenerator';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboard({ isOpen, onClose }: AdminDashboardProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'admin';
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');

  const [isCsvMappingModalOpen, setIsCsvMappingModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  // ... rest of state
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'partners' | 'admins' | 'logs' | 'marketing'>('inventory');
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    brand: '',
    category: 'Spark Plugs',
    price: 0,
    stock: 0,
    image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?q=80&w=200',
    description: '',
    tags: [] as string[]
  });

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPartnerImage, setIsGeneratingPartnerImage] = useState(false);

  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    image: '',
    type: 'workshop',
    location: '',
    description: '',
    isPromoted: false,
    socials: {
      instagram: '',
      whatsapp: '',
      web: ''
    }
  });

  const categories = ['Spark Plugs', 'Diesel Heaters', 'Filters', 'Tools'];
  const partnerTypes = ['brand', 'store', 'workshop'];

const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctUser = 'admin';
    const correctPass = 'TurboBujias2026'; // Custom for the brand
    
    if (adminUsername === correctUser && adminPassword === correctPass) {
      setIsAuthorized(true);
      setAuthError('');
      // Record login
      if (user) {
        auditLogService.recordAction({
          adminId: user.uid,
          adminEmail: user.email || 'unknown',
          action: 'USER_ROLE_CHANGE',
          details: 'Admin logged into Dashboard manually'
        });
      }
    } else {
      setAuthError('INVALID CREDENTIALS');
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        setIsAuthorized(true);
      }
      checkDbConnection();
      fetchProducts();
      fetchPartners();
      fetchAdmins();
      fetchAuditLogs();
    } else {
      setIsAuthorized(false);
      setAdminUsername('');
      setAdminPassword('');
      setAuthError('');
    }
  }, [isOpen, isAdmin]);

  const checkDbConnection = async () => {
    const status = await testSupabaseConnection();
    setIsDbConnected(status);
  };

  const fetchAuditLogs = async () => {
    const path = 'auditLogs';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id }));
      setAuditLogs(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteData.trim()) return;
    
    try {
      setLoading(true);
      const lines = pasteData.trim().split('\n');
      // Header detection: ID SKU Título Condición Tipo Peso Envio Express
      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
      const hasHeaders = headers.includes('sku') || headers.includes('título') || headers.includes('id');
      const startIdx = hasHeaders ? 1 : 0;
      
      const BATCH_SIZE = 500;
      let importedCount = 0;

      for (let i = startIdx; i < lines.length; i += BATCH_SIZE) {
        const chunk = lines.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(line => {
          const columns = line.split('\t');
          if (columns.length < 2) return;
          
          const item: any = {};
          if (hasHeaders) {
            headers.forEach((h, idx) => {
              if (columns[idx]) item[h] = columns[idx];
            });
          } else {
            // Default mapping if no headers: ID, SKU, Name, Cond, Type, Weight, Ship
            [item.id, item.sku, item.name, item.condition, item.type, item.weight, item.shipping] = columns;
          }

          const name = String(item.título || item.name || 'Unnamed Product');
          const sku = String(item.sku || '');
          const id = String(item.id || sku || Math.random().toString(36).substr(2, 9));
          
          const docRef = doc(collection(db, 'products'));
          batch.set(docRef, {
            id,
            name,
            brand: String(item.brand || item.marca || name.split(' ')[1] || 'Generic'),
            category: 'Spark Plugs',
            price: Number(item.price || item.precio || 10),
            stock: Number(item.stock || item.inventario || 50),
            description: String(item.description || item.descripción || `Imported from Bulk Paste. SKU: ${sku}`),
            specs: {
              sku: sku || 'N/A',
              weight: String(item.peso || 'N/A'),
              condition: String(item.condición || 'N/A'),
              shipping: String(item['envio express'] || item.shipping || 'N/A'),
              matchType: String(item.tipo || 'N/A')
            },
            updatedAt: serverTimestamp()
          });
          importedCount++;
        });

        await batch.commit();
      }
      
      if (user) {
        auditLogService.recordAction({
          adminId: user.uid,
          adminEmail: user.email || 'unknown',
          action: 'IMPORT_CSV',
          details: `Bulk paste import complete: ${importedCount} items added.`
        });
      }

      alert(`SUCCESS: ${importedCount} entries added to the database.`);
      setIsPasteModalOpen(false);
      setPasteData('');
      fetchProducts();
    } catch (err) {
      console.error('Paste Import Fail:', err);
      alert('CRITICAL: Data structure mismatch. Ensure tab-separated format.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    
    const confirmSync = confirm("This will sync all products from Supabase to Firestore. It might overwrite existing data with the same IDs. Proceed?");
    if (!confirmSync) return;

    try {
      setIsSyncing(true);
      const result = await syncInventoryFromSupabaseToFirebase(true);
      
      if (user) {
        auditLogService.recordAction({
          adminId: user.uid,
          adminEmail: user.email || 'unknown',
          action: 'SYNC_SUPABASE',
          details: result.message
        });
      }

      alert(result.message);
      fetchProducts();
    } catch (err: any) {
      console.error('Manual Sync Error:', err);
      alert(`CRITICAL: Sync failed. ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const manualTestConnection = async () => {
    setIsTestingDb(true);
    await checkDbConnection();
    setIsTestingDb(false);
    alert(isDbConnected ? 'Database Connection: SUCCESS' : 'Database Connection: FAILED');
  };

  const fetchProducts = async (isLoadMore: boolean = false) => {
    if (!isLoadMore) setLoading(true);
    else setLoadingMore(true);
    const path = 'products';
    const constraints: any[] = [orderBy('updatedAt', 'desc'), limit(10)];
    if (isLoadMore && lastVisible) {
      constraints.push(startAfter(lastVisible));
    }
    try {
      const q = query(collection(db, path), ...constraints);
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id } as any));
      if (isLoadMore) {
        setProducts(prev => [...prev, ...items]);
      } else {
        setProducts(items);
      }
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      if (!isLoadMore) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const fetchPartners = async () => {
    const path = 'partners';
    try {
      const snapshot = await getDocs(collection(db, path));
      const items = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id }));
      setPartners(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const fetchAdmins = async () => {
    const path = 'admins';
    try {
      const snapshot = await getDocs(collection(db, path));
      const items = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id }));
      setAdmins(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const handleAddAdmin = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Admin role required");
      return;
    }
    if (!newAdminEmail) return;
    const path = 'admins';
    try {
      await addDoc(collection(db, path), { email: newAdminEmail, addedAt: serverTimestamp() });
      
      if (user) {
        auditLogService.recordAction({
          adminId: user.uid,
          adminEmail: user.email || 'unknown',
          action: 'USER_ROLE_CHANGE',
          details: `Added new admin: ${newAdminEmail}`
        });
      }

      setNewAdminEmail('');
      fetchAdmins();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleRemoveAdmin = async (internalId: string) => {
    if (!isAdmin) {
      alert("Unauthorized: Admin role required");
      return;
    }
    const path = 'admins';
    if (confirm('Remove this admin?')) {
      try {
        const adminToRemove = admins.find(a => a.internalId === internalId);
        await deleteDoc(doc(db, path, internalId));
        
        if (user && adminToRemove) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'USER_ROLE_CHANGE',
            details: `Removed admin: ${adminToRemove.email}`
          });
        }

        fetchAdmins();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const validateProductForm = () => {
    if (!formData.id || !formData.name || !formData.brand) {
      alert("Please fill all required fields");
      return false;
    }
    if (formData.price <= 0) {
      alert("Price must be a positive number");
      return false;
    }
    if (formData.stock < 0) {
      alert("Stock cannot be negative");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    const path = 'products';
    try {
      if (editingProduct) {
        const internalId = (editingProduct as any).internalId;
        const docRef = doc(db, path, internalId);
        await updateDoc(docRef, { ...formData, updatedAt: serverTimestamp() });
        
        if (user) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'UPDATE_PRODUCT',
            targetId: formData.id,
            targetName: formData.name,
            details: `Updated product via dashboard.`
          });
        }
      } else {
        const docRef = await addDoc(collection(db, path), { ...formData, updatedAt: serverTimestamp() });
        
        if (user) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'CREATE_PRODUCT',
            targetId: formData.id,
            targetName: formData.name,
            details: `Manually added product via dashboard.`
          });
        }
      }
      setIsAdding(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const validatePartnerForm = () => {
    if (!partnerFormData.name) {
      alert("Please enter partner name");
      return false;
    }
    return true;
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePartnerForm()) return;
    const path = 'partners';
    try {
      if (editingPartner) {
        const docRef = doc(db, path, editingPartner.internalId);
        await updateDoc(docRef, { ...partnerFormData, updatedAt: serverTimestamp() });
        
        if (user) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'UPDATE_PARTNER',
            targetName: partnerFormData.name,
            details: `Updated partner: ${partnerFormData.name}`
          });
        }
      } else {
        await addDoc(collection(db, path), { ...partnerFormData, updatedAt: serverTimestamp() });
        
        if (user) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'CREATE_PARTNER',
            targetName: partnerFormData.name,
            details: `Added new partner: ${partnerFormData.name}`
          });
        }
      }
      setIsAddingPartner(false);
      setEditingPartner(null);
      fetchPartners();
    } catch (err) {
      handleFirestoreError(err, editingPartner ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handlePartnerDelete = async (id: string) => {
    const path = 'partners';
    if (confirm('Delete this partner?')) {
      try {
        const partnerToDelete = partners.find(p => p.internalId === id);
        await deleteDoc(doc(db, path, id));
        
        if (user && partnerToDelete) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'DELETE_PARTNER',
            targetName: partnerToDelete.name,
            details: `Removed partner: ${partnerToDelete.name}`
          });
        }
        
        fetchPartners();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const path = 'products';
    if (confirm('Are you sure you want to delete this part?')) {
      try {
        const productToDelete = products.find(p => (p as any).internalId === id);
        await deleteDoc(doc(db, path, id));
        
        if (user && productToDelete) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'DELETE_PRODUCT',
            targetId: productToDelete.id,
            targetName: productToDelete.name,
            details: `Deleted product from catalog.`
          });
        }

        fetchProducts();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const BATCH_SIZE = 500;
        let importedCount = 0;
        
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const chunk = data.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          
          chunk.forEach((item: any) => {
            // Enhanced mapping based on MercadoLibre/Standard exports
            const name = String(item.Título || item.titulo || item.name || item.Name || 'Unnamed Product');
            const sku = String(item.SKU || item.sku || item.oeReference || '');
            const id = String(item.ID || item.id || sku || Math.random().toString(36).substr(2, 9));
            const brandFromTitle = name.split(' ')[1] || 'Generic';
            
            const docRef = doc(collection(db, 'products'));
            batch.set(docRef, {
              id,
              name,
              brand: String(item.brand || item.Brand || item.Marca || item.marca || brandFromTitle),
              category: String(item.category || item.Category || item.Categoría || 'Spark Plugs'),
              price: Number(item.price || item.Price || item.Precio || 10),
              stock: Number(item.stock || item.Stock || item.Inventario || 50),
              image: String(item.image || item.Image || item.Imagen || 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800'),
              description: String(item.description || item.Description || item.Descripción || `SKU: ${sku}`),
              specs: {
                sku: sku || 'N/A',
                condition: String(item.Condición || item.condition || 'new'),
                weight: String(item.Peso || item.weight || 'N/A'),
                matchType: String(item.Tipo || item.type || 'N/A')
              },
              updatedAt: serverTimestamp()
            });
            importedCount++;
          });
          
          await batch.commit();
        }
        
        if (user) {
          auditLogService.recordAction({
            adminId: user.uid,
            adminEmail: user.email || 'unknown',
            action: 'IMPORT_CSV',
            details: `Excel file import: ${importedCount} products integrated.`
          });
        }

        alert(`SUCCESS: ${importedCount} products integrated into the Master Hub.`);
        fetchProducts();
      } catch (err) {
        console.error('Excel Import Error:', err);
        alert('CRITICAL: Failed to parse matrix data.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvHeaders(results.meta.fields || []);
        setCsvRows(results.data);
        setIsCsvMappingModalOpen(true);
        
        // Auto-mapping attempt
        const mapping: Record<string, string> = {};
        const fields = results.meta.fields || [];
        fields.forEach(f => {
          const lower = f.toLowerCase();
          if (lower.includes('sku') || lower.includes('referencia')) mapping.sku = f;
          if (lower === 'id' || lower.includes('identifier')) mapping.id = f;
          if (lower.includes('título') || lower.includes('nombre') || lower.includes('title') || lower === 'name') mapping.name = f;
          if (lower.includes('marca') || lower.includes('brand')) mapping.brand = f;
          if (lower.includes('precio') || lower.includes('price')) mapping.price = f;
          if (lower.includes('stock') || lower.includes('inventario') || lower.includes('cantidad')) mapping.stock = f;
          if (lower.includes('descripción') || lower.includes('description')) mapping.description = f;
          if (lower.includes('imagen') || lower.includes('image')) mapping.image = f;
        });
        setColumnMapping(mapping);
      },
      error: (err) => {
        alert("CRITICAL: Failed to parse CSV file.");
        console.error(err);
      }
    });

    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleCsvImportSubmit = async () => {
    try {
      setLoading(true);
      const BATCH_SIZE = 500;
      let importedCount = 0;

      for (let i = 0; i < csvRows.length; i += BATCH_SIZE) {
        const chunk = csvRows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(row => {
          const sku = String(row[columnMapping.sku] || '');
          const id = String(row[columnMapping.id] || sku || Math.random().toString(36).substr(2, 9));
          const name = String(row[columnMapping.name] || 'Unnamed Product');

          const docRef = doc(collection(db, 'products'));
          batch.set(docRef, {
            id,
            name,
            brand: String(row[columnMapping.brand] || name.split(' ')[1] || 'Generic'),
            category: 'Spark Plugs',
            price: Number(row[columnMapping.price] || 10),
            stock: Number(row[columnMapping.stock] || 0),
            image: String(row[columnMapping.image] || 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800'),
            description: String(row[columnMapping.description] || `SKU: ${sku}`),
            specs: {
              sku: sku || 'N/A',
              condition: 'new',
              weight: 'N/A',
              matchType: 'N/A'
            },
            updatedAt: serverTimestamp()
          });
          importedCount++;
        });

        await batch.commit();
      }

      if (user) {
        auditLogService.recordAction({
          adminId: user.uid,
          adminEmail: user.email || 'unknown',
          action: 'IMPORT_CSV',
          details: `CSV matrix import: ${importedCount} products integrated.`
        });
      }

      alert(`SUCCESS: ${importedCount} products integrated from CSV.`);
      setIsCsvMappingModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error('CSV Import Error:', err);
      alert('CRITICAL: Batch injection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    // Try to find product by ID or fill form
    const existing = products.find(p => p.id === decodedText);
    if (existing) {
      setEditingProduct(existing);
      setFormData(existing as any);
      setIsAdding(true);
    } else {
      setFormData({ ...formData, id: decodedText });
      setIsAdding(true);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStock = true;
    if (stockFilter === 'in-stock') matchesStock = p.stock > 0;
    else if (stockFilter === 'low-stock') matchesStock = p.stock > 0 && p.stock <= 5;
    else if (stockFilter === 'out-of-stock') matchesStock = p.stock === 0;

    let matchesMatchType = true;
    if (matchTypeFilter !== 'all') {
      matchesMatchType = (p as any).matchType === matchTypeFilter;
    }

    return matchesSearch && matchesStock && matchesMatchType;
  });

  const uniqueMatchTypes = Array.from(new Set(products.map(p => (p as any).matchType).filter(Boolean))) as string[];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="admin-modal-main" className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-6xl h-[90vh] bg-neutral-950 border border-neutral-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            {!isAuthorized ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-black">
                <div className="w-full max-w-sm space-y-8">
                  <div className="text-center">
                    <div className="inline-block p-4 bg-orange-500 rounded-none text-white mb-6 shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                      <Zap size={48} className="fill-current" />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-white mb-2">Restricted Area</h2>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.3em]">Master Access Verification Required</p>
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Identidad</label>
                      <input 
                        type="text"
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 p-4 text-white focus:border-orange-500 outline-none font-bold placeholder:text-neutral-700 tracking-wide"
                        placeholder="ADMIN ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Código de Acceso</label>
                      <input 
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 p-4 text-white focus:border-orange-500 outline-none font-bold placeholder:text-neutral-700 tracking-wide"
                        placeholder="••••••••"
                      />
                    </div>
                    
                    {authError && (
                      <motion.p 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center"
                      >
                        {authError}
                      </motion.p>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-orange-500 text-white py-5 font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-[0.98]"
                    >
                      Authenticate System
                    </button>
                    
                    <button 
                      type="button"
                      onClick={onClose}
                      className="w-full border border-neutral-800 text-neutral-500 py-4 font-black uppercase tracking-widest hover:bg-neutral-900 transition-all text-xs"
                    >
                      Abort Mission
                    </button>
                  </form>
                  
                  <div className="pt-8 text-center text-neutral-800">
                    <p className="text-[8px] font-black uppercase tracking-[0.4em]">Encrypted Session • Version 4.0.1</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500 rounded-none text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Admin Hub</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-none">Superadmin Control Cluster</p>
                      <div className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 border text-[7px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors",
                        isDbConnected === true ? "bg-green-500/10 border-green-500/50 text-green-500" : 
                        isDbConnected === false ? "bg-red-500/10 border-red-500/50 text-red-500" :
                        "bg-neutral-500/10 border-neutral-500/50 text-neutral-500"
                      )}
                      onClick={manualTestConnection}
                      >
                        <div className={cn(
                          "w-1 h-1 rounded-full",
                          isDbConnected === true ? "bg-green-500 animate-pulse" : 
                          isDbConnected === false ? "bg-red-500" : "bg-neutral-500"
                        )} />
                        {isTestingDb ? "TESTING..." : isDbConnected === true ? "DB: ONLINE" : isDbConnected === false ? "DB: ERROR" : "CHECK DB"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex bg-neutral-900 p-1 border border-neutral-800 mr-4">
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'inventory' ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-white"
                    )}
                  >
                    Inventory
                  </button>
                  <button 
                    onClick={() => setActiveTab('partners')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'partners' ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-white"
                    )}
                  >
                    Partners
                  </button>
                  <button 
                    onClick={() => setActiveTab('admins')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'admins' ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-white"
                    )}
                  >
                    Admins
                  </button>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'logs' ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-white"
                    )}
                  >
                    Audit
                  </button>
                  <button 
                    onClick={() => setActiveTab('marketing')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'marketing' ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-white"
                    )}
                  >
                    Marketing
                  </button>
                </div>
                
                <button 
                  onClick={onClose}
                  className="flex items-center gap-2 bg-neutral-900 text-neutral-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-neutral-800 mr-2"
                >
                  <ExternalLink size={14} /> <span>Exit Hub</span>
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                {activeTab === 'inventory' ? (
                  <>
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-500 transition-colors" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search DB..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-black border border-neutral-800 p-2 pl-10 text-xs text-white focus:border-orange-500 outline-none transition-all w-48"
                      />
                    </div>
                    
                    <select
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value as any)}
                      className="bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase text-white p-2 focus:border-orange-500 outline-none"
                    >
                      <option value="all">Everywhere</option>
                      <option value="in-stock">In Stock</option>
                      <option value="low-stock">Low Stock (≤5)</option>
                      <option value="out-of-stock">Zero Stock</option>
                    </select>

                    {uniqueMatchTypes.length > 0 && (
                      <select
                        value={matchTypeFilter}
                        onChange={(e) => setMatchTypeFilter(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase text-white p-2 focus:border-orange-500 outline-none"
                      >
                        <option value="all">All Types</option>
                        {uniqueMatchTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    )}

                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleExcelImport} 
                    />
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      ref={csvInputRef} 
                      onChange={handleCsvSelect} 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all border border-neutral-700"
                    >
                      <Upload size={14} /> <span>Import Excel</span>
                    </button>
                    <button 
                      onClick={() => csvInputRef.current?.click()}
                      className="flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all border border-neutral-700"
                    >
                      <FileText size={14} /> <span>Import CSV</span>
                    </button>
                    <button 
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition-all",
                        isSyncing 
                          ? "bg-neutral-800 text-neutral-500 border-neutral-800 cursor-not-allowed" 
                          : "bg-orange-500/10 text-orange-500 border-orange-500/50 hover:bg-orange-500 hover:text-white"
                      )}
                    >
                      <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
                      <span>{isSyncing ? "Syncing..." : "Sync Supabase"}</span>
                    </button>
                    <button 
                      onClick={() => setIsPasteModalOpen(true)}
                      className="flex items-center gap-2 bg-neutral-900 text-orange-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-neutral-800"
                    >
                      <Plus size={14} /> <span>Bulk Paste</span>
                    </button>
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.pdf,.doc,.docx,.txt';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) alert(`File "${file.name}" ready for upload. Please configure Firebase Storage for persistence.`);
                        };
                        input.click();
                      }}
                      className="flex items-center gap-2 bg-neutral-900 text-neutral-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-neutral-800"
                    >
                      <FileText size={14} /> <span>Upload Doc</span>
                    </button>
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) alert(`Media "${file.name}" ready for upload. Please configure Firebase Storage for persistence.`);
                        };
                        input.click();
                      }}
                      className="flex items-center gap-2 bg-neutral-900 text-neutral-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-neutral-800"
                    >
                      <ImageIcon size={14} /> <span>Add Media</span>
                    </button>
                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setFormData({ id: '', name: '', brand: '', category: 'Spark Plugs', price: 0, stock: 0, image: '', description: '', tags: [] });
                        setIsAdding(true);
                      }}
                      className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
                    >
                      <Plus size={14} /> <span>Part</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setEditingPartner(null);
                      setPartnerFormData({ name: '', image: '', type: 'workshop', location: '', description: '', isPromoted: false, socials: { instagram: '', whatsapp: '', web: '' } });
                      setIsAddingPartner(true);
                    }}
                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
                  >
                    <Plus size={14} /> <span>Partner</span>
                  </button>
                )}
                
                <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-800">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
                </div>
              ) : activeTab === 'inventory' ? (
                <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Part Info</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Stock</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Type</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((prod, idx) => (
                      <tr key={`adm-inv-row-v2-${prod.internalId || prod.id || 'no-id'}-${idx}`} className="border-b border-neutral-900 group">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <img src={prod.image} className="w-10 h-10 object-cover border border-neutral-800" />
                            <div>
                              <p className="text-white font-bold text-sm tracking-tight">{prod.name}</p>
                              <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{prod.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-bold",
                              prod.stock === 0 ? "text-red-500" : prod.stock <= 5 ? "text-yellow-500" : "text-green-500"
                            )}>
                              {prod.stock}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">units</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-1">
                            {(prod as any).matchType || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a href={`https://www.sparkplug-crossreference.com/search/${prod.name}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 px-2 py-1 rounded">
                              <ExternalLink size={10} /> Ref.
                            </a>
                            <button onClick={() => { setEditingProduct(prod); setFormData(prod as any); setIsAdding(true); }} className="p-2 text-neutral-400 hover:text-white"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete((prod as any).internalId)} className="p-2 text-neutral-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 text-center">
                  <button 
                    onClick={() => fetchProducts(true)}
                    disabled={loadingMore}
                    className="text-xs text-neutral-500 font-bold uppercase tracking-widest hover:text-white transition-all disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
                </>
              ) : activeTab === 'partners' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Partner</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Type</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((partner, idx) => (
                      <tr key={`partner-tab-row-v2-${partner.internalId || 'no-id'}-${idx}`} className="border-b border-neutral-900 group hover:bg-neutral-900/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                              {partner.image ? <img src={partner.image} className="w-full h-full object-cover" /> : <Globe size={16} className="text-neutral-700" />}
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm tracking-tight">{partner.name}</p>
                              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{partner.location}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-1 border border-orange-500/20">{partner.type}</span>
                        </td>
                        <td className="py-4">
                          {partner.isPromoted && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-500">
                              <CheckCircle2 size={10} /> Promoted
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingPartner(partner);
                                setPartnerFormData(partner);
                                setIsAddingPartner(true);
                              }}
                              className="p-2 text-neutral-400 hover:text-white"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handlePartnerDelete(partner.internalId)}
                              className="p-2 text-neutral-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : activeTab === 'admins' ? (
                <div className="space-y-6">
                  <div className="flex gap-2">
                    <input 
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      placeholder="Admin email"
                      className="flex-1 bg-black border border-neutral-800 p-2 text-white text-sm"
                    />
                    <button onClick={handleAddAdmin} className="bg-orange-500 text-white px-4 py-2 text-[10px] uppercase font-black">Add Admin</button>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Email</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin, idx) => (
                        <tr key={`admin-row-v2-${admin.internalId || 'no-id'}-${idx}`} className="border-b border-neutral-900">
                          <td className="py-4 text-white text-sm">{admin.email}</td>
                          <td className="py-4 text-right">
                            <button onClick={() => handleRemoveAdmin(admin.internalId)} className="p-2 text-neutral-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : activeTab === 'marketing' ? (
                <div className="max-w-2xl">
                  <MarketingImageGenerator />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Master Record of Administrative Actions</h4>
                    <button onClick={fetchAuditLogs} className="p-2 text-neutral-500 hover:text-white transition-colors">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Timestamp</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Admin</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Action</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Target / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {auditLogs.map((log, idx) => (
                        <tr key={`audit-log-row-${log.internalId || idx}`} className="group hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-white leading-none mb-1">
                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : 'Pending'}
                              </span>
                              <span className="text-[9px] text-neutral-500 font-mono italic">
                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs text-neutral-300 font-medium">{log.adminEmail}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border",
                              log.action.includes('DELETE') ? "bg-red-500/10 border-red-500/50 text-red-500" :
                              log.action.includes('CREATE') ? "bg-green-500/10 border-green-500/50 text-green-500" :
                              log.action.includes('SYNC') || log.action.includes('IMPORT') ? "bg-blue-500/10 border-blue-500/50 text-blue-500" :
                              "bg-neutral-500/10 border-neutral-500/50 text-neutral-400"
                            )}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col gap-0.5">
                              {log.targetName && (
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tight">{log.targetName}</span>
                              )}
                              <span className="text-[10px] text-neutral-400 leading-tight">{log.details}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-neutral-600 italic text-[10px] uppercase tracking-widest">
                            No administrative records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Total Footer Status */}
            <div className="p-4 bg-orange-500/5 border-t border-neutral-800 flex items-center justify-between">
               <div className="flex gap-6">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Database Synchronized</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Total References: {products.length}</span>
                 </div>
               </div>
               
               <button 
                 onClick={async () => {
                   const { syncInventoryFromSupabaseToFirebase } = await import('../services/migrationService');
                   await syncInventoryFromSupabaseToFirebase();
                   alert("Sync completed. Please refresh products list.");
                   fetchProducts();
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-tighter transition-all"
               >
                 <Package size={12} className="fill-current" />
                 Sync Inventory
               </button>
               <button 
                 onClick={async () => {
                   const { vectorDbService } = await import('../services/vectorDbService');
                   const res = await vectorDbService.syncProducts();
                   alert(`Sync complete: ${res.syncedCount} synced, ${res.errorCount} failures.`);
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-tighter transition-all"
               >
                 <Zap size={12} className="fill-current" />
                 Sync RAG Vectors
               </button>
            </div>
              </>
            )}
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Paste Import Modal */}
      <AnimatePresence>
        {isPasteModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
              onClick={() => setIsPasteModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 p-8"
            >
              <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Bulk Data Import</h3>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-6">Paste tab-separated data from Excel or MercadoLibre</p>
              
              <textarea 
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="ID	SKU	Título	Condición	Tipo	Peso	Envio Express..."
                className="w-full h-64 bg-neutral-900 border border-neutral-800 p-4 text-xs text-white font-mono focus:border-orange-500 outline-none resize-none mb-6"
              />
              
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePasteImport}
                  className="px-8 py-3 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                >
                  Start Grid Injection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Add/Edit Overlay */}
      <AnimatePresence key="admin-add-presence">
        {isAdding && (
          <div key="admin-add-modal" className="fixed inset-0 z-[800] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-md"
               onClick={() => setIsAdding(false)}
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl"
             >
               <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-8">
                 {editingProduct ? 'Edit Reference' : 'Append New Reference'}
               </h3>
               
               <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Ref ID / Barcode</label>
                      <input 
                        required 
                        value={formData.id} 
                        onChange={e => setFormData({...formData, id: e.target.value})} 
                        className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Part Name</label>
                      <input 
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Brand</label>
                      <input 
                        required 
                        value={formData.brand} 
                        onChange={e => setFormData({...formData, brand: e.target.value})} 
                        className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                      />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Category</label>
                      <select 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                      >
                        {categories.map((c, cIdx) => <option key={`cat-opt-${c}-${cIdx}`} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Price (USD)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          required 
                          value={formData.price} 
                          onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                          className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Stock</label>
                        <input 
                          type="number" 
                          required 
                          value={formData.stock} 
                          onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                          className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Image URL</label>
                      <div className="flex gap-2">
                        <input 
                          value={formData.image} 
                          onChange={e => setFormData({...formData, image: e.target.value})} 
                          className="flex-1 bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                        />
                        <button 
                          type="button"
                          disabled={isGeneratingImage}
                          onClick={async () => {
                            const prompt = formData.description || formData.name;
                            if (!prompt) {
                              alert("Please enter a name or description first.");
                              return;
                            }
                            try {
                              setIsGeneratingImage(true);
                              const imageUrl = await generateAIImage(`Photorealistic professional studio product photo of ${prompt}, high quality, focused on details`, "4:3");
                              setFormData({...formData, image: imageUrl});
                            } catch (e) {
                              alert("Error generating image with Gemini API.");
                            } finally {
                              setIsGeneratingImage(false);
                            }
                          }}
                          className={cn(
                            "bg-neutral-800 text-neutral-400 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2",
                            isGeneratingImage && "animate-pulse"
                          )}
                        >
                          {isGeneratingImage && <RefreshCw size={10} className="animate-spin" />}
                          AI GENERATE
                        </button>
                      </div>
                    </div>
                 </div>

                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Tags / Labels (Separated by commas)</label>
                    <input 
                      value={(formData as any).tags?.join(', ') || ''} 
                      onChange={e => {
                        const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                        setFormData({...formData, tags} as any);
                      }} 
                      placeholder="New Arrival, Best Seller, Special Offer"
                      className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                    />
                 </div>

                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Technical Specs / Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm h-24"
                    />
                 </div>

                 <div className="col-span-2 flex gap-4 mt-4">
                   <button 
                     type="button" 
                     onClick={() => setIsAdding(false)}
                     className="flex-1 bg-neutral-800 text-white font-black uppercase tracking-widest py-4 hover:bg-neutral-700 transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit" 
                     className="flex-1 bg-orange-500 text-white font-black uppercase tracking-widest py-4 hover:bg-orange-600 transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)]"
                   >
                     {editingProduct ? 'Commit Changes' : 'Append Reference'}
                   </button>
                 </div>
               </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Mapping Modal */}
      <AnimatePresence>
        {isCsvMappingModalOpen && (
          <div key="csv-mapping-modal" className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setIsCsvMappingModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white">CSV Data Matrix Mapping</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Map your source columns to the product schema</p>
                </div>
                <button onClick={() => setIsCsvMappingModalOpen(false)} className="text-neutral-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'id', label: 'Unique Identifier' },
                    { key: 'sku', label: 'OEM / Part SKU' },
                    { key: 'name', label: 'Product Title' },
                    { key: 'brand', label: 'Manufacturer' },
                    { key: 'price', label: 'Unit Price ($)' },
                    { key: 'stock', label: 'Initial Inventory' },
                    { key: 'description', label: 'Description/Notes' },
                    { key: 'image', label: 'Asset URL (Optional)' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">{field.label}</label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs text-white focus:border-orange-500 outline-none"
                      >
                        <option value="">-- Ignored --</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-4">
                  <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">Live Preview (Row 1)</h4>
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    {Object.entries(columnMapping).map(([key, header]) => (
                      <div key={`preview-${key}`} className="flex justify-between border-b border-neutral-800 pb-1">
                        <span className="text-neutral-600 font-bold uppercase">{key}:</span>
                        <span className="text-white truncate max-w-[150px]">{csvRows[0]?.[header] || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-800 flex gap-4">
                <button 
                  onClick={handleCsvImportSubmit}
                  disabled={loading}
                  className="flex-1 bg-orange-500 text-white py-3 font-black uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing Matrix...' : 'Import Matrix Data'}
                </button>
                <button 
                  onClick={() => setIsCsvMappingModalOpen(false)}
                  className="px-6 border border-neutral-800 text-neutral-500 font-black uppercase tracking-widest hover:bg-neutral-900 transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <AnimatePresence key="admin-partner-presence">
        {isAddingPartner && (
          <div key="admin-partner-modal" className="fixed inset-0 z-[800] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsAddingPartner(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-8">
                {editingPartner ? 'Modify Partner' : 'Appoint New Partner'}
              </h3>
              
              <form onSubmit={handlePartnerSubmit} className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Entity Name</label>
                    <input 
                      required 
                      value={partnerFormData.name} 
                      onChange={e => setPartnerFormData({...partnerFormData, name: e.target.value})} 
                      className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      value={partnerFormData.type} 
                      onChange={e => setPartnerFormData({...partnerFormData, type: e.target.value as any})} 
                      className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                    >
                      {partnerTypes.map((t, tIdx) => <option key={`type-opt-${t}-${tIdx}`} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Location / Zone</label>
                    <input 
                      value={partnerFormData.location} 
                      onChange={e => setPartnerFormData({...partnerFormData, location: e.target.value})} 
                      className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Cover Image URL</label>
                    <div className="flex gap-2">
                      <input 
                        value={partnerFormData.image} 
                        onChange={e => setPartnerFormData({...partnerFormData, image: e.target.value})} 
                        className="flex-1 bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm"
                      />
                      <button 
                          type="button"
                          disabled={isGeneratingPartnerImage}
                          onClick={async () => {
                            const prompt = partnerFormData.description || partnerFormData.name;
                            if (!prompt) {
                              alert("Please enter a name or description first.");
                              return;
                            }
                            try {
                              setIsGeneratingPartnerImage(true);
                              const imageUrl = await generateAIImage(`Professional storefront or workshop logo/photo for ${prompt}, clean composition, architectural photography`, "16:9");
                              setPartnerFormData({...partnerFormData, image: imageUrl});
                            } catch (e) {
                              alert("Error generating image with Gemini API.");
                            } finally {
                              setIsGeneratingPartnerImage(false);
                            }
                          }}
                          className={cn(
                            "bg-neutral-800 text-neutral-400 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2",
                            isGeneratingPartnerImage && "animate-pulse"
                          )}
                        >
                          {isGeneratingPartnerImage && <RefreshCw size={10} className="animate-spin" />}
                          AI GENERATE
                        </button>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="isPromoted"
                        checked={partnerFormData.isPromoted} 
                        onChange={e => setPartnerFormData({...partnerFormData, isPromoted: e.target.checked})} 
                        className="accent-orange-500"
                      />
                      <label htmlFor="isPromoted" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Promote on Showcase</label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Social Links (IG/WA/WEB)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <input 
                      placeholder="Instagram" 
                      value={partnerFormData.socials.instagram} 
                      onChange={e => setPartnerFormData({...partnerFormData, socials: { ...partnerFormData.socials, instagram: e.target.value }})} 
                      className="bg-black border border-neutral-800 p-2 text-xs text-white outline-none" 
                    />
                    <input 
                      placeholder="WhatsApp" 
                      value={partnerFormData.socials.whatsapp} 
                      onChange={e => setPartnerFormData({...partnerFormData, socials: { ...partnerFormData.socials, whatsapp: e.target.value }})} 
                      className="bg-black border border-neutral-800 p-2 text-xs text-white outline-none" 
                    />
                    <input 
                      placeholder="Website" 
                      value={partnerFormData.socials.web} 
                      onChange={e => setPartnerFormData({...partnerFormData, socials: { ...partnerFormData.socials, web: e.target.value }})} 
                      className="bg-black border border-neutral-800 p-2 text-xs text-white outline-none" 
                    />
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Brief Description</label>
                  <textarea 
                    value={partnerFormData.description} 
                    onChange={e => setPartnerFormData({...partnerFormData, description: e.target.value})} 
                    className="w-full bg-black border border-neutral-800 p-3 text-white focus:border-orange-500 outline-none text-sm h-20"
                  />
                </div>

                <div className="col-span-2 flex gap-4 mt-4">
                  <button type="button" onClick={() => setIsAddingPartner(false)} className="flex-1 bg-neutral-800 text-white font-black uppercase tracking-widest py-4 hover:bg-neutral-700 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white font-black uppercase tracking-widest py-4 hover:bg-orange-600 transition-all">Save Business</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
