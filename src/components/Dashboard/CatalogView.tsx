import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { dbService } from '@/src/lib/db';
import { auth } from '@/src/lib/firebase';
import { uploadLogoToDrive } from '@/src/lib/drive';
import { toast } from 'sonner';
import { 
  Package, 
  Search, 
  Plus, 
  DollarSign, 
  Edit3, 
  Trash2, 
  Calendar, 
  User, 
  History, 
  Store, 
  HelpCircle, 
  X,
  Tag,
  ShoppingBag,
  SlidersHorizontal,
  Minus,
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  TrendingDown,
  MapPin,
  Truck,
  Wrench
} from 'lucide-react';
import { Account, PurchaseCategory, PurchaseStore, Category } from '@/src/types';
import { StoreMap } from './StoreMap';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';

interface CatalogProduct {
  id: string;
  name: string;
  store: string;
  price: number;
  stock: number;
  priceDate: string;
  updatedBy: string;
  category?: string;
  subcategory?: string;
  isRegular?: boolean;
  isService?: boolean;
  minStock?: number;
}

interface PriceHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  store: string;
  price: number;
  date: string;
  updatedByEmail: string;
  updatedByUid: string;
}

export function CatalogView() {
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'stores'>('catalog');
  
  // Collaborative database states
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [sharedStores, setSharedStores] = useState<PurchaseStore[]>([]);
  
  // User local financial states
  const [categories, setCategories] = useState<PurchaseCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Searching & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  
  // State for Store logo upload & creation
  const [newStoreName, setNewStoreName] = useState('');
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [newStoreLat, setNewStoreLat] = useState<number | null>(null);
  const [newStoreLng, setNewStoreLng] = useState<number | null>(null);
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [showStoreMapTab, setShowStoreMapTab] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logic for entity types: Store, Provider, Service, Consumption
  const [newStoreType, setNewStoreType] = useState<'store' | 'provider' | 'service' | 'consumption'>('store');
  const [editStoreTypeVal, setEditStoreTypeVal] = useState<'store' | 'provider' | 'service' | 'consumption'>('store');
  const [selectedStoreTypeFilter, setSelectedStoreTypeFilter] = useState<string>('all');

  // States to handle duplicate store detection and customization
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [duplicateBaseName, setDuplicateBaseName] = useState('');
  const [matchingExistingStores, setMatchingExistingStores] = useState<PurchaseStore[]>([]);
  const [isChainOption, setIsChainOption] = useState<'yes' | 'no' | null>(null);
  const [newStoreSuffix, setNewStoreSuffix] = useState('');
  const [existingStoresSuffixes, setExistingStoresSuffixes] = useState<{ [id: string]: string }>({});
  const [homonymNewName, setHomonymNewName] = useState('');
  const [pendingStorePayload, setPendingStorePayload] = useState<{
    type?: 'store' | 'provider' | 'service' | 'consumption';
    logoUrl: string | null;
    logoFileId: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string;
  } | null>(null);

  // Geolocation edit state for existing stores
  const [locatingStore, setLocatingStore] = useState<PurchaseStore | null>(null);
  const [locatingLat, setLocatingLat] = useState<number | null>(null);
  const [locatingLng, setLocatingLng] = useState<number | null>(null);
  const [locatingAddress, setLocatingAddress] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Admin and SuperAdmin states for entire Store / Establishment Updates
  const [editingStoreObj, setEditingStoreObj] = useState<PurchaseStore | null>(null);
  const [editStoreNameVal, setEditStoreNameVal] = useState('');
  const [editStoreLogoFileObj, setEditStoreLogoFileObj] = useState<File | null>(null);
  const [editLogoPreviewUrl, setEditLogoPreviewUrl] = useState<string | null>(null);
  const [editStoreLatVal, setEditStoreLatVal] = useState<number | null>(null);
  const [editStoreLngVal, setEditStoreLngVal] = useState<number | null>(null);
  const [editStoreAddressVal, setEditStoreAddressVal] = useState('');
  const [isSavingStoreEdit, setIsSavingStoreEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // New Catalog Product Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formIsRegular, setFormIsRegular] = useState(true);
  const [formIsService, setFormIsService] = useState(false);
  const [formPrice, setFormPrice] = useState('');
  const [formStoreName, setFormStoreName] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formMinStock, setFormMinStock] = useState('2');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  
  // Modal: Register Local Purchase Financial Integration State
  const [purchasingProduct, setPurchasingProduct] = useState<CatalogProduct | null>(null);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseAccountId, setPurchaseAccountId] = useState('');
  const [purchaseExpenseCategoryId, setPurchaseExpenseCategoryId] = useState('');
  const [isRecordingPurchase, setIsRecordingPurchase] = useState(false);

  // Modal: Admin Price History Drawer State
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyProductName, setHistoryProductName] = useState('');
  const [historyList, setHistoryList] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Deletion confirmation state dialogs
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<PurchaseStore | null>(null);

  // User Auth Roles
  const ADMIN_EMAILS = ['camilomartg@gmail.com', 'imagina3ddesign@gmail.com'];
  const isSuperAdmin = auth.currentUser?.email ? ADMIN_EMAILS.includes(auth.currentUser.email) : false;

  useEffect(() => {
    // 1. Subscribe to shared catalog, ordered by update date
    const unsubCatalog = dbService.subscribeToCatalog((data) => {
      setCatalog(data as CatalogProduct[]);
    });

    // 2. Subscribe to public/shared stores
    const unsubSharedStores = dbService.subscribeToCatalogStores((data) => {
      setSharedStores(data as PurchaseStore[]);
    });

    // 3. Subscribe to local financial accounts
    const unsubAccounts = dbService.subscribeToCollection('accounts', (data) => {
      setAccounts(data as Account[]);
    });

    // 4. Subscribe to purchase categories with automatic fallback seed if empty
    const unsubCategories = dbService.subscribeToCollection('purchase_categories', (data) => {
      setCategories(data as PurchaseCategory[]);
      if (data.length === 0) {
        const defaultSeeds = [
          { name: 'Alimentos y Despensa', subcategories: ['Lácteos y Huevos', 'Panadería', 'Carnes y Embutidos', 'Frutas y Verduras', 'Abarrotes'] },
          { name: 'Higiene y Cuidado Personal', subcategories: ['Cuidado dental', 'Champú y Jabones', 'Esenciales Hogar', 'Detergentes'] },
          { name: 'Tecnología y Gadgets', subcategories: ['Accesorios', 'Suscripciones', 'Cargadores'] },
          { name: 'Esporádicos', subcategories: ['Muebles', 'Herramientas', 'Regalos'] }
        ];
        defaultSeeds.forEach(async (item) => {
          try {
            await dbService.addItem('purchase_categories', {
              name: item.name,
              subcategories: item.subcategories,
              isCustom: false
            });
          } catch (e) {
            console.error('Failed to seed category:', e);
          }
        });
      }
    });

    // 5. Subscribe to general categories (for Service payment purposes)
    const unsubExpenseCategories = dbService.subscribeToCollection('categories', (data) => {
      setExpenseCategories(data as Category[]);
    });

    return () => {
      unsubCatalog();
      unsubSharedStores();
      unsubAccounts();
      unsubCategories();
      unsubExpenseCategories();
    };
  }, []);

  // Filtered subcategories based on active Category
  const subcategoriesForActiveCategory = useMemo(() => {
    const matched = categories.find(c => c.name === formCategory || c.id === formCategory);
    return matched ? matched.subcategories : [];
  }, [categories, formCategory]);

  // Unique list of store names represented in the catalog
  const uniqueStoresFromCatalog = useMemo(() => {
    const stores = catalog.map(p => p.store?.trim()).filter(Boolean);
    return Array.from(new Set(stores));
  }, [catalog]);

  // Filtered public/shared stores based on class types
  const filteredStores = useMemo(() => {
    return sharedStores.filter((store) => {
      if (selectedStoreTypeFilter !== 'all') {
        const storeType = store.type || 'store';
        return storeType === selectedStoreTypeFilter;
      }
      return true;
    });
  }, [sharedStores, selectedStoreTypeFilter]);

  // Unique list of product categories represented in the catalog
  const uniqueCategoriesFromCatalog = useMemo(() => {
    const cats = catalog.map(p => p.category?.trim()).filter(Boolean);
    return Array.from(new Set(cats));
  }, [catalog]);

  // Active Store Logo helper mapping
  const storeLogoMap = useMemo(() => {
    const map: Record<string, string> = {};
    sharedStores.forEach(s => {
      if (s.name && s.logoUrl) {
        map[s.name.trim().toLowerCase()] = s.logoUrl;
      }
    });
    return map;
  }, [sharedStores]);

  // Handle Logo file select Drag & Drop or input
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setStoreLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setStoreLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Submit shared store registration
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      toast.error('Especifica un nombre para el establecimiento o tienda');
      return;
    }

    setIsUploadingLogo(true);
    let uploadedLogoUrl = '';
    let uploadedLogoFileId = '';

    try {
      if (storeLogoFile) {
        try {
          toast.info('Subiendo logotipo a Google Drive corporativo...');
          const result = await uploadLogoToDrive(storeLogoFile);
          uploadedLogoUrl = result.viewUrl;
          uploadedLogoFileId = result.fileId;
          toast.success('Logotipo subido con éxito');
        } catch (driveErr: any) {
          console.warn('Google Drive registration failed or unauthorized. Falling back to local Base64 optimization...', driveErr);
          toast.info('Optimizando imagen localmente como alternativa (sin requerir autorización)...');
          
          // Fallback helper to resize and convert image to a highly optimized Base64 string at 128x128
          uploadedLogoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (re) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 128;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                  }
                } else {
                  if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.7));
                } else {
                  resolve(re.target?.result as string || '');
                }
              };
              img.onerror = () => reject(new Error('Error al optimizar imagen'));
              img.src = re.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Lib reading error'));
            reader.readAsDataURL(storeLogoFile);
          });
          
          uploadedLogoFileId = 'local_base64';
          toast.success('Logotipo optimizado y vinculado localmente');
        }
      }

      const trimmedNewName = newStoreName.trim();
      const exactMatches = sharedStores.filter(
        (s) => s.name.trim().toLowerCase() === trimmedNewName.toLowerCase()
      );

      if (exactMatches.length > 0) {
        setDuplicateBaseName(trimmedNewName);
        setMatchingExistingStores(exactMatches);
        setIsChainOption(null);
        setNewStoreSuffix('');
        
        const initialSuffixes: { [id: string]: string } = {};
        exactMatches.forEach(em => {
          initialSuffixes[em.id] = '';
        });
        setExistingStoresSuffixes(initialSuffixes);
        setHomonymNewName(`${trimmedNewName} (Copia Alterna)`);

        setPendingStorePayload({
          type: newStoreType,
          logoUrl: uploadedLogoUrl || null,
          logoFileId: uploadedLogoFileId || null,
          latitude: newStoreLat,
          longitude: newStoreLng,
          address: newStoreAddress || 'Ubicación seleccionada en el mapa'
        });

        setDuplicateCheckOpen(true);
        setIsUploadingLogo(false);
        return;
      }

      await dbService.addCatalogStore({
        name: trimmedNewName,
        type: newStoreType,
        logoUrl: uploadedLogoUrl || null,
        logoFileId: uploadedLogoFileId || null,
        latitude: newStoreLat,
        longitude: newStoreLng,
        address: newStoreAddress || 'Ubicación seleccionada en el mapa'
      });

      setNewStoreName('');
      setStoreLogoFile(null);
      setLogoPreview(null);
      setNewStoreLat(null);
      setNewStoreLng(null);
      setNewStoreAddress('');
      toast.success('Establecimiento registrado exitosamente en el catálogo compartido');
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al registrar tienda: ${err.message || err}`);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Finalize multi-store suffix logic based on user chain preferences
  const handleFinalizeStoreCreation = async (
    finalNewName: string,
    existingUpdates: { id: string; name: string }[]
  ) => {
    if (!pendingStorePayload) return;
    setIsUploadingLogo(true);
    try {
      // 1. Update any corresponding existing stores if custom suffix is selected/added
      for (const update of existingUpdates) {
        const originalStore = sharedStores.find(s => s.id === update.id);
        if (originalStore && originalStore.name !== update.name) {
          await dbService.updateCatalogStore(update.id, {
            name: update.name,
            logoUrl: originalStore.logoUrl || null,
            logoFileId: originalStore.logoFileId || null,
            latitude: originalStore.latitude || null,
            longitude: originalStore.longitude || null,
            address: originalStore.address || null
          });
        }
      }

      // 2. Add new record to database with suffix or distinct homonym name
      await dbService.addCatalogStore({
        name: finalNewName.trim(),
        type: pendingStorePayload.type || 'store',
        logoUrl: pendingStorePayload.logoUrl,
        logoFileId: pendingStorePayload.logoFileId,
        latitude: pendingStorePayload.latitude,
        longitude: pendingStorePayload.longitude,
        address: pendingStorePayload.address
      });

      // 3. Reset states cleanly
      setNewStoreName('');
      setStoreLogoFile(null);
      setLogoPreview(null);
      setNewStoreLat(null);
      setNewStoreLng(null);
      setNewStoreAddress('');
      setDuplicateCheckOpen(false);
      setPendingStorePayload(null);
      setNewStoreSuffix('');
      setIsChainOption(null);
      setMatchingExistingStores([]);
      toast.success('Establecimiento registrado exitosamente en el catálogo compartido');
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al finalizar registro del establecimiento: ${err.message || err}`);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Update entire store (Admin function)
  const handleUpdateStoreDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStoreObj) return;
    if (!editStoreNameVal.trim()) {
      toast.error('Especifica un nombre para la tienda');
      return;
    }

    setIsSavingStoreEdit(true);
    let finalLogoUrl = editingStoreObj.logoUrl || '';
    let finalLogoFileId = editingStoreObj.logoFileId || '';

    try {
      if (editStoreLogoFileObj) {
        try {
          toast.info('Subiendo nuevo logotipo a Google Drive corporativo...');
          const result = await uploadLogoToDrive(editStoreLogoFileObj);
          finalLogoUrl = result.viewUrl;
          finalLogoFileId = result.fileId;
        } catch (driveErr) {
          console.warn('Drive failed on edit. Optimizing local base64...', driveErr);
          toast.info('Optimizando imagen localmente...');
          finalLogoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (re) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 128;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                  }
                } else {
                  if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.7));
                } else {
                  resolve(re.target?.result as string || '');
                }
              };
              img.onerror = () => reject(new Error('Img optimization error'));
              img.src = re.target?.result as string;
            };
            reader.readAsDataURL(editStoreLogoFileObj);
          });
          finalLogoFileId = 'local_base64';
        }
      }

      await dbService.updateCatalogStore(editingStoreObj.id, {
        name: editStoreNameVal.trim(),
        type: editStoreTypeVal,
        logoUrl: finalLogoUrl,
        logoFileId: finalLogoFileId,
        latitude: editStoreLatVal,
        longitude: editStoreLngVal,
        address: editStoreAddressVal || 'Ubicación seleccionada'
      });

      toast.success('Establecimiento actualizado con éxito');
      setEditingStoreObj(null);
      setEditStoreLogoFileObj(null);
      setEditLogoPreviewUrl(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al actualizar establecimiento: ${err.message || err}`);
    } finally {
      setIsSavingStoreEdit(false);
    }
  };

  // Delete shared store click handler
  const handleDeleteStoreClick = (store: PurchaseStore) => {
    setStoreToDelete(store);
  };

  const executeDeleteStore = async () => {
    if (!storeToDelete) return;
    try {
      await dbService.deleteCatalogStore(storeToDelete.id);
      toast.success(`Establecimiento "${storeToDelete.name}" eliminado.`);
    } catch (err) {
      toast.error('Error al remover el establecimiento');
    } finally {
      setStoreToDelete(null);
    }
  };

  // Update shared store geocoordinates
  const handleSaveStoreLocation = async () => {
    if (!locatingStore) return;
    if (locatingLat === null || locatingLng === null) {
      toast.error('Por favor, selecciona una ubicación en el mapa antes de guardar.');
      return;
    }

    setIsSavingLocation(true);
    try {
      await dbService.updateCatalogStore(locatingStore.id, {
        name: locatingStore.name,
        logoUrl: locatingStore.logoUrl,
        logoFileId: locatingStore.logoFileId,
        latitude: locatingLat,
        longitude: locatingLng,
        address: locatingAddress || 'Ubicación seleccionada en el mapa'
      });
      toast.success(`Ubicación de "${locatingStore.name}" guardada con éxito.`);
      setLocatingStore(null);
      setLocatingLat(null);
      setLocatingLng(null);
      setLocatingAddress('');
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al guardar ubicación de la tienda: ${err.message || err}`);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Save/Update public Catalog product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStoreName.trim() || !formPrice.trim()) {
      toast.error('Por favor completa todos los campos requeridos (*)');
      return;
    }

    const priceNum = parseFloat(formPrice);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('El precio promedio debe ser un número igual o mayor a 0');
      return;
    }

    setIsSavingProduct(true);
    const payload = {
      name: formName.trim(),
      category: formCategory || 'General',
      subcategory: formSubcategory || 'General',
      isRegular: Boolean(formIsRegular),
      isService: Boolean(formIsService),
      price: priceNum,
      store: formStoreName.trim(),
      stock: formIsService ? 0 : (parseInt(formStock) || 0),
      minStock: formIsService ? 0 : (parseInt(formMinStock) || 2)
    };

    try {
      if (editingProduct) {
        await dbService.updateCatalogProduct(editingProduct.id, payload);
        toast.success('Elemento del catálogo actualizado correctamente');
      } else {
        await dbService.addCatalogProduct(payload);
        toast.success('Elemento registrado y publicado en el catálogo colectivo');
      }
      
      // Clear form except default selections
      setFormName('');
      setFormPrice('');
      setFormStock('0');
      setFormMinStock('2');
      setFormIsService(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar el elemento del catálogo');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Quick edit mode
  const handleSetEditProduct = (p: CatalogProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category || 'General');
    setFormSubcategory(p.subcategory || '');
    setFormIsRegular(p.isRegular !== false);
    setFormIsService(p.isService === true);
    setFormPrice(p.price.toString());
    setFormStoreName(p.store);
    setFormStock((p.stock ?? 0).toString());
    setFormMinStock((p.minStock ?? 2).toString());
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Direct fast stock exhaustion modifier
  const handleQuickDecrementStock = async (p: CatalogProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (p.stock <= 0) {
      toast.error(`"${p.name}" ya se encuentra agotado en existencias`);
      return;
    }

    const newStock = p.stock - 1;
    try {
      await dbService.updateCatalogProduct(p.id, {
        ...p,
        stock: newStock
      });
      toast.success(`Consumido 1 unidad de ${p.name}. Stock restante: ${newStock}`);
      
      if (newStock <= (p.minStock ?? 2)) {
        toast.warning(`¡Atención! "${p.name}" ha bajado por debajo de las existencias mínimas sugeridas.`);
      }
    } catch (err) {
      toast.error('Error al actualizar el stock');
    }
  };

  // Open transaction launcher modal
  const handleOpenPurchaseRecorder = (p: CatalogProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setPurchasingProduct(p);
    setPurchaseQty(1);
    setPurchasePrice(p.price.toString());
    setPurchaseExpenseCategoryId('');
    if (accounts.length > 0) {
      setPurchaseAccountId(accounts[0].id);
    }
  };

  // Execute actual personal financial transaction & stock increment
  const handleExecutePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchasingProduct) return;
    if (!purchaseAccountId) {
      toast.error('Debes seleccionar una cuenta financiera de origen');
      return;
    }

    if (purchasingProduct.isService && !purchaseExpenseCategoryId) {
      toast.error('Debes seleccionar la categoría de pago/obligación correspondiente');
      return;
    }

    const qty = purchasingProduct.isService ? 1 : purchaseQty;
    const priceNum = parseFloat(purchasePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(purchasingProduct.isService ? 'Especifica un monto de pago válido' : 'Especifica un precio de compra válido');
      return;
    }

    const totalCost = qty * priceNum;
    const selectedAccount = accounts.find(a => a.id === purchaseAccountId);
    if (!selectedAccount) {
      toast.error('Cuenta seleccionada inválida');
      return;
    }

    if (selectedAccount.balance < totalCost) {
      if (!window.confirm(`La cuenta "${selectedAccount.name}" no tiene saldo suficiente (saldo: $${selectedAccount.balance.toLocaleString()}). ¿Deseas continuar de todas formas?`)) {
        return;
      }
    }

    setIsRecordingPurchase(true);
    try {
      if (purchasingProduct.isService) {
        // 1. Write personal ledger transaction of type 'expense' (Pago)
        await dbService.addItem('transactions', {
          amount: totalCost,
          type: 'expense',
          categoryId: purchaseExpenseCategoryId,
          accountId: purchaseAccountId,
          date: new Date().toISOString(),
          description: `Pago Servicio Catalogado: ${purchasingProduct.name} - ${purchasingProduct.store}`
        });

        // 2. Adjust local financial account balance
        await dbService.updateItem('accounts', purchaseAccountId, {
          ...selectedAccount,
          balance: selectedAccount.balance - totalCost
        });

        // 3. Document price/tariff update on catalog without stock increase
        await dbService.updateCatalogProduct(purchasingProduct.id, {
          ...purchasingProduct,
          price: priceNum
        });

        toast.success(`¡Pago del servicio asentado con éxito! Se descontó $${totalCost.toLocaleString()} de "${selectedAccount.name}".`);
      } else {
        // 1. Write personal ledger transaction of type 'purchase' (Compra)
        await dbService.addItem('transactions', {
          amount: totalCost,
          type: 'purchase',
          categoryId: 'purchase_cat',
          accountId: purchaseAccountId,
          date: new Date().toISOString(),
          description: `Compra: ${qty} x ${purchasingProduct.name} (${purchasingProduct.store})`
        });

        // 2. Adjust local financial account balance
        await dbService.updateItem('accounts', purchaseAccountId, {
          ...selectedAccount,
          balance: selectedAccount.balance - totalCost
        });

        // 3. Increment the collaborative stock on shared collection and save local price updates
        await dbService.updateCatalogProduct(purchasingProduct.id, {
          ...purchasingProduct,
          stock: (purchasingProduct.stock || 0) + qty,
          price: priceNum
        });

        toast.success(`¡Compra asentada con éxito! Se descontó $${totalCost.toLocaleString()} de "${selectedAccount.name}" y se sumaron ${qty} unidades al catálogo.`);
      }
      setPurchasingProduct(null);
    } catch (err: any) {
      console.error(err);
      toast.error(purchasingProduct.isService ? 'Fallo al registrar el pago del servicio.' : 'Fallo al registrar la compra financiera.');
    } finally {
      setIsRecordingPurchase(false);
    }
  };

  // Admin trace price history log loader
  const handleViewPriceHistory = async (p: CatalogProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSuperAdmin) return;
    setHistoryProductId(p.id);
    setHistoryProductName(p.name);
    setLoadingHistory(true);
    setHistoryList([]);
    try {
      const history = await dbService.getPriceHistoryForProduct(p.id);
      setHistoryList((history || []) as PriceHistoryEntry[]);
    } catch (err) {
      toast.error('Error al cargar bitácora histórica de precios.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Delete product completely (R-Admin protected)
  const handleDeleteProduct = (p: CatalogProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setProductToDelete(p);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await dbService.deleteCatalogProduct(productToDelete.id);
      toast.success(`Producto "${productToDelete.name}" removido.`);
    } catch (err) {
      toast.error('Acceso denegado o error de red.');
    } finally {
      setProductToDelete(null);
    }
  };

  // Filter lists based on widgets, tags, and terms
  const filteredCatalog = useMemo(() => {
    return catalog.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStore = selectedStoreFilter === 'all' || p.store?.toLowerCase() === selectedStoreFilter.toLowerCase();
      const matchesCategory = selectedCategoryFilter === 'all' || p.category?.toLowerCase() === selectedCategoryFilter.toLowerCase();

      return matchesSearch && matchesStore && matchesCategory;
    });
  }, [catalog, searchTerm, selectedStoreFilter, selectedCategoryFilter]);

  // Helper date text formatter
  const formatDateString = (isoString?: string) => {
    if (!isoString) return 'Sin registro de fecha';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Initial letter colored avatar generation for stores without logos
  const getInitialsAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500 text-white',
      'bg-blue-500 text-white',
      'bg-green-500 text-white',
      'bg-yellow-500 text-zinc-900',
      'bg-purple-500 text-white',
      'bg-pink-500 text-white',
      'bg-indigo-500 text-white',
      'bg-amber-500 text-white',
      'bg-teal-500 text-white'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const getStoreInitials = (name: string) => {
    const clean = name.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const words = clean.split(' ').filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2" id="collaborative-catalog-view">
      
      {/* Dialog overlay for confirming product deletion */}
      <Dialog open={!!productToDelete} onOpenChange={(open) => { if (!open) setProductToDelete(null); }}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold text-base flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600 animate-pulse" />
              <span>Confirmar Eliminación</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1">
              ¿Estás seguro de que deseas eliminar definitivamente el producto <strong>"{productToDelete?.name}"</strong> del catálogo compartido por completo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-2 pt-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductToDelete(null)}
              className="text-xs font-semibold h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={executeDeleteProduct}
              className="text-xs font-bold h-9 bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, Eliminar Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog overlay for confirming store deletion */}
      <Dialog open={!!storeToDelete} onOpenChange={(open) => { if (!open) setStoreToDelete(null); }}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold text-base flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600 animate-pulse" />
              <span>Confirmar Eliminación</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1">
              ¿Está seguro de eliminar el establecimiento <strong>"{storeToDelete?.name}"</strong>? Esto removerá su logotipo asociado del catálogo. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-2 pt-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStoreToDelete(null)}
              className="text-xs font-semibold h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={executeDeleteStore}
              className="text-xs font-bold h-9 bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, Eliminar de Catálogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog overlay for direct store geolocating editing */}
      <Dialog open={!!locatingStore} onOpenChange={(open) => { if (!open) setLocatingStore(null); }}>
        <DialogContent className="sm:max-w-[550px] bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold text-base flex items-center gap-2">
              <MapPin className="size-5 text-indigo-600" />
              <span>Geolocalizar: {locatingStore?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Busca una dirección o haz clic en el mapa para fijar un pin con el logotipo o inicial de <strong>{locatingStore?.name}</strong>. Esto permitirá guardar su ubicación exacta en el mapa colectivo global.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <StoreMap 
              mode="select"
              initialLat={locatingLat}
              initialLng={locatingLng}
              initialAddress={locatingAddress}
              onLocationSelect={(lat, lng, addr) => {
                setLocatingLat(lat);
                setLocatingLng(lng);
                setLocatingAddress(addr);
              }}
              heightClass="h-[250px]"
            />
          </div>

          <DialogFooter className="flex items-center gap-2 pt-2 border-t border-zinc-150">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocatingStore(null)}
              className="text-xs border-zinc-200"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveStoreLocation}
              disabled={isSavingLocation}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"
            >
              {isSavingLocation ? (
                <>
                  <Loader2 className="animate-spin size-3.5" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="size-3.5" />
                  <span>Guardar Ubicación Exacta</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog overlay for full store editing (Admin only) */}
      <Dialog open={!!editingStoreObj} onOpenChange={(open) => { if (!open) setEditingStoreObj(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white border border-zinc-200 text-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold text-base flex items-center gap-2">
              <Edit3 className="size-5 text-indigo-600" />
              <span>Editar Establecimiento (Administrador)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Modifica los atributos, logotipo o posición geográfica de la tienda seleccionada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateStoreDetails} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-store-name" className="text-xs font-bold text-zinc-700">Nombre de la Entidad / Establecimiento *</Label>
              <Input
                id="edit-store-name"
                value={editStoreNameVal}
                onChange={(e) => setEditStoreNameVal(e.target.value)}
                placeholder="Ej: D1 Cantalejo, Ara Cedritos..."
                className="h-9 text-xs bg-white border-zinc-200"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-store-type" className="text-xs font-bold text-zinc-700">Tipo de Entidad / Clasificación *</Label>
              <select
                id="edit-store-type"
                value={editStoreTypeVal}
                onChange={(e) => setEditStoreTypeVal(e.target.value as any)}
                className="w-full h-9 px-3 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="store">🏪 Establecimiento de Comercio / Tienda</option>
                <option value="provider">🚚 Proveedor</option>
                <option value="service">🔧 Servicio / Cuenta o Recibo</option>
                <option value="consumption">🛍️ Consumo Familiar o Personal</option>
              </select>
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-700 block">Logotipo / Identificador (Opcional)</Label>
              <div 
                className="border-2 border-dashed border-zinc-250 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-all bg-zinc-50/50"
                onClick={() => editFileInputRef.current?.click()}
              >
                <input 
                  type="file"
                  ref={editFileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditStoreLogoFileObj(file);
                      setEditLogoPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                />
                
                {editLogoPreviewUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img 
                      src={editLogoPreviewUrl} 
                      alt="Preview logo" 
                      className="w-16 h-16 rounded-full object-cover border border-zinc-200 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-zinc-500">Haz clic para cambiar de logotipo</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    <ImageIcon className="size-6 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-600 block">Cambiar logotipo del local</span>
                    <span className="text-[10px] text-zinc-400">Archivos PNG/JPEG (Optimizado o Guardado en Drive)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Geolocation Map */}
            <div className="space-y-1.5 border-t border-zinc-100 pt-3">
              <Label className="text-xs font-bold text-zinc-700 block">Ubicación de la Sucursal en el Mapa (Opcional)</Label>
              <p className="text-[10.5px] text-zinc-500 leading-tight block mb-2">
                Busca una dirección o haz clic en el mapa para asignar las coordenadas reales de la sucursal.
              </p>
              
              <StoreMap 
                mode="select"
                initialLat={editStoreLatVal}
                initialLng={editStoreLngVal}
                initialAddress={editStoreAddressVal}
                onLocationSelect={(lat, lng, address) => {
                  setEditStoreLatVal(lat);
                  setEditStoreLngVal(lng);
                  setEditStoreAddressVal(address);
                }}
                heightClass="h-[220px]"
              />
            </div>

            <DialogFooter className="flex items-center gap-2 pt-3 border-t border-zinc-100 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingStoreObj(null)}
                className="text-xs border-zinc-200"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingStoreEdit}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"
              >
                {isSavingStoreEdit ? (
                  <>
                    <Loader2 className="animate-spin size-3.5" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-3.5" />
                    <span>Guardar Establecimiento</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog overlay for duplicate store check, branch differentiation or homonym naming */}
      <Dialog open={duplicateCheckOpen} onOpenChange={(open) => { if (!open) setDuplicateCheckOpen(false); }}>
        <DialogContent className="sm:max-w-[550px] bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold text-base flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <span>Establecimiento Duplicado Detectado</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Ya existe un establecimiento registrado con el nombre <strong className="text-zinc-900 font-bold">"{duplicateBaseName}"</strong> en el catálogo compartido.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-800 block">¿Pertenecen a la misma cadena de tiendas?</span>
              <p className="text-[11px] text-zinc-505 leading-tight">
                Si pertenecen a la misma cadena (ej: D1, Éxito, Ara), los identificaremos por separado con sucursales. Si es un homónimo de nombre por coincidencia, asignaremos un nombre completamente distinto.
              </p>
              
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChainOption('yes')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isChainOption === 'yes'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                      : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span className="dot shrink-0 h-2 w-2 rounded-full bg-indigo-600 inline-block"></span>
                    <span>Sí, son cadena</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                    Diferenciar cada local con su sufijo de sucursal (ej: Cantalejo, Cedritos).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsChainOption('no')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isChainOption === 'no'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                      : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span className="dot shrink-0 h-2 w-2 rounded-full bg-indigo-400 inline-block"></span>
                    <span>No, es coincidencia</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                    Registrar el nuevo local bajo un nombre totalmente diferente.
                  </p>
                </button>
              </div>
            </div>

            {/* If Option is "Yes, part of a chain" */}
            {isChainOption === 'yes' && (
              <div className="space-y-3 bg-zinc-50 border border-zinc-200 rounded-lg p-3 pt-2">
                <span className="text-[11px] font-bold text-indigo-900 block uppercase tracking-wider">Estructura de la Cadena de Tiendas</span>
                
                {/* 1. Suffix input for first/existing stores with the same name */}
                {matchingExistingStores.map((existing, idx) => (
                  <div key={existing.id} className="space-y-1 bg-white border border-zinc-200 rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-650">Tienda ya registrada #{idx + 1}</span>
                      <span className="text-[9px] font-mono text-zinc-400 font-bold">ID: {existing.id.slice(0, 5)}</span>
                    </div>
                    <p className="text-xs text-zinc-900 font-medium">Nombre original: <span className="font-bold">{existing.name}</span></p>
                    
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-zinc-500 block leading-tight">Sufijo / Sucursal a asignar de forma retroactiva:</span>
                      <Input
                        type="text"
                        placeholder="Ej: Cantalejo, Colina, Calle 170"
                        value={existingStoresSuffixes[existing.id] || ''}
                        onChange={(e) => {
                          setExistingStoresSuffixes(prev => ({
                            ...prev,
                            [existing.id]: e.target.value
                          }));
                        }}
                        className="h-8 text-xs bg-white border-zinc-200"
                      />
                      <p className="text-[10.5px] text-indigo-600 font-semibold leading-tight">
                        &rarr; Nuevo nombre guardado: <span className="underline">{duplicateBaseName} {existingStoresSuffixes[existing.id]?.trim() || '(Sin sufijo)'}</span>
                      </p>
                    </div>
                  </div>
                ))}

                {/* 2. Suffix input for the new store being created */}
                <div className="space-y-1 bg-white border border-zinc-200 rounded p-2 mt-2">
                  <span className="text-[10px] font-bold text-indigo-700 block text-emerald-800">Nueva Tienda en creación</span>
                  <p className="text-xs text-zinc-900 font-medium">Nombre base: <span className="font-bold">{duplicateBaseName}</span></p>
                  
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-zinc-500 block leading-tight">Sufijo / Sucursal de este local:</span>
                    <Input
                      type="text"
                      placeholder="Ej: Colina Multidrive, Cedritos, Chapinero"
                      value={newStoreSuffix}
                      onChange={(e) => setNewStoreSuffix(e.target.value)}
                      className="h-8 text-xs bg-white border-zinc-200"
                    />
                    <p className="text-[10.5px] text-emerald-600 font-bold leading-tight">
                      &rarr; Nombre para la nueva tienda: <span className="underline">{duplicateBaseName} {newStoreSuffix.trim() || '(Ingresa un sufijo)'}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* If Option is "No, homonym match" */}
            {isChainOption === 'no' && (
              <div className="space-y-2 bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                <span className="text-[11px] font-bold text-zinc-850 block uppercase tracking-wider">Establecimiento Homónimo Diferente</span>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  Para no alterar la base existente, ingresa un nombre único y propio para esta tienda para mantenerla separada.
                </p>
                
                <div className="space-y-1 mt-2">
                  <span className="text-xs font-semibold text-zinc-700 block">Nombre distinto definitivo:</span>
                  <Input
                    type="text"
                    placeholder="Ej: Supermercado Don Pepe, Tienda Esquina del Parque"
                    value={homonymNewName}
                    onChange={(e) => setHomonymNewName(e.target.value)}
                    className="h-9 text-xs bg-white border-zinc-200"
                  />
                  <p className="text-[10px] text-amber-700 italic">
                    Esto creará la tienda como "{homonymNewName.trim() || 'Copia'}" sin cambiar ninguna de las tiendas previas en su catálogo de compra familiar.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center gap-2 pt-2 border-t border-zinc-150 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDuplicateCheckOpen(false);
                setPendingStorePayload(null);
                setMatchingExistingStores([]);
              }}
              className="text-xs border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar Registro
            </Button>
            
            <Button
              type="button"
              disabled={
                isChainOption === null ||
                (isChainOption === 'yes' && (!newStoreSuffix.trim() || Object.keys(existingStoresSuffixes).some(key => !existingStoresSuffixes[key]?.trim()))) ||
                (isChainOption === 'no' && !homonymNewName.trim())
              }
              onClick={() => {
                if (isChainOption === 'yes') {
                  const finalNewName = `${duplicateBaseName} ${newStoreSuffix.trim()}`;
                  const existingUpdates = matchingExistingStores.map(em => ({
                    id: em.id,
                    name: `${duplicateBaseName} ${(existingStoresSuffixes[em.id] || '').trim()}`
                  }));
                  handleFinalizeStoreCreation(finalNewName, existingUpdates);
                } else if (isChainOption === 'no') {
                  handleFinalizeStoreCreation(homonymNewName.trim(), []);
                }
              }}
              className="text-xs bg-zinc-900 hover:bg-zinc-950 text-white font-bold gap-1 shadow-sm"
            >
              <CheckCircle className="size-3.5" />
              <span>Confirmar y Registrar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visual Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-zinc-900 text-white rounded-xl shadow-lg border border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Store className="size-6 text-indigo-400" />
            Ajustes de Compras y Catálogo Colaborativo
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gestione y supervise existencias, registre compras financieras automatizadas y comparta precios vigentes entre hogares.
          </p>
        </div>
        
        {/* Navigation Tabs Bar inside Dashboard content */}
        <div className="flex bg-zinc-800 p-1.5 rounded-lg border border-zinc-700/60 mt-4 md:mt-0 w-full md:w-auto">
          <button
            id="tab-btn-catalog"
            onClick={() => setActiveSubTab('catalog')}
            className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeSubTab === 'catalog' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            4. Catálogo & Stock Colectivo
          </button>
          <button
            id="tab-btn-stores"
            onClick={() => setActiveSubTab('stores')}
            className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeSubTab === 'stores' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            3. Establecimientos / Tiendas
          </button>
        </div>
      </div>

      {/* RENDER TAB: COOPERATIVE PUBLIC STORES */}
      {activeSubTab === 'stores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="stores-subtab-layout">
          
          {/* Left Block: Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border border-zinc-200">
              <CardHeader className="bg-zinc-50 border-b border-zinc-200/60">
                <CardTitle className="text-md font-bold text-zinc-900 flex items-center gap-2">
                  <Plus className="size-4 text-indigo-500" />
                  Registrar de Tienda / Supermercado
                </CardTitle>
                <CardDescription>Configure establecimientos comunes visibles para los miembros del stock.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateStore} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="store-name-input" className="text-sm font-semibold text-zinc-700">Nombre de la Entidad / Tienda *</Label>
                    <Input
                      id="store-name-input"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      placeholder="Ej. Éxito, D1, Carulla, Ara, Olímpica, Claro, Gas, Proveedor Carnes"
                      required
                      className="border-zinc-200 bg-zinc-50/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="store-type-input" className="text-sm font-semibold text-zinc-700">Tipo de Entidad / Clasificación</Label>
                    <select
                      id="store-type-input"
                      value={newStoreType}
                      onChange={(e) => setNewStoreType(e.target.value as any)}
                      className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="store">🏪 Establecimiento de Comercio / Tienda</option>
                      <option value="provider">🚚 Proveedor</option>
                      <option value="service">🔧 Servicio (Agua, Energía, Teléfono, etc.)</option>
                      <option value="consumption">🛍️ Consumo Regular Familiar</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Label className="text-sm font-semibold text-zinc-700 block">Logo / Identificador (Opcional)</Label>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-200 rounded-lg p-5 text-center cursor-pointer hover:border-indigo-400 hover:bg-zinc-50/30 transition-all flex flex-col items-center justify-center space-y-2"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                      {logoPreview ? (
                        <div className="relative w-14 h-14 rounded-full overflow-hidden border border-zinc-200 flex items-center justify-center bg-white shadow-inner">
                          <img src={logoPreview} alt="Vista previa del logo" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="p-2.5 bg-zinc-100 rounded-full text-zinc-400">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-zinc-600">
                          Arrastre o seleccione un logo representativo
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 mt-0.5">Soporta PNG, JPEG. Guarda alternativa Base64 optimizada o Drive.</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic interactive Leaflet search and point registration */}
                  <div className="space-y-2 pt-1 border-t border-zinc-100">
                    <Label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                      <span>Ubicación Geográfica en el Mapa (Opcional)</span>
                    </Label>
                    <p className="text-[10px] text-zinc-400 leading-tight">
                      Indica las coordenadas físicas de la tienda para calcular zonas y encontrar chollos locales.
                    </p>
                    <StoreMap 
                      mode="select"
                      onLocationSelect={(lat, lng, addr) => {
                        setNewStoreLat(lat);
                        setNewStoreLng(lng);
                        setNewStoreAddress(addr);
                      }}
                      heightClass="h-[180px]"
                    />
                  </div>

                  <Button 
                    id="submit-register-store-btn"
                    type="submit" 
                    className="w-full bg-zinc-900 border-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center gap-2"
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="animate-spin size-4 mr-1" />
                        Subiendo y registrando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="size-4 mr-1" />
                        Registrar Establecimiento Compartido
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Block: List of active cooperative stores with Map switches */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border border-zinc-200">
              <CardHeader className="bg-zinc-50 border-b border-zinc-200/60 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 py-4">
                <div>
                  <CardTitle className="text-md font-bold text-zinc-900 flex items-center gap-1.5">
                    <span>Directorio, Proveedores & Servicios</span>
                  </CardTitle>
                  <CardDescription>Buzón y logotipos asignados al catálogo de compras</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 self-stretch xl:self-auto justify-between xl:justify-end">
                  {/* Class Filter select */}
                  <select
                    id="store-class-filter"
                    value={selectedStoreTypeFilter}
                    onChange={(e) => setSelectedStoreTypeFilter(e.target.value)}
                    className="h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-600 shrink-0"
                  >
                    <option value="all">Todas las Clasificaciones</option>
                    <option value="store">🏪 Establecimientos de Comercio</option>
                    <option value="provider">🚚 Proveedores</option>
                    <option value="service">🔧 Servicios</option>
                    <option value="consumption">🛍️ Consumos</option>
                  </select>

                  {/* View Toggles */}
                  <div className="bg-zinc-100 p-0.5 rounded-lg flex border border-zinc-250 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowStoreMapTab(true)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded transition-all ${
                        showStoreMapTab 
                          ? 'bg-zinc-900 text-white shadow-sm' 
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Mapa Colectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStoreMapTab(false)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded transition-all ${
                        !showStoreMapTab 
                          ? 'bg-zinc-900 text-white shadow-sm' 
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Bandeja Lista
                    </button>
                  </div>
                  
                  <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 font-bold text-[10px]">
                    {filteredStores.length} Registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {sharedStores.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <Store className="size-10 mx-auto text-zinc-300 mb-2" />
                    <p className="font-medium text-zinc-600">No hay elementos registrados aún</p>
                    <p className="text-xs text-zinc-400 mt-1">Registra tu primer elemento a la izquierda para poder asignarle artículos y ubicarlo.</p>
                  </div>
                ) : filteredStores.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <Store className="size-10 mx-auto text-zinc-300 mb-2 animate-pulse" />
                    <p className="font-medium text-zinc-650">No hay registros para esta clasificación</p>
                    <p className="text-xs text-zinc-450 mt-1">Selecciona otra clasificación en el filtro de arriba para visualizar los elementos guardados.</p>
                  </div>
                ) : showStoreMapTab ? (
                  <div className="space-y-4">
                    {filteredStores.some(s => !s.latitude || !s.longitude) && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs leading-relaxed text-amber-900 flex items-start gap-2.5">
                        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">¡Elementos sin registrar en el mapa!</span> Tienes registros creados sin coordenadas físicas de ubicación. Haz clic en la pestaña <strong className="font-semibold text-zinc-900">Bandeja Lista</strong> y presiona el botón <strong className="font-semibold text-zinc-900">Ubicar en el mapa</strong> (icono <strong className="font-mono text-zinc-900 font-black">MapPin</strong>) de cada uno para guardarlos.
                        </div>
                      </div>
                    )}
                    <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-lg p-3 text-xs leading-relaxed text-indigo-900">
                      Este mapa consolida las ubicaciones de tus tiendas, proveedores, servicios y consumo familiar. Haz clic en cada logo/inicial para consultar su dirección.
                    </div>
                    <StoreMap 
                      mode="view-all"
                      stores={filteredStores}
                      heightClass="h-[430px]"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredStores.map((store) => (
                      <div 
                        key={store.id} 
                        id={`store-card-${store.id}`}
                        className="flex flex-col justify-between p-3.5 rounded-lg border border-zinc-200 bg-white hover:shadow-sm transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {store.logoUrl ? (
                              <img 
                                src={store.logoUrl} 
                                alt={store.name} 
                                className="w-9 h-9 rounded-full border border-zinc-200 object-cover shadow-sm bg-white"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getInitialsAvatarColor(store.name)}`}>
                                {getStoreInitials(store.name)}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-sm text-zinc-900 leading-tight">{store.name}</p>
                              
                              {/* Entity type representation badges */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {(() => {
                                  const st = store.type || 'store';
                                  switch (st) {
                                    case 'provider':
                                      return (
                                        <span className="text-[8.5px] font-bold text-amber-700 bg-amber-50 border border-amber-250/50 px-1.5 py-0.2 rounded flex items-center gap-1">
                                          <Truck className="size-2.5" />
                                          <span>Proveedor</span>
                                        </span>
                                      );
                                    case 'service':
                                      return (
                                        <span className="text-[8.5px] font-bold text-rose-700 bg-rose-50 border border-rose-250/50 px-1.5 py-0.2 rounded flex items-center gap-1">
                                          <Wrench className="size-2.5" />
                                          <span>Servicio</span>
                                        </span>
                                      );
                                    case 'consumption':
                                      return (
                                        <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250/50 px-1.5 py-0.2 rounded flex items-center gap-1">
                                          <ShoppingBag className="size-2.5" />
                                          <span>Consumo</span>
                                        </span>
                                      );
                                    default:
                                      return (
                                        <span className="text-[8.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/50 px-1.5 py-0.2 rounded flex items-center gap-1">
                                          <Store className="size-2.5" />
                                          <span>Tienda</span>
                                        </span>
                                      );
                                  }
                                })()}

                                {store.latitude && store.longitude ? (
                                  <span className="text-[8.5px] font-semibold text-emerald-600 bg-emerald-50/40 border border-emerald-100 px-1 py-0.2 rounded flex items-center">
                                    &bull; Geoposicionado
                                  </span>
                                ) : (
                                  <span className="text-[8.5px] font-semibold text-rose-600 bg-rose-50/40 border border-rose-100 px-1 py-0.2 rounded flex items-center">
                                    &bull; Sin Mapa
                                  </span>
                                )}
                              </div>

                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isSuperAdmin ? (
                              <>
                                <Button 
                                  id={`edit-store-btn-${store.id}`}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-indigo-550 hover:text-indigo-700 hover:bg-indigo-50"
                                  onClick={() => {
                                    setEditingStoreObj(store);
                                    setEditStoreNameVal(store.name);
                                    setEditLogoPreviewUrl(store.logoUrl || null);
                                    setEditStoreLatVal(store.latitude || null);
                                    setEditStoreLngVal(store.longitude || null);
                                    setEditStoreAddressVal(store.address || '');
                                    setEditStoreLogoFileObj(null);
                                    setEditStoreTypeVal(store.type || 'store');
                                  }}
                                  title="Editar nombre, logotipo y mapa del establecimiento (Administrador)"
                                >
                                  <Edit3 className="size-3.5" />
                                </Button>

                                <Button 
                                  id={`del-store-btn-${store.id}`}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                                  onClick={() => handleDeleteStoreClick(store)}
                                  title="Eliminar establecimiento (Administrador)"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-100 px-1.5 py-0.5 rounded">
                                Catálogo
                              </span>
                            )}
                          </div>
                        </div>

                        {store.address && (
                          <div className="text-[11px] text-zinc-550 border-t border-zinc-100 pt-2 flex items-start gap-1 select-all" title={store.address}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin text-rose-500 shrink-0 mt-0.5"><path d="M20 10c0 4.418-8 12-8 12s-8-7.582-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span className="truncate leading-tight text-zinc-500 font-medium">{store.address}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* RENDER TAB: COOPERATIVE PUBLIC PRODUCTS & STOCK */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-6" id="catalog-subtab-layout">

          {/* Form Widget at the top of the inventory */}
          <Card className="border border-zinc-200">
            <CardHeader className="bg-zinc-50 border-b border-zinc-200/60 pb-4">
              <CardTitle className="text-md font-bold text-zinc-900 flex items-center gap-2">
                <Package className="size-5 text-indigo-500 animate-pulse" />
                {editingProduct ? 'Editar Producto del Catálogo Colaborativo' : 'Registrar Nuevo Producto en el Catálogo Colaborativo'}
              </CardTitle>
              <CardDescription>Cargue y determine las especificaciones de precios, marcas o establecimientos de compra compartidos.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Name field */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label htmlFor="form-prod-name" className="text-xs font-semibold text-zinc-700">Nombre *</Label>
                    <Input
                      id="form-prod-name"
                      placeholder={formIsService ? "Ej. Arriendo Local, Energía Eléctrica, Impuesto de Renta" : "Ej. Leche Entera, Huevos, Computador Dell"}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="border-zinc-200 bg-white"
                    />
                  </div>

                  {/* Category select */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label htmlFor="form-prod-category" className="text-xs font-semibold text-zinc-700">Categoría</Label>
                    <select
                      id="form-prod-category"
                      value={formCategory}
                      onChange={(e) => {
                        setFormCategory(e.target.value);
                        setFormSubcategory('');
                      }}
                      className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Selecciona Categoría</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory select */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label htmlFor="form-prod-subcategory" className="text-xs font-semibold text-zinc-700">Subcategoría</Label>
                    <select
                      id="form-prod-subcategory"
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      disabled={!formCategory}
                      className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                    >
                      <option value="">Selecciona Subcategoría</option>
                      {subcategoriesForActiveCategory.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price input */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label htmlFor="form-prod-price" className="text-xs font-semibold text-zinc-700">Precio promedio ($) *</Label>
                    <Input
                      id="form-prod-price"
                      type="number"
                      placeholder="Ej. 12000"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      required
                      min="0"
                      className="border-zinc-200 bg-white"
                    />
                  </div>

                  {/* Store select loaded from sharedStores */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label htmlFor="form-prod-store" className="text-xs font-semibold text-zinc-700">Establecimiento / Proveedor *</Label>
                    <select
                      id="form-prod-store"
                      value={formStoreName}
                      onChange={(e) => setFormStoreName(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Selecciona Proveedor</option>
                      {sharedStores.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {sharedStores.length === 0 && (
                        <option value="General">General (Por favor registre tiendas)</option>
                      )}
                    </select>
                  </div>

                  {/* Tipo select (Product vs Service) */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label htmlFor="form-prod-type" className="text-xs font-semibold text-zinc-700">Clasificación / Tipo *</Label>
                    <select
                      id="form-prod-type"
                      value={formIsService ? 'service' : 'product'}
                      onChange={(e) => setFormIsService(e.target.value === 'service')}
                      className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="product">📦 Producto (Activo/Consumible)</option>
                      <option value="service">⚡ Servicio (Obligación / Intangible)</option>
                    </select>
                  </div>

                  {/* Submit trigger button */}
                  <div className="md:col-span-2 flex items-end justify-end">
                    <Button 
                      id="save-catalog-prod-btn"
                      type="submit" 
                      className="h-10 bg-indigo-600 border-indigo-600 hover:bg-indigo-700 text-white w-full font-semibold shadow-sm flex items-center justify-center gap-2"
                      disabled={isSavingProduct}
                    >
                      {isSavingProduct ? (
                        <Loader2 className="animate-spin size-4" />
                      ) : (
                        <>
                          <Plus className="size-4" />
                          <span>{formIsService ? 'Guardar Servicio' : 'Guardar Producto'}</span>
                        </>
                      )}
                    </Button>
                  </div>

                </div>

                {editingProduct && (
                  <div className="pt-2 flex justify-end gap-2">
                    <Button 
                      id="cancel-catalog-edit-btn"
                      type="button" 
                      variant="outline" 
                      className="text-xs py-1 h-8"
                      onClick={() => {
                        setEditingProduct(null);
                        setFormName('');
                        setFormPrice('');
                        setFormStock('0');
                        setFormMinStock('2');
                      }}
                    >
                      Cancelar Edición
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Filtering and search widgets row */}
          <Card className="border border-zinc-200">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Filtrar por producto, marca o establecimiento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-zinc-50 border-zinc-200 focus:bg-white"
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-md px-2 h-10">
                    <SlidersHorizontal className="size-3.5 text-zinc-400 mr-1" />
                    <select
                      value={selectedStoreFilter}
                      onChange={(e) => setSelectedStoreFilter(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-700 outline-none h-full"
                    >
                      <option value="all">Filtro Tiendas (Todos)</option>
                      {uniqueStoresFromCatalog.map(store => (
                        <option key={store} value={store}>{store}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-4">
                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-md px-2 h-10">
                    <Tag className="size-3.5 text-zinc-400 mr-1" />
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-700 outline-none h-full"
                    >
                      <option value="all">Filtro Categorías (Todos)</option>
                      {uniqueCategoriesFromCatalog.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product grid displaying active catalog listings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="catalog-products-deck">
            {filteredCatalog.length === 0 ? (
              <div className="col-span-full py-16 text-center text-zinc-400 border border-dashed border-zinc-200 bg-zinc-50/50 rounded-xl" id="empty-catalog-state">
                <Package className="size-12 mx-auto text-zinc-300 mb-2" />
                <p className="font-semibold text-lg text-zinc-700">Ningún artículo de catálogo coincide</p>
                <p className="text-sm text-zinc-400 mt-1">Modifica los filtros de búsqueda o registra un nuevo producto en el formulario superior.</p>
              </div>
            ) : (
              filteredCatalog.map(p => {
                const storeLogo = storeLogoMap[p.store?.trim().toLowerCase()];
                return (
                  <Card 
                    key={p.id} 
                    id={`catalog-product-card-${p.id}`}
                    className="relative hover:shadow-md transition-all border border-zinc-200 bg-white flex flex-col justify-between overflow-hidden"
                  >
                    {/* Top Accent bar */}
                    <div className="h-1 w-full bg-indigo-600" />
                    
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex justify-between items-start gap-2">
                        {/* Tags */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-400 block truncate flex items-center gap-1.5 flex-wrap">
                            {p.category || 'General'} &bull; {p.subcategory || 'General'}
                            {p.isService && (
                              <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 border border-amber-200">
                                ⚡ SERVICIO
                              </span>
                            )}
                          </span>
                          <h3 className="font-extrabold text-md text-zinc-950 leading-snug tracking-tight truncate max-w-[210px]" title={p.name}>
                            {p.name}
                          </h3>
                        </div>

                        {/* Options */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button 
                            id={`edit-prod-icon-${p.id}`}
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-800"
                            onClick={() => handleSetEditProduct(p)}
                          >
                            <Edit3 className="size-3" />
                          </Button>
                          {isSuperAdmin && (
                            <Button 
                              id={`del-prod-icon-${p.id}`}
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-zinc-400 hover:text-red-600"
                              onClick={(e) => handleDeleteProduct(p, e)}
                              title="Eliminar producto"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="py-2.5 space-y-3.5">
                      {/* Price indicator & Store Avatar */}
                      <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Precio Promedio</span>
                          <span className="text-md font-extrabold text-zinc-950 font-mono flex items-center mt-0.5">
                            <DollarSign className="size-3.5 text-emerald-600 shrink-0" />
                            {p.price.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                          </span>
                        </div>

                        {/* Store display with beautiful initials fallback */}
                        <div className="flex items-center gap-2">
                          <span className="text-right text-[11px] font-semibold text-zinc-500 max-w-[80px] truncate">{p.store}</span>
                          {storeLogo ? (
                            <img 
                              src={storeLogo} 
                              alt={p.store} 
                              className="w-7 h-7 rounded-full border border-zinc-200/80 object-cover bg-white shrink-0 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[9px] shrink-0 ${getInitialsAvatarColor(p.store)}`}>
                              {getStoreInitials(p.store)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price Update meta footer */}
                      <div className="space-y-1 text-[10px] text-zinc-500 border-t border-zinc-100 pt-2.5 font-sans leading-relaxed">
                        <div className="flex items-center gap-1 text-zinc-400 justify-between">
                          <span>Último Precio Integrado:</span>
                          <strong className="font-bold text-zinc-600">${p.price.toLocaleString('es-CO')}</strong>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-400 justify-between">
                          <span>Fecha Actualización:</span>
                          <strong className="font-bold text-zinc-600">{formatDateString(p.priceDate)}</strong>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 pb-4 flex flex-col gap-2">
                      {/* Financial purchase settlement btn */}
                      <Button 
                        id={`register-purchase-btn-${p.id}`}
                        onClick={(e) => handleOpenPurchaseRecorder(p, e)}
                        className={`w-full font-bold flex items-center justify-center gap-1.5 py-2.5 text-xs shadow-sm rounded-lg ${
                          p.isService 
                            ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700' 
                            : 'bg-zinc-950 border-zinc-950 text-white hover:bg-zinc-800'
                        }`}
                      >
                        {p.isService ? (
                          <>
                            <DollarSign className="size-3.5 mr-0.5" />
                            <span>💸 Registrar Pago de Servicio</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="size-3.5 mr-0.5" />
                            <span>🛒 Registrar Compra Financiera</span>
                          </>
                        )}
                      </Button>

                      {/* Super Admin history button */}
                      {isSuperAdmin ? (
                        <Button 
                          id={`admin-view-history-btn-${p.id}`}
                          onClick={(e) => handleViewPriceHistory(p, e)}
                          variant="outline" 
                          className="w-full text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-800 text-[11px] font-bold py-1 px-2 h-7 rounded"
                        >
                          <History className="size-3 mr-1" />
                          Auditar Historial de Precios (Admin)
                        </Button>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic text-center w-full block mt-0.5 select-none">
                          Consola histórica reservada a Súper Administrador
                        </span>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* MODAL: REGISTER FINANCIAL LOCAL PURCHASE (ACCOUNT WITHDRAWAL & LEDGER TRANSACTION) */}
      {purchasingProduct && (
        <div id="financial-purchase-modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-sm overflow-hidden animate-in zoom-in duration-150">
            <div className={`px-5 py-3.5 flex justify-between items-center text-white ${
              purchasingProduct.isService ? 'bg-rose-600' : 'bg-zinc-950'
            }`}>
              <div className="flex items-center gap-2">
                {purchasingProduct.isService ? (
                  <DollarSign className="size-5 text-rose-100 animate-pulse" />
                ) : (
                  <ShoppingBag className="size-5 text-indigo-400" />
                )}
                <h3 className="font-bold text-sm">
                  {purchasingProduct.isService ? 'Registrar Pago de Servicio' : 'Registrar Compra Local'}
                </h3>
              </div>
              <button 
                onClick={() => setPurchasingProduct(null)}
                className="text-white/80 hover:text-white transition-all text-xs border border-white/20 hover:border-white/40 px-1.5 py-0.5 rounded"
              >
                <X className="size-3 inline mr-1" />Cerrar
              </button>
            </div>

            <form onSubmit={handleExecutePurchase} className="p-5 space-y-4">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-widest">
                  {purchasingProduct.isService ? 'Servicio / Obligación a liquidar' : 'Artículo a abastecer'}
                </span>
                <p className="font-bold text-sm text-zinc-900 mt-1">{purchasingProduct.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{purchasingProduct.store} &bull; Tarifa actual: ${purchasingProduct.price.toLocaleString('es-CO')}</p>
              </div>

              {/* Select origin account */}
              <div className="space-y-1.5">
                <Label htmlFor="purchase-account-select" className="text-xs font-bold text-zinc-700">Paga con Cuenta Financiera *</Label>
                <select
                  id="purchase-account-select"
                  value={purchaseAccountId}
                  onChange={(e) => setPurchaseAccountId(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Selecciona Cuenta de Origen</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: ${a.balance.toLocaleString('es-CO')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional classification for Service payments */}
              {purchasingProduct.isService && (
                <div className="space-y-1.5 animate-fade-in">
                  <Label htmlFor="purchase-expense-category-select" className="text-xs font-bold text-zinc-700">Clasificar Pago de Gasto (Categoría) *</Label>
                  <select
                    id="purchase-expense-category-select"
                    value={purchaseExpenseCategoryId}
                    onChange={(e) => setPurchaseExpenseCategoryId(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona Categoría del Pago</option>
                    {expenseCategories.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Buy qty count */}
              {!purchasingProduct.isService ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase-qty-input" className="text-xs font-bold text-zinc-700">Cantidad (Units) *</Label>
                    <div className="flex items-center border border-zinc-200 rounded-lg h-10 bg-white overflow-hidden">
                      <button
                        type="button"
                        disabled={purchaseQty <= 1}
                        onClick={() => setPurchaseQty(prev => prev - 1)}
                        className="px-2.5 h-full text-zinc-500 hover:bg-zinc-50 border-r border-zinc-100 disabled:opacity-40"
                      >
                        <Minus className="size-3" />
                      </button>
                      <input
                        id="purchase-qty-input"
                        type="number"
                        required
                        min="1"
                        value={purchaseQty}
                        onChange={(e) => setPurchaseQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full h-full text-center outline-none bg-transparent text-xs font-bold font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setPurchaseQty(prev => prev + 1)}
                        className="px-2.5 h-full text-zinc-500 hover:bg-zinc-50 border-l border-zinc-100"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="purchase-price-input" className="text-xs font-bold text-zinc-700">Precio unit ($) *</Label>
                    <Input
                      id="purchase-price-input"
                      type="number"
                      required
                      min="1"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="border-zinc-200 h-10 text-xs font-mono bg-white focus:bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 animate-fade-in">
                  <Label htmlFor="purchase-price-input" className="text-xs font-bold text-zinc-700">Monto del Pago / Factura ($) *</Label>
                  <Input
                    id="purchase-price-input"
                    type="number"
                    required
                    min="1"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="border-zinc-200 h-10 text-xs font-mono bg-white focus:bg-white"
                  />
                </div>
              )}

              {/* Expense Preview */}
              <div className="pt-2 flex justify-between items-center text-xs text-zinc-500">
                <span>{purchasingProduct.isService ? 'Monto neto a descontar:' : 'Costo Total a Descontar:'}</span>
                <span className={`font-extrabold font-mono text-sm ${purchasingProduct.isService ? 'text-rose-600' : 'text-indigo-700'}`}>
                  $ {( (purchasingProduct.isService ? 1 : purchaseQty) * (parseFloat(purchasePrice) || 0)).toLocaleString('es-CO')}
                </span>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setPurchasingProduct(null)}
                  className="flex-1 border-zinc-200 text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button 
                  id="confirm-execute-purchase-btn"
                  type="submit" 
                  disabled={isRecordingPurchase}
                  className={`flex-1 text-xs font-bold h-9 shadow-sm ${
                    purchasingProduct.isService
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-white border-zinc-950'
                  }`}
                >
                  {isRecordingPurchase ? (
                    <Loader2 className="animate-spin size-4 mx-auto" />
                  ) : (
                    purchasingProduct.isService ? "Asentar Pago" : "Guardar Compra"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN PRICE HISTORY TIMELINE DRAWER */}
      {historyProductId && (
        <div id="price-history-audit-modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-indigo-950 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="size-5 text-indigo-400 font-medium animate-spin" />
                <div>
                  <h3 className="font-extrabold text-sm select-none">Bitácora de Precios Históricos</h3>
                  <p className="text-[10px] text-indigo-300">Modulo de Auditoría de Precios en el Tiempo</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryProductId(null)}
                className="text-indigo-200 hover:text-white transition-all"
              >
                <X className="size-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Nombre del Producto</span>
                <h4 className="font-extrabold text-zinc-900 text-md leading-snug mt-0.5">{historyProductName}</h4>
              </div>

              {loadingHistory ? (
                <div className="py-12 space-y-3 text-center">
                  <Loader2 className="animate-spin size-7 text-indigo-600 mx-auto" />
                  <p className="text-xs text-zinc-500">Recuperando el log de transacciones de Firestore...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                  <HelpCircle className="size-7 mx-auto text-zinc-300 mb-1" />
                  <p className="text-xs font-semibold">No se registran antecedentes del producto</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  
                  {/* Summary Card */}
                  <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <div>
                      <span className="text-[9px] text-indigo-600 font-bold uppercase block tracking-wider">Precio Mínimo</span>
                      <span className="text-lg font-black text-indigo-950 flex items-center mt-0.5 font-mono">
                        <DollarSign className="size-3.5 text-indigo-600 mr-0.5" />
                        {Math.min(...historyList.map(h => h.price)).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-indigo-600 font-bold uppercase block tracking-wider">Precio Máximo</span>
                      <span className="text-lg font-black text-indigo-950 flex items-center mt-0.5 font-mono">
                        <DollarSign className="size-3.5 text-rose-500 mr-0.5" />
                        {Math.max(...historyList.map(h => h.price)).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Línea de Tiempo de Variación</span>
                  
                  <div className="relative border-l border-indigo-100 pl-4 space-y-3 ml-2.5">
                    {historyList.map((entry, index) => (
                      <div key={entry.id} className="relative">
                        {/* Timeline circular dot */}
                        <span className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full border border-white ${
                          index === 0 ? 'bg-indigo-600 ring-4 ring-indigo-50' : 'bg-zinc-300'
                        }`} />
                        
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-zinc-900 font-mono">
                                ${entry.price.toLocaleString('es-CO')}
                              </span>
                              {index === 0 && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] py-0 px-1 font-bold">
                                  Último
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-[10px] text-zinc-400 truncate max-w-[170px]" title={entry.updatedByEmail}>
                              {entry.updatedByEmail}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-zinc-400 flex items-center gap-1 font-medium bg-zinc-100 px-1.5 py-0.5 rounded">
                              <Calendar className="size-2.5 text-zinc-400" />
                              {formatDateString(entry.date).split(',')[0]}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              <div className="pt-3 flex justify-end border-t border-zinc-100">
                <Button 
                  id="close-price-history-drawer"
                  type="button" 
                  onClick={() => setHistoryProductId(null)}
                  className="bg-zinc-900 border-zinc-900 font-bold shadow hover:bg-zinc-800 text-white text-xs h-9 px-4"
                >
                  Cerrar Bitácora
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
