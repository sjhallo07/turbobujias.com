import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure the container is in the DOM
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            onClose();
          },
          (error) => {
            // Silence common errors like "No QR code found"
            // console.warn(`Code scan error = ${error}`);
          }
        );

        scannerRef.current = scanner;
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch((err) => console.error('Failed to clear scanner', err));
        }
      };
    }
  }, [isOpen, onScanSuccess, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="scanner-modal" className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-none shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-none text-white">
                  <Camera size={20} />
                </div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-tighter">Part Scanner</h3>
                  <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">QR / Barcode Recognition</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div id="reader" className="w-full rounded-none overflow-hidden border border-neutral-800 bg-black" />
              
              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-none w-full">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Position the part's barcode or QR code within the frame to automatically scan it.
                  </p>
                </div>
                
                <button 
                  onClick={onClose}
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 hover:text-orange-500 transition-colors"
                >
                  Cancel Scanning
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
