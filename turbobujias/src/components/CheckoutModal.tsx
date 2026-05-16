import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, ShoppingBag, ExternalLink, Zap } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { clearCart, selectCartTotalAmount } from '../store/cartSlice';
import { formatPrice } from '../lib/utils';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const cart = useSelector((state: RootState) => state.cart.items);
  const totalAmount = useSelector(selectCartTotalAmount);
  const { rates, selectedCurrency } = useSelector((state: RootState) => state.currency);
  const dispatch = useDispatch();
  const paypalRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);
  const [isPaypalEligible, setIsPaypalEligible] = useState(false);
  const paypalSessionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && !scriptLoaded.current) {
      const initPayPal = async () => {
        if (window.paypal && window.paypal.createInstance) {
          try {
            const sdkInstance = await window.paypal.createInstance({
              clientId: "AfUDjefFU0bu7PJxDEHfIymomMIMHIwDvcw6bb3IHEs2FWg6pnk2ZJZ9sOfR50JmPWcLkM6CtG7Rn4AL",
              components: ["paypal-payments"],
              pageType: "checkout",
            });

            const paymentMethods = await sdkInstance.findEligibleMethods({
              currencyCode: "USD",
            });

            if (paymentMethods.isEligible("paypal")) {
              const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
                async onApprove(data: any) {
                  const orderData = await fetch("/api/capture-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId: data.orderId }),
                  });
                  console.log("Payment captured:", await orderData.json());
                  dispatch(clearCart());
                  onClose();
                },
                onCancel(data: any) { 
                  console.log("Cancelled:", data); 
                },
                onError(error: any) { 
                  console.error("Payment error:", error); 
                },
              });
              paypalSessionRef.current = paymentSession;
              setIsPaypalEligible(true);
              scriptLoaded.current = true;
            }
          } catch (err) {
            console.error("PayPal Init Error:", err);
            setTimeout(initPayPal, 1000);
          }
        } else {
          setTimeout(initPayPal, 100);
        }
      };
      initPayPal();
    }
  }, [isOpen, dispatch, onClose]);

  const handlePayPalCheckout = async () => {
    if (paypalSessionRef.current) {
      try {
        await paypalSessionRef.current.start(
          { presentationMode: "auto" },
          async () => {
            const res = await fetch("/api/create-order", { 
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: totalAmount,
                currency: "USD"
              })
            });
            const data = await res.json();
            return { orderId: data.id };
          }
        );
      } catch (err) {
        console.error("PayPal Start Error:", err);
      }
    }
  };

  const braintreeLoaded = useRef(false);

  useEffect(() => {
    if (isOpen && !braintreeLoaded.current) {
      const script = document.createElement('script');
      script.src = "https://js.braintreegateway.com/web/dropin/1.42.0/js/dropin.min.js";
      script.async = true;
      script.onload = () => {
        if (window.braintree) {
          window.braintree.dropin.create({
            authorization: 'sandbox_g42y39zw_348pk9cgf3bgyw2b',
            selector: '#dropin-container'
          }, (err, instance) => {
            if (err) {
              console.error('Braintree Load Error:', err);
              return;
            }
            const button = document.querySelector('#submit-button');
            if (button) {
              button.addEventListener('click', () => {
                instance.requestPaymentMethod((err, payload) => {
                  if (err) {
                    console.error('Braintree Payment Method Error:', err);
                    return;
                  }
                  console.log('Braintree Payload:', payload);
                  // Submit payload.nonce to your server
                });
              });
            }
          });
          braintreeLoaded.current = true;
        }
      };
      document.body.appendChild(script);
    }
  }, [isOpen]);

  const handleMercadoLibre = () => {
    window.open("https://www.mercadolibre.com.ve/pagina/turbobujias3646", "_blank");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="checkout-modal" className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-neutral-900 border border-neutral-800 p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-none flex flex-col"
        >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white transition-colors">
            <X size={24} />
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-orange-500 text-white rounded-xl">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Secure Checkout</h2>
              <p className="text-neutral-500 text-sm">Select your preferred payment method</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8 border-b border-neutral-800 mb-8">
            {/* MercadoLibre Option */}
            <div className="bg-neutral-800/50 border border-neutral-700 p-6 flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-[#FFF159] rounded-full flex items-center justify-center mb-4 border-4 border-neutral-900 group-hover:scale-110 transition-transform">
                <img src="https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__small.png" alt="ML" className="w-10" />
              </div>
              <h3 className="text-white font-bold mb-2">MercadoLibre</h3>
              <p className="text-neutral-500 text-xs mb-6">Redirect to our official store for secure local payment.</p>
              <button 
                onClick={handleMercadoLibre}
                className="w-full bg-[#3483FA] text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-[#2968c8] transition-all flex items-center justify-center gap-2"
              >
                <img src="/mercadolibre(1).jpg" alt="MercadoLibre" className="w-5 h-5 object-contain" />
                Compra con envio gratis
              </button>
            </div>

            {/* PayPal Option */}
            <div className="bg-neutral-800/50 border border-neutral-700 p-6 flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border-4 border-neutral-900 group-hover:scale-110 transition-transform">
                <CreditCard className="text-[#003087]" size={32} />
              </div>
              <h3 className="text-white font-bold mb-2">PayPal Checkout</h3>
              <p className="text-neutral-500 text-xs mb-6">International payments via credit card or PayPal balance.</p>
              
              {isPaypalEligible ? (
                <button 
                  onClick={handlePayPalCheckout}
                  className="w-full bg-[#0070ba] text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-[#005ea6] transition-all flex items-center justify-center gap-2 rounded-lg"
                >
                  Pay with PayPal
                </button>
              ) : (
                <div className="text-neutral-600 text-[10px] animate-pulse py-3">Initializing PayPal...</div>
              )}
            </div>

            {/* Braintree Option */}
            <div className="bg-neutral-800/50 border border-neutral-700 p-6 flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border-4 border-neutral-900 group-hover:scale-110 transition-transform">
                <CreditCard className="text-orange-500" size={32} />
              </div>
              <h3 className="text-white font-bold mb-2">Card Gateway</h3>
              <p className="text-neutral-500 text-xs mb-4">Direct secure payment via Braintree (Future Implementation).</p>
              
              <div id="dropin-container" className="w-full mb-4 min-h-[50px]"></div>
              <button 
                id="submit-button"
                className="w-full bg-orange-600 text-white py-3 font-bold text-xs uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-center gap-2"
              >
                Pay with Card
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest leading-none">Total Amount</span>
              <span className="text-2xl font-mono font-black text-white">{formatPrice(totalAmount, selectedCurrency, rates)}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-600">
               <Zap className="fill-current" size={12} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Encrypted & Secure</span>
            </div>
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

declare global {
  interface Window {
    paypal: any;
    braintree: any;
  }
}
