import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  setDoc, 
  doc, 
  limit, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp?: any;
  attachments?: { name: string; type: string; data: string }[];
  recommendedProductId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
  updatedAt: any;
  lastMessage?: string;
}

export interface UserMemory {
  summary: string;
  preferences: string[];
  vehicleInfo: string;
  lastUpdate: any;
}

export const chatService = {
  // Session Management
  async createSession(userId: string, title: string = 'New Conversation'): Promise<string> {
    const path = `users/${userId}/sessions`;
    try {
      const sessionsRef = collection(db, 'users', userId, 'sessions');
      const docRef = await addDoc(sessionsRef, {
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async getSessions(userId: string): Promise<ChatSession[]> {
    const path = `users/${userId}/sessions`;
    try {
      const sessionsRef = collection(db, 'users', userId, 'sessions');
      const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  // Message Management
  async saveMessage(userId: string, sessionId: string, message: Message) {
    const path = `users/${userId}/sessions/${sessionId}/messages`;
    try {
      const messagesRef = collection(db, 'users', userId, 'sessions', sessionId, 'messages');
      
      // Prune attachments if too large for Firestore
      const msgToSave = JSON.parse(JSON.stringify(message));
      if (msgToSave.attachments) {
        const estimatedSize = JSON.stringify(msgToSave).length;
        if (estimatedSize > 800000) {
          msgToSave.attachments = msgToSave.attachments.map((a: any) => ({ ...a, data: '__REMOVED_FOR_SIZE__' }));
        }
      }

      await addDoc(messagesRef, {
        ...msgToSave,
        timestamp: serverTimestamp()
      });

      // Update session "updatedAt" and "lastMessage"
      const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        updatedAt: serverTimestamp(),
        lastMessage: message.content.substring(0, 100)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async clearSessionMessages(userId: string, sessionId: string) {
    const path = `users/${userId}/sessions/${sessionId}/messages`;
    try {
      const messagesRef = collection(db, 'users', userId, 'sessions', sessionId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(d => deleteDoc(doc(db, 'users', userId, 'sessions', sessionId, 'messages', d.id)));
      await Promise.all(deletePromises);
      
      // Update session lastMessage
      const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        lastMessage: '',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  async deleteSession(userId: string, sessionId: string) {
    const path = `users/${userId}/sessions/${sessionId}`;
    try {
      // 1. Delete all messages first (Firestore doesn't delete subcollections automatically)
      const messagesRef = collection(db, 'users', userId, 'sessions', sessionId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(d => deleteDoc(doc(db, 'users', userId, 'sessions', sessionId, 'messages', d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the session document
      const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // Long-term Memory
  async getUserMemory(userId: string): Promise<UserMemory | null> {
    const path = `users/${userId}/memory/main`;
    try {
      const memoryRef = doc(db, 'users', userId, 'memory', 'main');
      const snapshot = await getDoc(memoryRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserMemory;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  async updateUserMemory(userId: string, memory: Partial<UserMemory>) {
    const path = `users/${userId}/memory/main`;
    try {
      const memoryRef = doc(db, 'users', userId, 'memory', 'main');
      const existing = await this.getUserMemory(userId);
      
      if (existing) {
        await updateDoc(memoryRef, {
          ...memory,
          lastUpdate: serverTimestamp()
        });
      } else {
        await setDoc(memoryRef, {
          summary: memory.summary || '',
          preferences: memory.preferences || [],
          vehicleInfo: memory.vehicleInfo || '',
          lastUpdate: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }
};
