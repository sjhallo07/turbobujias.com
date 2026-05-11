import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, LogIn, Github, Chrome } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile as firebaseUpdateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/authSlice';
import { serializeUserDoc } from '../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSyncUser = async (user: any) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // Check if admin
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    const role = adminDoc.exists() ? 'admin' : 'customer';

    const userDataRaw = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || displayName,
      photoURL: user.photoURL,
      role: role as 'customer' | 'admin',
      lastLogin: serverTimestamp(),
    };

    const userData = serializeUserDoc(userDataRaw);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(userDocRef, userData, { merge: true });
    }

    dispatch(setUser(userData as any));
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleSyncUser(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError('');
    try {
      if (isResetting) {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent');
        setIsResetting(false);
      } else if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await handleSyncUser(result.user);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await firebaseUpdateProfile(result.user, { displayName });
        await handleSyncUser(result.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="auth-modal" className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-none shadow-2xl p-8"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
              <X size={20} />
            </button>

            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                {isResetting ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              {!isResetting && (
                <p className="text-xs text-neutral-500 mt-2 uppercase tracking-widest font-bold">
                  Join the TurboBujías Pro community
                </p>
              )}
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-black border border-neutral-800 p-3 pl-10 text-white focus:border-orange-500 outline-none transition-all text-sm"
                      placeholder="Your Name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-neutral-800 p-3 pl-10 text-white focus:border-orange-500 outline-none transition-all text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {!isResetting && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black border border-neutral-800 p-3 pl-10 text-white focus:border-orange-500 outline-none transition-all text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white font-black uppercase tracking-widest py-4 hover:bg-orange-600 transition-all disabled:opacity-50 mt-4"
              >
                {loading ? 'Processing...' : isResetting ? 'Send Reset Email' : isLogin ? 'Login Now' : 'Create Account'}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-neutral-900 px-4 text-neutral-600">
                  {isResetting ? 'Or' : 'Or continue with'}
                </span>
              </div>
            </div>

            {!isResetting && (
                <button
                onClick={handleGoogleSignIn}
                className="w-full bg-white text-black font-black uppercase tracking-widest py-3 flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all mb-8"
                >
                <Chrome size={18} />
                Google Login
                </button>
            )}

            <div className="text-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
              {isResetting ? (
                  <button onClick={() => setIsResetting(false)} className="text-orange-500 hover:underline">Back to Login</button>
              ) : (
                <>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-orange-500 hover:underline ml-1"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                    {!isLogin ? '' : ( 
                        <div className="mt-2">
                             <button onClick={() => setIsResetting(true)} className="text-neutral-400 hover:text-white hover:underline mt-2">
                                Forgot password?
                            </button>
                        </div>
                    )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
