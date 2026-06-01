import React, { useState, useEffect } from 'react';
import { PurchaseCategory, PurchaseProduct, Account, PurchaseStore, Debt } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dbService } from '@/src/lib/db';
import { getCachedToken, signInWithGoogle } from '@/src/lib/firebase';
import { appendPurchaseToSheet, verifySheetConnection, SheetRow } from '@/src/lib/sheets';
import { uploadLogoToDrive } from '@/src/lib/drive';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Package, 
  Minus, 
  Tag, 
  MapPin, 
  DollarSign, 
  Check, 
  Sliders, 
  ListPlus,
  AlertCircle
} from 'lucide-react';

interface PurchasesPanelProps {
  accounts: Account[];
}

export function PurchasesPanel({ accounts }: PurchasesPanelProps) {
  const [categories, setCategories] = useState<PurchaseCategory[]>([]);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  
  // Sheet Auth Status
  const [hasSheetAuth, setHasSheetAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [sheetName, setSheetName] = useState<string | null>(null);

  // Forms / State for categories
  const [newCatName, setNewCatName] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [selectedCatIdForSubcat, setSelectedCatIdForSubcat] = useState('');

  // Stores / Supermarkets state
  const [stores, setStores] = useState<PurchaseStore[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [lastStoreCustom, setLastStoreCustom] = useState('');

  // Forms / State for products
  const [newProd, setNewProd] = useState({
    name: '',
    categoryId: '',
    subcategory: '',
    isRegular: true,
    defaultPrice: '',
    lastStore: '',
    stock: '0',
    minStock: '2'
  });

  // Modal / inline flow for recording a real purchase (Stocking)
  const [purchasingProduct, setPurchasingProduct] = useState<PurchaseProduct | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [purchaseAccountId, setPurchaseAccountId] = useState('');
  const [isRecordingPurchase, setIsRecordingPurchase] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payWithDebt, setPayWithDebt] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

  // Subscribe to debts state
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('debts', setDebts);
    return () => unsub();
  }, []);

  // Secondary seed categories if database collection is empty
  useEffect(() => {
    const unsubCategories = dbService.subscribeToCollection('purchase_categories', (data) => {
      setCategories(data);
      if (data.length === 0) {
        const defaultSeeds = [
          { name: 'Alimentos y Despensa', subcategories: ['Lácteos y Huevos', 'Panadería', 'Carnes y Embutidos', 'Frutas y Verduras', 'Abarrotes'] },
          { name: 'Higiene y Cuidado Personal', subcategories: ['Cuidado dental', 'Champú y Jabones', 'Esenciales Hogar', 'Detergentes'] },
          { name: 'Tecnología y Gadgets', subcategories: ['Accesorios', 'Suscripciones', 'Cargadores'] },
          { name: 'Esporádicos', subcategories: ['Muebles', 'Herramientas', 'Regalos'] }
        ];
        defaultSeeds.forEach(item => {
          dbService.addItem('purchase_categories', item);
        });
      }
    });

    const unsubProducts = dbService.subscribeToCollection('purchase_products', setProducts);
    const unsubStores = dbService.subscribeToCollection('purchase_stores', setStores);

    // Initial auth token presence check
    checkGoogleSheetsToken();

    return () => {
      unsubCategories();
      unsubProducts();
      unsubStores();
    };
  }, []);

  const checkGoogleSheetsToken = async () => {
    const token = getCachedToken();
    if (token) {
      setHasSheetAuth(true);
      try {
        const metadata = await verifySheetConnection();
        if (metadata && metadata.properties) {
          setSheetName(metadata.properties.title || 'Hoja de Cálculo de Planificación');
        }
      } catch (err) {
        console.warn('Sheets metadata error, token could be stale:', err);
      }
    } else {
      setHasSheetAuth(false);
      setSheetName(null);
    }
  };

  const handleAuthorizeSheets = async () => {
    setCheckingAuth(true);
    try {
      await signInWithGoogle();
      const token = getCachedToken();
      if (token) {
        setHasSheetAuth(true);
        toast.success('Sesión de Google Sheets autorizada con éxito');
        // Retrieve sheet title
        try {
          const metadata = await verifySheetConnection();
          if (metadata && metadata.properties) {
            setSheetName(metadata.properties.title);
          }
        } catch (e) {
          setSheetName('Hoja de Cálculo Enlazada');
        }
      } else {
        throw new Error('No se recibió token OAuth');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al autorizar Google Sheets. Asegúrate de dar permisos de edición.');
    } finally {
      setCheckingAuth(false);
    }
  };

  // Add category
  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      toast.error('Especifica un nombre de categoría');
      return;
    }
    try {
      await dbService.addItem('purchase_categories', {
        name: newCatName.trim(),
        subcategories: [],
        isCustom: true
      });
      setNewCatName('');
      toast.success('Categoría agregada correctamente');
    } catch (e) {
      toast.error('No se pudo añadir la categoría');
    }
  };

  // Add subcategory
  const handleAddSubcategory = async () => {
    if (!selectedCatIdForSubcat) {
      toast.error('Selecciona una categoría principal');
      return;
    }
    if (!newSubcatName.trim()) {
      toast.error('Escribe el nombre de la subcategoría');
      return;
    }

    const cat = categories.find(c => c.id === selectedCatIdForSubcat);
    if (!cat) return;

    try {
      const updatedSubcats = [...(cat.subcategories || []), newSubcatName.trim()];
      await dbService.updateItem('purchase_categories', cat.id, {
        subcategories: updatedSubcats
      });
      setNewSubcatName('');
      toast.success('Subcategoría añadida');
    } catch (e) {
      toast.error('Error al añadir la subcategoría');
    }
  };

  // Delete subcategory
  const handleDeleteSubcategory = async (cat: PurchaseCategory, subcatName: string) => {
    try {
      const updatedSubcats = cat.subcategories.filter(s => s !== subcatName);
      await dbService.updateItem('purchase_categories', cat.id, {
        subcategories: updatedSubcats
      });
      toast.success('Subcategoría eliminada');
    } catch (e) {
      toast.error('Error al eliminar subcategoría');
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta categoría? Se conservarán los productos creados pero perderán la referencia.')) return;
    try {
      await dbService.deleteItem('purchase_categories', id);
      toast.success('Categoría eliminada');
    } catch (e) {
      toast.error('Error al eliminar categoría');
    }
  };

  // Add Store / Supermarket
  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      toast.error('Especifica un nombre para la tienda o supermercado');
      return;
    }

    let logoUrl = '';
    let logoFileId = '';

    if (storeLogoFile) {
      setIsUploadingLogo(true);
      try {
        const result = await uploadLogoToDrive(storeLogoFile);
        logoUrl = result.viewUrl;
        logoFileId = result.fileId;
        toast.success(`Logo subido correctamente a Google Drive (${result.fileId})`);
      } catch (err: any) {
        console.error(err);
        toast.error(`Error al subir el logo: ${err.message || err}`);
        setIsUploadingLogo(false);
        return;
      }
    }

    try {
      await dbService.addItem('purchase_stores', {
        name: newStoreName.trim(),
        logoUrl: logoUrl || null,
        logoFileId: logoFileId || null
      });
      setNewStoreName('');
      setStoreLogoFile(null);
      setLogoPreview(null);
      toast.success('Tienda o supermercado registrada con éxito');
    } catch (e) {
      toast.error('Error al registrar la tienda en la base de datos');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Delete Store / Supermarket
  const handleDeleteStore = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la tienda "${name}"? Los productos creados con esta tienda se conservarán.`)) return;
    try {
      await dbService.deleteItem('purchase_stores', id);
      toast.success('Tienda eliminada correctamente');
    } catch (e) {
      toast.error('Error al eliminar la tienda');
    }
  };

  // Handle Logo selection and create object preview url
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecciona un archivo de imagen válido');
        return;
      }
      setStoreLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Create purchase product record
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim() || !newProd.categoryId) {
      toast.error('El producto requiere un nombre y una categoría');
      return;
    }

    const resolvedStore = newProd.lastStore === 'custom-store' 
      ? lastStoreCustom.trim() 
      : (newProd.lastStore.trim() || 'Desconocido');

    try {
      await dbService.addItem('purchase_products', {
        name: newProd.name.trim(),
        categoryId: newProd.categoryId,
        subcategory: newProd.subcategory || 'General',
        isRegular: Boolean(newProd.isRegular),
        defaultPrice: parseFloat(newProd.defaultPrice) || 0,
        lastStore: resolvedStore,
        stock: parseInt(newProd.stock) || 0,
        minStock: parseInt(newProd.minStock) || 0
      });

      setNewProd({
        name: '',
        categoryId: '',
        subcategory: '',
        isRegular: true,
        defaultPrice: '',
        lastStore: '',
        stock: '0',
        minStock: '2'
      });
      setLastStoreCustom('');
      toast.success('Producto ingresado al catálogo de compras');
    } catch (e) {
      toast.error('Error al ingresar el producto');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
      await dbService.deleteItem('purchase_products', id);
      toast.success('Producto eliminado de la base local');
    } catch (e) {
      toast.error('Error al eliminar producto');
    }
  };

  // Decrement product stock directly (usage simulation)
  const handleConsumeItem = async (prod: PurchaseProduct) => {
    if (prod.stock <= 0) {
      toast.error('Este producto ya no tiene existencias');
      return;
    }
    try {
      await dbService.updateItem('purchase_products', prod.id, {
        stock: prod.stock - 1
      });
      toast.success(`Consumiste 1 de ${prod.name}. Quedan: ${prod.stock - 1}`);
    } catch (e) {
      toast.error('Error al descontar stock');
    }
  };

  // Trigger purchase popup
  const startPurchaseSetup = (prod: PurchaseProduct) => {
    setPurchasingProduct(prod);
    setPurchaseQty('1');
    setPurchasePrice(prod.defaultPrice ? String(prod.defaultPrice) : '10');
    // Default to first account if available
    setPurchaseAccountId(accounts[0]?.id || '');
  };

  // Finalize buying process. Record to Google Sheets and decrement money from finance Account.
  const handleExecutePurchase = async () => {
    if (!purchasingProduct) return;
    
    if (payWithDebt) {
      if (!selectedDebtId) {
        toast.error('Por favor selecciona una tarjeta o crédito rotativo para pagar esta compra con deuda.');
        return;
      }
    } else {
      if (!purchaseAccountId) {
        toast.error('Por favor selecciona una cuenta para pagar esta compra');
        return;
      }
    }

    const qtyVal = parseFloat(purchaseQty);
    const priceVal = parseFloat(purchasePrice) || 0;
    const totalAmount = qtyVal * priceVal;

    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    // Checking funding option
    let targetAccount = null;
    let targetDebt = null;

    if (payWithDebt) {
      targetDebt = debts.find(d => d.id === selectedDebtId);
      if (!targetDebt) {
        toast.error('La deuda seleccionada no es válida.');
        return;
      }
    } else {
      targetAccount = accounts.find(a => a.id === purchaseAccountId);
      if (!targetAccount) return;

      if (targetAccount.balance < totalAmount) {
        if (!window.confirm(`La cuenta "${targetAccount.name}" no tiene fondos suficientes (Saldo: $${targetAccount.balance}, Costo de compra: $${totalAmount}). ¿Proceder de todas formas?`)) {
          return;
        }
      }
    }

    setIsRecordingPurchase(true);
    try {
      // 1. Get Category Details
      const cat = categories.find(c => c.id === purchasingProduct.categoryId);
      const catName = cat?.name || 'Compras Generales';

      // 2. Format details for Google Sheet row
      const newStockLevel = purchasingProduct.stock + qtyVal;
      const sheetRow: SheetRow = {
        fecha: new Date().toLocaleString('es-MX', { timeZoneName: 'short' }),
        producto: purchasingProduct.name,
        categoria: catName,
        subcategoria: purchasingProduct.subcategory || 'General',
        lugarCompra: purchasingProduct.lastStore || 'Store',
        precio: priceVal,
        cantidad: qtyVal,
        tipo: purchasingProduct.isRegular ? 'Regular' : 'Esporádica',
        existencias: newStockLevel
      };

      // 3. Update spreadsheet (Google Sheets Real Integration)
      await appendPurchaseToSheet(sheetRow);

      if (payWithDebt && targetDebt) {
        // 4a. Update debt limit remaining locally
        const currentRemaining = Number(targetDebt.remainingAmount) || 0;
        await dbService.updateItem('debts', targetDebt.id, {
          remainingAmount: currentRemaining + totalAmount
        });
      } else if (targetAccount) {
        // 4b. Update parent account balance locally
        await dbService.updateItem('accounts', targetAccount.id, {
          balance: targetAccount.balance - totalAmount
        });
      }

      // 5. Create local purchase transaction to align accounting graph flows
      await dbService.addItem('transactions', {
        amount: totalAmount,
        type: 'purchase', // Matches 'purchase' type updated in firestore & blueprint
        categoryId: purchasingProduct.categoryId, // Keep referencing purchase category
        accountId: payWithDebt ? '' : (targetAccount?.id || ''),
        date: new Date().toISOString().split('T')[0],
        description: `Compra: ${qtyVal}x ${purchasingProduct.name} ($${priceVal} c/u)${payWithDebt ? ` (Por Deuda: ${targetDebt?.name})` : ''}`,
        paidWithDebt: payWithDebt ? true : undefined,
        debtId: payWithDebt ? selectedDebtId : undefined
      });

      // 5b. Feed Fixed Assets automatically ("compras eventuales alimentan los Activos Fijos")
      let fixedAssetCategory: 'real_estate' | 'vehicle' | 'appliance' | 'technology' | 'other' = 'other';
      const catNameLower = catName.toLowerCase();
      if (catNameLower.includes('tecnología') || catNameLower.includes('tech') || catNameLower.includes('celular') || catNameLower.includes('computador')) {
        fixedAssetCategory = 'technology';
      } else if (catNameLower.includes('mueble') || catNameLower.includes('electro') || catNameLower.includes('herramientas') || catNameLower.includes('hogar') || catNameLower.includes('esporádicos')) {
        fixedAssetCategory = 'appliance';
      } else if (catNameLower.includes('vehículo') || catNameLower.includes('transporte') || catNameLower.includes('carro') || catNameLower.includes('moto')) {
        fixedAssetCategory = 'vehicle';
      } else if (catNameLower.includes('inmueble') || catNameLower.includes('apto') || catNameLower.includes('casa') || catNameLower.includes('finca')) {
        fixedAssetCategory = 'real_estate';
      }

      await dbService.addItem('fixed_assets', {
        name: `${qtyVal}x ${purchasingProduct.name}`,
        category: fixedAssetCategory,
        estimatedValue: totalAmount,
        purchaseDate: new Date().toISOString().split('T')[0],
        description: `Adquirido vía Compras Eventuales. ${qtyVal} un. a $${priceVal} c/u.${payWithDebt ? ` Cargado a Deuda: ${targetDebt?.name}.` : ''}`,
        location: purchasingProduct.lastStore || 'General',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (payWithDebt) {
        toast.warning('⚠️ ¡Compra con deuda registrada! Has incrementado tu pasivo. Esto te aleja de tu libertad financiera.');
      }

      // 6. Update product stock level instantly
      await dbService.updateItem('purchase_products', purchasingProduct.id, {
        stock: newStockLevel,
        defaultPrice: priceVal, // update latest price
        updatedAt: new Date().toISOString()
      });

      toast.success(`¡Compra guardada con éxito en Google Sheets, cargada a Activos Fijos y registrada en Finanza Pro! Stock actual: ${newStockLevel}`);
      setPurchasingProduct(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al registrar la compra: ${err.message || err}`);
    } finally {
      setIsRecordingPurchase(false);
    }
  };

  const getCatName = (catId: string) => {
    return categories.find(c => c.id === catId)?.name || 'Sin Categoría';
  };

  return (
    <Card className="border-none shadow-md bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-indigo-600" />
          Ajustes de Compras Eventuales e Inventario
        </CardTitle>
        <CardDescription>
          Configura tus artículos reciclables regulares, clasifica adquisiciones eventuales y esporádicas (las cuales alimentan los Activos Fijos), administra categorías, y sincroniza en tiempo real con Google Sheets.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="google-sheets" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-zinc-100 p-1 rounded-xl">
            <TabsTrigger value="google-sheets" className="rounded-lg text-xs font-semibold">
              <Cloud className="size-3.5 mr-1.5" />
              1. Enlace Sheets
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-xs font-semibold">
              <Tag className="size-3.5 mr-1.5" />
              2. Categorías
            </TabsTrigger>
            <TabsTrigger value="stores" className="rounded-lg text-xs font-semibold">
              <MapPin className="size-3.5 mr-1.5" />
              3. Tiendas
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg text-xs font-semibold">
              <Package className="size-3.5 mr-1.5" />
              4. Catálogo & Stock
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Google Sheets Setup */}
          <TabsContent value="google-sheets" className="space-y-4">
            <div className="p-4 border rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-50/50">
              <div className="space-y-1">
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                  {hasSheetAuth ? (
                    <>
                      <Cloud className="size-4 text-emerald-500 animate-pulse" />
                      <span className="text-emerald-700">Conexión con Google Sheets Activada</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="size-4 text-rose-500" />
                      <span className="text-zinc-600">Sincronización Desconectada</span>
                    </>
                  )}
                </h4>
                <p className="text-xs text-zinc-500 max-w-lg">
                  Tus transacciones de Compras se reportarán automáticamente en la siguiente hoja de cálculo de Google:
                </p>
                <div className="bg-zinc-100 p-2 rounded-lg font-mono text-[10px] break-all border border-zinc-200 text-zinc-600 max-w-md">
                  https://docs.google.com/spreadsheets/d/1zwY4dQdaaLnoMOEkkDG6iBICalb1rpr2LPsnHVMaLCM/edit
                </div>
                {sheetName && (
                  <p className="text-xs font-medium text-indigo-700 mt-1">
                    ✓ Documento detectado: <strong className="underline">{sheetName}</strong>
                  </p>
                )}
              </div>

              <div className="shrink-0">
                <Button 
                  onClick={handleAuthorizeSheets} 
                  disabled={checkingAuth}
                  className={`${hasSheetAuth ? 'bg-zinc-800 hover:bg-zinc-900' : 'bg-emerald-600 hover:bg-emerald-700'} text-white shadow-md text-xs py-5`}
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${checkingAuth ? 'animate-spin' : ''}`} />
                  {hasSheetAuth ? 'Refrescar / Reconectar' : 'Vincular Google Sheets'}
                </Button>
              </div>
            </div>

            <div className="border border-zinc-150 p-4 rounded-xl bg-indigo-50/20 text-indigo-950 space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                <AlertCircle className="size-4" /> ¿Qué columnas registrará esta herramienta?
              </h5>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Cada vez de registres una adquisición/compra utilizando el panel de existencias, Finanza Pro registrará:
              </p>
              <ul className="text-xs font-mono text-zinc-500 pl-4 list-disc space-y-1">
                <li>Fecha de Movimiento</li>
                <li>Nombre de Producto</li>
                <li>Categoría General</li>
                <li>Subcategoría Detallada</li>
                <li>Establecimiento / Lugar Compra</li>
                <li>Precio unitario</li>
                <li>Cantidad comprada</li>
                <li>Clasificación (Regular consumible / Esporádica)</li>
                <li>Total de existencias remanente en inventario</li>
              </ul>
            </div>
          </TabsContent>

          {/* TAB 2: Categories Customizer */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Add Principal Category */}
              <div className="space-y-4 p-4 border rounded-xl bg-zinc-50/30">
                <h4 className="text-sm font-bold text-zinc-800">Agregar Categoría Principal</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="catName">Nombre Categoría</Label>
                    <Input 
                      id="catName"
                      placeholder="Ej. Limpieza, Mascotas, Oficina" 
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddCategory} size="sm" className="w-full">
                    <Plus className="size-4 mr-1" />
                    Crear Categoría
                  </Button>
                </div>
              </div>

              {/* Add Subcategory */}
              <div className="space-y-4 p-4 border rounded-xl bg-zinc-50/30">
                <h4 className="text-sm font-bold text-zinc-800">Agregar Subcategoría</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Categoría Principal Destino</Label>
                    <Select value={selectedCatIdForSubcat} onValueChange={setSelectedCatIdForSubcat}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccione categoría principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subcatName">Nombre Subcategoría</Label>
                    <Input 
                      id="subcatName"
                      placeholder="Ej. Frutas, Higiene dental, Computadoras" 
                      value={newSubcatName}
                      onChange={e => setNewSubcatName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddSubcategory} size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                    <ListPlus className="size-4 mr-1" />
                    Enlazar Subcategoría
                  </Button>
                </div>
              </div>
            </div>

            {/* List current Categories & Subcategories */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-800">Mis Categorías y Estructuras Disponibles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <Card key={cat.id} className="border border-zinc-200">
                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <h5 className="font-bold text-sm text-zinc-900">{cat.name}</h5>
                        {cat.isCustom && <Badge className="text-[9px] scale-90 -ml-1 text-zinc-500 bg-zinc-100 uppercase font-mono">Personalizada</Badge>}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-7 text-zinc-400 hover:text-rose-600 rounded-full"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {cat.subcategories && cat.subcategories.length > 0 ? (
                          cat.subcategories.map((sub, i) => (
                            <Badge 
                              key={i} 
                              variant="secondary" 
                              className="text-[10px] pl-2 pr-1 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center gap-1 rounded-md"
                            >
                              <span>{sub}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-3.5 p-0.5 rounded-full hover:bg-zinc-300 text-zinc-500 hover:text-zinc-900"
                                onClick={() => handleDeleteSubcategory(cat, sub)}
                              >
                                <Minus className="size-2.5" />
                              </Button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">No hay subcategorías definidas</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Stores & Logos */}
          <TabsContent value="stores" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form to create a new store */}
              <form onSubmit={handleAddStore} className="space-y-4 p-4 border rounded-xl bg-zinc-50/30">
                <div>
                  <h4 className="text-sm font-bold text-zinc-800">Registrar Tienda o Supermercado</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Crea establecimientos frecuentes para clasificar tus productos y carga sus logotipos directamente en Google Drive.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="storeName">Nombre del Establecimiento</Label>
                    <Input 
                      id="storeName"
                      placeholder="Ej. Jumbo, Líder, Costco, Verdulería El Portal" 
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Logotipo de la Tienda (Opcional)</Label>
                    {!hasSheetAuth ? (
                      <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50 flex flex-col items-center text-center gap-2">
                        <AlertCircle className="size-5 text-amber-600" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-amber-800">Se requiere autorización de Google</p>
                          <p className="text-[10px] text-amber-600 max-w-[240px]">
                            Para subir logotipos de tiendas directamente a tu Google Drive, necesitas iniciar sesión y autorizar los permisos de Google.
                          </p>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={handleAuthorizeSheets}
                          disabled={checkingAuth}
                          className="mt-1 h-8 text-xs border-amber-300 hover:bg-amber-100 font-semibold text-amber-900 bg-white"
                        >
                          {checkingAuth ? 'Conectando...' : 'Iniciar Sesión con Google'}
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-zinc-200 rounded-lg p-6 bg-white text-center hover:border-indigo-400 transition-all relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {logoPreview ? (
                          <div className="flex flex-col items-center gap-2">
                            <img src={logoPreview} alt="Logo preview" className="size-16 object-contain rounded-lg border border-zinc-100 bg-zinc-50" />
                            <p className="text-xs text-indigo-600 font-semibold truncate max-w-[200px]">
                              {storeLogoFile?.name}
                            </p>
                            <span className="text-[10px] text-zinc-400">Haz clic para cambiar de logotipo</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <MapPin className="size-8 mx-auto text-zinc-400" />
                            <p className="text-xs font-medium text-zinc-600">
                              Arrastra y suelta tu imagen aquí, o haz clic para explorar
                            </p>
                            <p className="text-[10px] text-zinc-400 uppercase font-bold">Formatos JPG, PNG</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isUploadingLogo}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold text-sm h-10"
                  >
                    {isUploadingLogo ? (
                      <>
                        <RefreshCw className="size-4 mr-1.5 animate-spin" />
                        Subiendo logo a Google Drive...
                      </>
                    ) : (
                      <>
                        <Plus className="size-4 mr-1.5" />
                        Crear Registro de Tienda
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* List current stores */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-800">Mis Tiendas Registradas</h4>
                {stores.length === 0 ? (
                  <div className="p-8 text-center border shadow-sm rounded-xl text-zinc-400 text-xs italic bg-white">
                    No has registrado ninguna tienda aún. Puedes ingresar una usando el formulario de la izquierda para guardarla y subir su logotipo a Google Drive.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                    {stores.map(store => (
                      <Card key={store.id} className="border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-zinc-300 transition-all bg-white font-sans">
                        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
                          <div className="flex items-center gap-2.5">
                            <div className="size-10 bg-zinc-50 border border-zinc-100 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                              {store.logoUrl ? (
                                <img src={store.logoUrl} alt={store.name} className="size-full object-contain shrink-0" referrerPolicy="no-referrer" />
                              ) : (
                                <MapPin className="size-5 text-zinc-400" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <h5 className="font-bold text-sm text-zinc-900 leading-tight line-clamp-1">{store.name}</h5>
                              {store.logoFileId && (
                                <span className="text-[8px] px-1 py-0.2 bg-emerald-50 text-emerald-800 font-mono font-bold uppercase tracking-wider rounded border border-emerald-100">
                                  Drive Link
                                </span>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-7 text-zinc-400 hover:text-rose-600 rounded-full"
                            onClick={() => handleDeleteStore(store.id, store.name)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: Inventory / Reusable Catalog */}
          <TabsContent value="inventory" className="space-y-6">
            <form onSubmit={handleCreateProduct} className="p-4 border rounded-xl bg-zinc-50/50 space-y-4">
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1">
                <Plus className="size-4" /> Registrar nuevo Producto en el Catálogo
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Nombre del Producto</Label>
                  <Input 
                    placeholder="Ej. Arroz Grano Extra, Papel Toalla"
                    value={newProd.name}
                    onChange={e => setNewProd({...newProd, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select 
                    value={newProd.categoryId} 
                    onValueChange={(catId) => setNewProd({...newProd, categoryId: catId, subcategory: ''})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Subcategoría</Label>
                  <Select 
                    value={newProd.subcategory} 
                    onValueChange={(sub) => setNewProd({...newProd, subcategory: sub})}
                    disabled={!newProd.categoryId}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar subcategoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.find(c => c.id === newProd.categoryId)?.subcategories?.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Tipo de Consumo / Compra</Label>
                  <Select 
                    value={String(newProd.isRegular)} 
                    onValueChange={(val) => setNewProd({...newProd, isRegular: val === 'true'})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Consumo Regular (Reutilizable / Comprar periódicamente)</SelectItem>
                      <SelectItem value="false">Esporádica (Adquisición única o eventual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Precio Promedio ($)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={newProd.defaultPrice}
                    onChange={e => setNewProd({...newProd, defaultPrice: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Dónde se compra (Tienda/Establecimiento)</Label>
                  <Select 
                    value={newProd.lastStore} 
                    onValueChange={(val) => setNewProd({...newProd, lastStore: val})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar tienda" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.name}>
                          <div className="flex items-center gap-2 font-sans text-xs">
                            {store.logoUrl ? (
                              <img src={store.logoUrl} alt={store.name} className="size-4 object-contain rounded" referrerPolicy="no-referrer" />
                            ) : (
                              <MapPin className="size-3.5 text-zinc-400" />
                            )}
                            <span>{store.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom-store">Escribir otra...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newProd.lastStore === 'custom-store' && (
                  <div className="space-y-1">
                    <Label>Escribe el nombre de la tienda</Label>
                    <Input 
                      placeholder="Ej. Mercado Central, Verdulería" 
                      value={lastStoreCustom}
                      onChange={e => setLastStoreCustom(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Existencias Iniciales (Stock)</Label>
                  <Input 
                    type="number" 
                    placeholder="0"
                    value={newProd.stock}
                    onChange={e => setNewProd({...newProd, stock: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Alerta Mínimo de Stock</Label>
                  <Input 
                    type="number" 
                    placeholder="2"
                    value={newProd.minStock}
                    onChange={e => setNewProd({...newProd, minStock: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]">
                  <Plus className="size-4 mr-1" />
                  Agregar al Inventario
                </Button>
              </div>
            </form>

            {/* Catalog List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="size-4 text-zinc-500" />
                  Productos Registrados e Inventario
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] font-sans font-semibold bg-blue-50 text-blue-700 border-blue-200">
                    Regular / Reutilizable
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-sans font-semibold bg-zinc-50 text-zinc-600 border-zinc-200">
                    Esporádico
                  </Badge>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 text-sm">
                  No hay productos registrados en el catálogo aún. Ingresa uno arriba.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(prod => {
                    const isLowStock = prod.stock <= (prod.minStock || 0);
                    const matchedStore = stores.find(s => s.name.toLowerCase() === prod.lastStore.toLowerCase());
                    return (
                      <div 
                        key={prod.id} 
                        className={`p-4 rounded-xl border flex flex-col justify-between hover:shadow-sm transition-all ${
                          isLowStock 
                            ? 'border-amber-200 bg-amber-50/20' 
                            : 'border-zinc-200 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5">
                              <h5 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                                {prod.name}
                                {prod.isRegular ? (
                                  <Badge className="text-[9px] bg-blue-50 text-blue-700 font-sans border-blue-200 uppercase scale-90">Regular</Badge>
                                ) : (
                                  <Badge className="text-[9px] bg-zinc-100 text-zinc-600 font-sans border-zinc-200 uppercase scale-90">Temporal</Badge>
                                )}
                              </h5>
                              <p className="text-[10px] text-zinc-500 tracking-wide font-medium flex items-center gap-1">
                                <span>{getCatName(prod.categoryId)}</span>
                                <span className="text-zinc-300">•</span>
                                <span className="italic">{prod.subcategory || 'General'}</span>
                              </p>
                            </div>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-7 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                              onClick={() => handleDeleteProduct(prod.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3.5 text-zinc-400 shrink-0" />
                              Precio: <strong className="text-zinc-800">${prod.defaultPrice ? prod.defaultPrice.toFixed(2) : '0.00'}</strong>
                            </span>
                            <span className="flex items-center gap-1.5 truncate">
                              {matchedStore && matchedStore.logoUrl ? (
                                <img src={matchedStore.logoUrl} alt={prod.lastStore} className="size-4 object-contain rounded shrink-0" referrerPolicy="no-referrer" />
                              ) : (
                                <MapPin className="size-3.5 text-zinc-400 shrink-0" />
                              )}
                              Tienda: <strong className="text-zinc-800 truncate" title={prod.lastStore}>{prod.lastStore}</strong>
                            </span>
                          </div>

                          <div className="mt-3 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-xs text-zinc-500">Stock disponible:</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm font-extrabold ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {prod.stock} unidades
                                </span>
                                {isLowStock && (
                                  <span className="text-[9px] font-bold text-amber-500 bg-amber-100 px-1 py-0.2 rounded">
                                    ¡Comprar ya! (mín: {prod.minStock})
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="size-7 p-0 rounded-lg hover:bg-zinc-200 text-zinc-500 bg-white"
                              onClick={() => handleConsumeItem(prod)}
                              title="Consumir / Usar unidad de stock"
                            >
                              <Minus className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-100 flex gap-2">
                          {!hasSheetAuth && (
                            <p className="text-[10px] text-zinc-400 italic leading-snug">
                              Vincule Google Sheets en el paso 1 para activar registro de compras de este producto.
                            </p>
                          )}
                          <Button 
                            onClick={() => startPurchaseSetup(prod)} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs tracking-wide py-1.5 h-8 flex-grow"
                          >
                            <ShoppingCart className="size-3 mr-1.5" />
                            Registrar Compra
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* POPUP OVERLAY TO FINALIZE PURCHASE & SYNC WITH GOOGLE SHEETS */}
      {purchasingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white border-none shadow-2xl relative">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="size-5 text-indigo-600 animate-bounce" />
                Registrar Compra y Surtir
              </CardTitle>
              <CardDescription>
                Se registrará un retiro contable en Finanza Pro y se guardará un renglón en tu hoja de Google Sheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-zinc-50 p-3 rounded-lg border">
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Artículo seleccionado</p>
                <h4 className="text-sm font-bold text-zinc-900 mt-1">{purchasingProduct.name}</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Tienda: {purchasingProduct.lastStore} | Tipo: {purchasingProduct.isRegular ? 'Consumo Regular' : 'Esporádica'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="purQty">Cantidad a Comprar</Label>
                  <Input 
                    id="purQty"
                    type="number" 
                    value={purchaseQty}
                    onChange={e => setPurchaseQty(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="purPrice">Precio Unitario ($)</Label>
                  <Input 
                    id="purPrice"
                    type="number" 
                    step="0.01"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Option to pay with debt */}
              <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">🔴 Pagar con Deuda</span>
                  <span className="text-[9px] font-semibold text-rose-600">Cargar a tarjeta o crédito rotativo</span>
                </div>
                <input
                  type="checkbox"
                  className="size-4 rounded text-rose-600 border-rose-300 accent-rose-600 cursor-pointer"
                  checked={payWithDebt}
                  onChange={(e) => setPayWithDebt(e.target.checked)}
                />
              </div>

              {!payWithDebt ? (
                <div className="space-y-1">
                  <Label>Pagar desde Cuenta</Label>
                  <Select value={purchaseAccountId} onValueChange={setPurchaseAccountId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccione la cuenta bancaria" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} (Saldo: ${acc.balance.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-rose-800">Tarjeta de Crédito / Crédito Rotativo</Label>
                  <Select value={selectedDebtId} onValueChange={setSelectedDebtId}>
                    <SelectTrigger className="bg-white border-rose-200 text-rose-950 font-bold">
                      <SelectValue placeholder="Selecciona tarjeta/crédito rotativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {debts
                        .filter(d => d.type === 'credit_card' || d.type === 'revolving')
                        .map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            💳 {d.name} ({d.creditor}) | Deuda: ${d.remainingAmount.toLocaleString()}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {debts.filter(d => d.type === 'credit_card' || d.type === 'revolving').length === 0 && (
                    <p className="text-[9.5px] text-rose-600 font-bold mt-1">
                      ⚠️ No tienes tarjetas de crédito o créditos rotativos registrados en "Deudas".
                    </p>
                  )}
                </div>
              )}

              {hasSheetAuth ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                  <Check className="size-4 shrink-0" />
                  Sincronización en directo autorizada con Google Sheets.
                </div>
              ) : (
                <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg flex items-center gap-1.5 border border-amber-200">
                  <CloudOff className="size-4 shrink-0" />
                  Atención: No has configurado la sincronización con Sheets. Debes vincular tu cuenta primero.
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setPurchasingProduct(null)}
                disabled={isRecordingPurchase}
                className="text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleExecutePurchase}
                disabled={isRecordingPurchase || !hasSheetAuth}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {isRecordingPurchase ? 'Sincronizando...' : 'Confirmar y Guardar'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </Card>
  );
}
