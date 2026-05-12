import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, MapPin, LogOut, History, Heart, ShoppingBag, Settings } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from '../store/authSlice';

interface UserSessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminClick: () => void;
}

export function UserSessionDrawer({ isOpen, onClose, onAdminClick }: UserSessionDrawerProps) {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    onClose();
  };

  const handleUpdate = async () => {
    if (!user) return;
    setIsUpdating(true);
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        phone,
        location,
        updatedAt: serverTimestamp()
      });
      dispatch(updateProfile({ phone, location }));
      alert('Profile updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="user-session-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[550] bg-black/60 backdrop-blur-sm"
        />
      )}
      {isOpen && (
        <motion.div
          key="user-session-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 z-[560] w-full max-w-md bg-neutral-900 border-l border-neutral-800 flex flex-col"
        >
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">Member Profile</h2>
              <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Profile Header */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  {user.photoURL ? (
                    <img src={user.photoURL} className="w-24 h-24 rounded-none border-2 border-orange-500 p-1" />
                  ) : (
                    <div className="w-24 h-24 bg-neutral-800 border-2 border-orange-500 flex items-center justify-center">
                      <User size={40} className="text-orange-500" />
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <div className="absolute -bottom-2 bg-orange-500 text-white text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1">
                      Superadmin
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{user.displayName}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{user.email}</p>
                </div>
              </div>

              {/* Admin Access */}
              {user.role === 'admin' && (
                <button 
                  onClick={onAdminClick}
                  className="w-full bg-orange-500/10 border border-orange-500/20 p-4 flex items-center justify-between group hover:bg-orange-500/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={20} className="text-orange-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-orange-500">Open Admin Panel</span>
                  </div>
                </button>
              )}

              {/* Editable Info */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+58 412..."
                      className="w-full bg-black border border-neutral-800 p-3 pl-10 text-white focus:border-orange-500 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Geographical Ubication</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input 
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Caracas, VZLA"
                      className="w-full bg-black border border-neutral-800 p-3 pl-10 text-white focus:border-orange-500 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="w-full bg-white text-black font-black uppercase tracking-widest py-4 hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Sync Profile Data'}
                </button>
                
                <button 
                  onClick={async () => {
                    try {
                      const { verifyFirestoreConnection } = await import('../lib/firebase');
                      await verifyFirestoreConnection();
                      alert('Firebase connection successful!');
                    } catch (e) {
                      alert('Firebase connection failed: ' + String(e));
                    }
                  }}
                  className="w-full bg-neutral-800 text-white font-black uppercase tracking-widest py-4 hover:bg-neutral-700 transition-all text-xs"
                >
                  Test Backend Connection
                </button>
              </div>

              {/* User Stats/History Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border border-neutral-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History size={14} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Orders</span>
                  </div>
                  <span className="text-xl font-mono font-black text-white">0</span>
                </div>
                <div className="bg-black border border-neutral-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={14} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Favorites</span>
                  </div>
                  <span className="text-xl font-mono font-black text-white">0</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-black border-t border-neutral-800">
               <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 py-4 text-neutral-500 hover:text-red-500 font-black uppercase tracking-widest transition-all"
               >
                 <LogOut size={20} />
                 Terminate Session
               </button>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
