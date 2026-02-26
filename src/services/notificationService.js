import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  limit
} from 'firebase/firestore';

const BARBERS_COLLECTION = 'barbers';

/**
 * BUSCA NOTIFICAÇÕES DO PROFISSIONAL
 * Traz os avisos ordenados do mais recente para o mais antigo.
 */
export const getNotifications = async (userId) => {
  try {
    const notificationsRef = collection(db, BARBERS_COLLECTION, userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

/**
 * MARCAR COMO LIDA
 * Muda o status visual para o profissional saber que já resolveu.
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const docRef = doc(db, BARBERS_COLLECTION, userId, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error("Error marking notification:", error);
  }
};

/**
 * DELETAR NOTIFICAÇÃO
 */
export const deleteNotification = async (userId, notificationId) => {
  try {
    const docRef = doc(db, BARBERS_COLLECTION, userId, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
};

/**
 * CRIAR NOTIFICAÇÃO MANUALMENTE (Para testes ou uso interno)
 * A IA usará uma lógica similar no backend.
 */
export const createNotification = async (userId, title, message, type = 'info') => {
  try {
    const notificationsRef = collection(db, BARBERS_COLLECTION, userId, 'notifications');
    await addDoc(notificationsRef, {
      title,
      message,
      type, // 'info', 'alert', 'success'
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};