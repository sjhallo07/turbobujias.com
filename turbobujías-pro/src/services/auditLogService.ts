import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type AuditAction = 
  | 'CREATE_PRODUCT' 
  | 'UPDATE_PRODUCT' 
  | 'DELETE_PRODUCT' 
  | 'CREATE_PARTNER'
  | 'UPDATE_PARTNER'
  | 'DELETE_PARTNER'
  | 'SYNC_SUPABASE' 
  | 'IMPORT_CSV' 
  | 'USER_ROLE_CHANGE';

export interface AuditLogEntry {
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  targetId?: string;
  targetName?: string;
  details?: string;
}

export const auditLogService = {
  async recordAction(entry: AuditLogEntry) {
    try {
      const logsRef = collection(db, 'auditLogs');
      await addDoc(logsRef, {
        ...entry,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('Failed to record audit log:', err);
      // We don't throw here to avoid blocking administrative actions 
      // if logging fails, but in a production app you might want 
      // stronger consistency.
    }
  }
};
