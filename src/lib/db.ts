import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  type DocumentData,
  type QueryConstraint
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);

  // If it's an offline error, handle it gracefully without crashing or throwing a heavy exception
  if (errorMsg.toLowerCase().includes('offline')) {
    console.warn(`Firestore is operating offline (Operation: ${operationType}, Path: ${path}): ${errorMsg}`);
    return null;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto && proto !== Object.prototype && proto !== Array.prototype) {
      return obj;
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = cleanUndefined(val);
      }
    }
    return clean;
  }
  return obj;
}

export const getCollectionRef = (path: string) => {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  return collection(db, `users/${auth.currentUser.uid}/${path}`);
};

export const getDocRef = (path: string, id: string) => {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  return doc(db, `users/${auth.currentUser.uid}/${path}`, id);
};

export const getUserDocRef = () => {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  return doc(db, 'users', auth.currentUser.uid);
};

// Database Services
export const dbService = {
  async getUser() {
    const ref = getUserDocRef();
    try {
      const snap = await getDoc(ref);
      let data = snap.exists() ? snap.data() : null;
      
      // If user profile exists, enrich it with auth login info so the superadmin can view it
      if (data && (!data.email || !data.displayName || !data.lastLogin)) {
        const u = auth.currentUser;
        if (u) {
          const updated = {
            ...data,
            email: u.email || '',
            displayName: u.displayName || '',
            photoURL: u.photoURL || '',
            lastLogin: new Date().toISOString()
          };
          try {
            await updateDoc(ref, updated);
            data = updated;
          } catch (updateErr) {
            console.error('Failed to sync login traits to custom user profile:', updateErr);
          }
        }
      }
      
      if (data) {
        try {
          localStorage.setItem('user_settings_backup', JSON.stringify(data));
        } catch (localLockErr) {
          console.warn('Could not save user settings to local backup:', localLockErr);
        }
      }
      return data;
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.toLowerCase().includes('offline')) {
        console.warn('Firestore offline inside getUser, attempting local backup retrieval...');
        try {
          const cached = localStorage.getItem('user_settings_backup');
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (localErr) {
          console.error('Failed to parse cached local settings:', localErr);
        }
      }
      return handleFirestoreError(e, OperationType.GET, ref.path);
    }
  },

  async setUser(data: any) {
    const ref = getUserDocRef();
    const payload = cleanUndefined({
      ...data,
      email: auth.currentUser?.email || '',
      displayName: auth.currentUser?.displayName || '',
      photoURL: auth.currentUser?.photoURL || '',
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    try {
      await updateDoc(ref, payload);
      try {
        localStorage.setItem('user_settings_backup', JSON.stringify(payload));
      } catch (e) {}
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.toLowerCase().includes('offline')) {
        console.warn('Firestore offline during setUser, updated local backup settings');
        try {
          localStorage.setItem('user_settings_backup', JSON.stringify(payload));
        } catch (err) {}
        return;
      }
      // If it doesn't exist, try setting it
      try {
        const { setDoc } = await import('firebase/firestore');
        const cleanedPayload = cleanUndefined(payload);
        await setDoc(ref, cleanedPayload);
        try {
          localStorage.setItem('user_settings_backup', JSON.stringify(payload));
        } catch (err) {}
      } catch (ee) {
        handleFirestoreError(ee, OperationType.WRITE, ref.path);
      }
    }
  },

  subscribeToCollection(path: string, callback: (data: any[]) => void, constraints: QueryConstraint[] = []) {
    const ref = getCollectionRef(path);
    const q = query(ref, ...constraints);
    return onSnapshot(q, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (path === 'categories' || path === 'purchase_categories') {
        data = data.map((cat: any) => ({
          ...cat,
          subcategories: cat.subcategories 
            ? [...cat.subcategories].sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }))
            : []
        })).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }));
      }
      callback(data);
    }, (e) => {
      handleFirestoreError(e, OperationType.GET, path);
    });
  },

  async addItem(path: string, data: any) {
    const ref = getCollectionRef(path);
    try {
      const cleaned = cleanUndefined(data);
      const docRef = await addDoc(ref, { ...cleaned, createdAt: new Date().toISOString(), userId: auth.currentUser?.uid });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  async updateItem(path: string, id: string, data: any) {
    const ref = getDocRef(path, id);
    try {
      const cleaned = cleanUndefined(data);
      await updateDoc(ref, { ...cleaned, updatedAt: new Date().toISOString() });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async deleteItem(path: string, id: string) {
    const ref = getDocRef(path, id);
    try {
      await deleteDoc(ref);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, ref.path);
    }
  },

  // Shared Catalog Operations
  subscribeToCatalogStores(callback: (data: any[]) => void) {
    const ref = collection(db, 'catalog_stores');
    const q = query(ref, orderBy('name', 'asc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (e) => {
      handleFirestoreError(e, OperationType.GET, 'catalog_stores');
    });
  },

  async addCatalogStore(data: any) {
    const ref = collection(db, 'catalog_stores');
    try {
      const payload = {
        name: data.name,
        type: data.type || 'store',
        logoUrl: data.logoUrl || null,
        logoFileId: data.logoFileId || null,
        latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
        address: data.address || null,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(ref, payload);
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'catalog_stores');
    }
  },

  async updateCatalogStore(id: string, data: any) {
    const ref = doc(db, 'catalog_stores', id);
    try {
      const payload: any = {
        name: data.name,
        updatedAt: new Date().toISOString()
      };
      if (data.type !== undefined) payload.type = data.type;
      if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
      if (data.logoFileId !== undefined) payload.logoFileId = data.logoFileId;
      if (data.latitude !== undefined) payload.latitude = data.latitude !== null ? Number(data.latitude) : null;
      if (data.longitude !== undefined) payload.longitude = data.longitude !== null ? Number(data.longitude) : null;
      if (data.address !== undefined) payload.address = data.address || null;

      await updateDoc(ref, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `catalog_stores/${id}`);
    }
  },

  async deleteCatalogStore(id: string) {
    const ref = doc(db, 'catalog_stores', id);
    try {
      await deleteDoc(ref);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `catalog_stores/${id}`);
    }
  },

  subscribeToCatalog(callback: (data: any[]) => void) {
    const ref = collection(db, 'catalog');
    const q = query(ref, orderBy('priceDate', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (e) => {
      handleFirestoreError(e, OperationType.GET, 'catalog');
    });
  },

   async addCatalogProduct(data: any) {
    const ref = collection(db, 'catalog');
    try {
      const timestamp = new Date().toISOString();
      const payload: any = {
        name: data.name,
        store: data.store,
        price: Number(data.price),
        stock: Number(data.stock),
        priceDate: timestamp,
        updatedBy: auth.currentUser?.email || 'Anónimo'
      };

      if (data.category !== undefined) payload.category = data.category;
      if (data.subcategory !== undefined) payload.subcategory = data.subcategory;
      if (data.isRegular !== undefined) payload.isRegular = Boolean(data.isRegular);
      if (data.isService !== undefined) payload.isService = Boolean(data.isService);
      if (data.minStock !== undefined) payload.minStock = Number(data.minStock);
      
      const docRef = await addDoc(ref, payload);

      // Record price history
      try {
        await addDoc(collection(db, 'price_history'), {
          productId: docRef.id,
          productName: data.name,
          store: data.store,
          price: Number(data.price),
          date: timestamp,
          updatedByEmail: auth.currentUser?.email || 'Anónimo',
          updatedByUid: auth.currentUser?.uid || 'desconocido'
        });
      } catch (historyErr) {
        console.error('Failed to log initial price history entry:', historyErr);
      }

      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'catalog');
    }
  },

  async updateCatalogProduct(id: string, data: any) {
    const ref = doc(db, 'catalog', id);
    try {
      const timestamp = new Date().toISOString();
      const payloadObj: any = {
        name: data.name,
        store: data.store,
        price: Number(data.price),
        stock: Number(data.stock),
        priceDate: timestamp,
        updatedBy: auth.currentUser?.email || 'Anónimo'
      };

      if (data.category !== undefined) payloadObj.category = data.category;
      if (data.subcategory !== undefined) payloadObj.subcategory = data.subcategory;
      if (data.isRegular !== undefined) payloadObj.isRegular = Boolean(data.isRegular);
      if (data.isService !== undefined) payloadObj.isService = Boolean(data.isService);
      if (data.minStock !== undefined) payloadObj.minStock = Number(data.minStock);

      await updateDoc(ref, payloadObj);

      // Record price change trace in history
      try {
        await addDoc(collection(db, 'price_history'), {
          productId: id,
          productName: data.name,
          store: data.store,
          price: Number(data.price),
          date: timestamp,
          updatedByEmail: auth.currentUser?.email || 'Anónimo',
          updatedByUid: auth.currentUser?.uid || 'desconocido'
        });
      } catch (historyErr) {
        console.error('Failed to log updated price history entry:', historyErr);
      }

    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `catalog/${id}`);
    }
  },

  async deleteCatalogProduct(id: string) {
    const ref = doc(db, 'catalog', id);
    try {
      await deleteDoc(ref);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `catalog/${id}`);
    }
  },

  async getPriceHistoryForProduct(productId: string) {
    try {
      const ref = collection(db, 'price_history');
      const q = query(ref, where('productId', '==', productId));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort offline so Firestore doesn't demand compound indices for single-user filter sorts
      return items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, `price_history/${productId}`);
      return [];
    }
  },

  // Super Administrator Cross-Tenant Queries
  async listAllUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
      return [];
    }
  },

  async getUserCollectionsData(userId: string) {
    try {
      const collectionsToKeys = ['transactions', 'accounts', 'debts', 'receivables', 'saving_funds', 'shopping_lists'];
      const payloadMap: Record<string, any[]> = {};
      for (const col of collectionsToKeys) {
        try {
          const snap = await getDocs(collection(db, `users/${userId}/${col}`));
          payloadMap[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (innerErr) {
          console.warn(`Silent fail read ${col} for auditee ${userId}:`, innerErr);
          payloadMap[col] = [];
        }
      }
      return payloadMap;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${userId}`);
      return {};
    }
  }
};
