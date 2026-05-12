import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Star, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { UserProfile } from '../store/authSlice';

interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
}

export function Reviews({ productId, user }: { productId: string, user: UserProfile | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const reviewsRef = collection(db, 'products', productId, 'reviews');
    const q = query(reviewsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `products/${productId}/reviews`));

    return () => unsubscribe();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comment.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'products', productId, 'reviews'), {
        productId,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      });
      setComment('');
      setRating(5);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${productId}/reviews`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t border-neutral-800">
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Reviews ({reviews.length})</h3>
      
      {user ? (
        <form onSubmit={handleSubmit} className="bg-neutral-950 p-4 border border-neutral-800 space-y-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((num, nIdx) => (
              <button type="button" key={`rating-val-${num}-${nIdx}`} title={`Rate ${num} stars`} onClick={() => setRating(num)}>
                <Star className={cn(num <= rating ? "fill-orange-500 text-orange-500" : "text-neutral-700")} size={20} />
              </button>
            ))}
          </div>
          <textarea 
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
            className="w-full bg-neutral-900 border border-neutral-800 p-2 text-sm text-white" 
            placeholder="Write your review..."
            maxLength={500}
          />
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 font-black uppercase text-xs"
          >
            <Send size={12} /> {isSubmitting ? 'Submitting...' : 'Post Review'}
          </button>
        </form>
      ) : (
        <p className="text-xs text-neutral-500">Sign in to leave a review.</p>
      )}

      <div className="space-y-4">
        {reviews.map((review, idx) => (
          <div key={`review-node-${review.id || idx}-${idx}`} className="border-b border-neutral-800 pb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm">{review.userName}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((num, sIdx) => <Star key={`review-${review.id}-star-${num}-${sIdx}`} className={cn(num <= review.rating ? "fill-orange-500 text-orange-500" : "text-neutral-700")} size={12} />)}
              </div>
            </div>
            <p className="text-sm text-neutral-300">{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
