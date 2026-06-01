import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseProduct, PurchaseCategory, ShoppingList, ShoppingItem, Account } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Percent, 
  Sparkles, 
  History, 
  X, 
  Check, 
  RotateCcw, 
  Search, 
  Tag, 
  DollarSign, 
  CheckSquare, 
  ListPlus, 
  ArrowUpDown, 
  AlertTriangle,
  Info,
  Compass,
  MapPin,
  Store,
  Map,
  ChevronRight,
  Navigation
} from 'lucide-react';
import { RadarStoreMap } from './RadarStoreMap';

export function MarketView() {
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [categories, setCategories] = useState<PurchaseCategory[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Tabs: 'lists' | 'consumption' | 'store-radar'
  const [activeTab, setActiveTab ] = useState<'lists' | 'consumption' | 'store-radar'>('lists');

  // Multi-Store Radar & Geographic Perimeters State
  const [sharedStores, setSharedStores] = useState<any[]>([]);
  const [sharedCatalog, setSharedCatalog] = useState<any[]>([]);
  const [activeRadarMode, setActiveRadarMode] = useState<'perimeter' | 'store-specific'>('perimeter');
  
  // Specific store browser state
  const [selectedRadarStoreId, setSelectedRadarStoreId] = useState<string>('all');
  const [radarStoreSearchTerm, setRadarStoreSearchTerm] = useState('');

  // Radar perimeter center & interactive radius limit
  const [radarCenter, setRadarCenter] = useState<{ lat: number; lng: number } | null>({ lat: 4.7015, lng: -74.0435 }); // Default: Bogotá coordinates
  const [radarCenterAddress, setRadarCenterAddress] = useState('Unicentro Bogotá, Colombia');
  const [radarRadiusKm, setRadarRadiusKm] = useState<number>(1.5); // Default radius in km
  
  // Search states
  const [consumptionSearch, setConsumptionSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // List Modal states
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListForm, setNewListForm] = useState({ name: '' });
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Item form inside active list
  const [newItemForm, setNewItemForm] = useState({
    productId: '',
    customName: '',
    qty: '1',
    price: ''
  });

  // Finalize Shopping List Modal state
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({
    accountId: '',
    registerTransaction: true
  });

  // Load subscriptions
  useEffect(() => {
    const unsubProducts = dbService.subscribeToCollection('purchase_products', setProducts);
    const unsubCategories = dbService.subscribeToCollection('purchase_categories', setCategories);
    const unsubLists = dbService.subscribeToCollection('shopping_lists', (data) => {
      setLists(data);
      // Automatically select the first pending list as active
      const pending = data.find(l => l.status === 'pending');
      if (pending && !activeListId) {
        setActiveListId(pending.id);
      } else if (!pending && data.length > 0 && !activeListId) {
        setActiveListId(data[0].id);
      }
    });
    const unsubAccounts = dbService.subscribeToCollection('accounts', setAccounts);
    
    // Subscribe to shared catalog-stores and public products catalog
    const unsubCatalogStores = dbService.subscribeToCatalogStores((storesData) => {
      setSharedStores(storesData);
      if (storesData.length > 0 && selectedRadarStoreId === 'all') {
        setSelectedRadarStoreId(storesData[0].id);
      }
    });
    const unsubCatalog = dbService.subscribeToCatalog(setSharedCatalog);

    return () => {
      unsubProducts();
      unsubCategories();
      unsubLists();
      unsubAccounts();
      unsubCatalogStores();
      unsubCatalog();
    };
  }, []);

  const activeList = useMemo(() => {
    return lists.find(l => l.id === activeListId);
  }, [lists, activeListId]);

  const pendingLists = useMemo(() => {
    return lists.filter(l => l.status === 'pending');
  }, [lists]);

  const completedLists = useMemo(() => {
    return lists.filter(l => l.status === 'completed');
  }, [lists]);

  // Total cost calculation of the selected active list
  const activeListCost = useMemo(() => {
    if (!activeList || !activeList.items) return 0;
    return activeList.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [activeList]);

  // Checked state counters
  const activeListProgress = useMemo(() => {
    if (!activeList || !activeList.items || activeList.items.length === 0) return { total: 0, checked: 0, pct: 0 };
    const total = activeList.items.length;
    const checked = activeList.items.filter(item => item.checked).length;
    const pct = (checked / total) * 100;
    return { total, checked, pct };
  }, [activeList]);

  // Handle create new shopping list
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListForm.name.trim()) {
      toast.error('Especifica un nombre para la lista');
      return;
    }

    try {
      const newListId = await dbService.addItem('shopping_lists', {
        name: newListForm.name.trim(),
        status: 'pending',
        items: [] as ShoppingItem[]
      });

      toast.success(`Lista "${newListForm.name}" creada.`);
      setIsNewListOpen(false);
      setNewListForm({ name: '' });
      if (newListId) {
        setActiveListId(newListId);
      }
    } catch (err) {
      toast.error('Error al crear la lista de mercado');
    }
  };

  // Delete shopping list with validation
  const handleDeleteList = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar definitivamente la lista "${name}"?`)) return;
    try {
      await dbService.deleteItem('shopping_lists', id);
      toast.success('Lista eliminada con éxito');
      if (activeListId === id) {
        setActiveListId(null);
      }
    } catch (e) {
      toast.error('Error al borrar lista');
    }
  };

  // Handle selection of product in lists forms
  const handleProductSelect = (prodId: string) => {
    if (prodId === 'custom') {
      setNewItemForm({
        productId: 'custom',
        customName: '',
        qty: '1',
        price: ''
      });
    } else {
      const selectedProd = products.find(p => p.id === prodId);
      if (selectedProd) {
        setNewItemForm({
          productId: prodId,
          customName: selectedProd.name,
          qty: '1',
          price: String(selectedProd.defaultPrice || '')
        });
      }
    }
  };

  // Add Item to current active shopping list
  const handleAddItemToList = async () => {
    if (!activeList) {
      toast.error('Crea o selecciona una lista de mercado primero');
      return;
    }

    const { productId, customName, qty, price } = newItemForm;
    const parsedQty = parseInt(qty) || 1;
    const parsedPrice = parseFloat(price) || 0;

    if (!customName.trim()) {
      toast.error('Especifica el nombre del artículo o selecciona un producto');
      return;
    }

    const currentItems = activeList.items || [];
    
    // Check if product is already in the list, if so, merge quantities!
    let updatedItems = [...currentItems];
    const isInventoryProd = productId && productId !== 'custom';
    const existingIndex = updatedItems.findIndex(item => 
      isInventoryProd ? item.productId === productId : item.name.toLowerCase() === customName.trim().toLowerCase()
    );

    if (existingIndex > -1) {
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        qty: updatedItems[existingIndex].qty + parsedQty,
        price: parsedPrice || updatedItems[existingIndex].price // keep latest price
      };
    } else {
      // Find possible subcategory
      let subcategory = '';
      if (isInventoryProd) {
        const prod = products.find(p => p.id === productId);
        subcategory = prod ? prod.subcategory : '';
      }

      const newItem: ShoppingItem = {
        id: crypto.randomUUID(), // unique temporary id
        productId: isInventoryProd ? productId : undefined,
        name: customName.trim(),
        qty: parsedQty,
        price: parsedPrice,
        checked: false,
        subcategory
      };
      updatedItems.push(newItem);
    }

    try {
      await dbService.updateItem('shopping_lists', activeList.id, {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });

      toast.success(`"${customName}" añadido a la lista.`);
      // Reset form
      setNewItemForm({
        productId: '',
        customName: '',
        qty: '1',
        price: ''
      });
    } catch (e) {
      toast.error('Error al registrar artículo en la lista');
    }
  };

  // Toggle item checked state in active list
  const handleToggleItemCheck = async (itemId: string, currentState: boolean) => {
    if (!activeList) return;
    const updatedItems = activeList.items.map(item => {
      if (item.id === itemId) {
        return { ...item, checked: !currentState };
      }
      return item;
    });

    try {
      await dbService.updateItem('shopping_lists', activeList.id, {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      toast.error('Error al marcar artículo');
    }
  };

  // Delete item from active list
  const handleRemoveItemFromList = async (itemId: string, itemName: string) => {
    if (!activeList) return;
    const updatedItems = activeList.items.filter(item => item.id !== itemId);

    try {
      await dbService.updateItem('shopping_lists', activeList.id, {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });
      toast.info(`"${itemName}" removido de la lista`);
    } catch (e) {
      toast.error('Error al remover el artículo');
    }
  };

  // Direct quick action: add item near empty or empty to shopping list directly!
  const handleQuickAddEmptyToMarketList = async (product: PurchaseProduct) => {
    // 1. Get or create a pending list
    let targetList = pendingLists[0];
    
    if (!targetList) {
      // Create a default weekly list
      try {
        const newListId = await dbService.addItem('shopping_lists', {
          name: 'Lista de Reabastecimiento',
          status: 'pending',
          items: [] as ShoppingItem[]
        });
        targetList = {
          id: newListId || '',
          name: 'Lista de Reabastecimiento',
          status: 'pending',
          items: []
        };
        if (newListId) setActiveListId(newListId);
      } catch (e) {
        toast.error('No se pudo inicializar una lista de mercado');
        return;
      }
    }

    const currentItems = targetList.items || [];
    let updatedItems = [...currentItems];
    const existingIndex = updatedItems.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        qty: updatedItems[existingIndex].qty + 1
      };
    } else {
      const newItem: ShoppingItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        qty: 1,
        price: product.defaultPrice || 0,
        checked: false,
        subcategory: product.subcategory
      };
      updatedItems.push(newItem);
    }

    try {
      await dbService.updateItem('shopping_lists', targetList.id, {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });
      toast.success(`"${product.name}" añadido a la lista "${targetList.name}"`);
    } catch (e) {
      toast.error('Error al reabastecer el artículo en la lista');
    }
  };

  // Quick Action: Update product consumption percentage in Firestore
  const handleUpdateConsumption = async (product: PurchaseProduct, pct: number) => {
    try {
      await dbService.updateItem('purchase_products', product.id, {
        consumptionPercentage: pct,
        updatedAt: new Date().toISOString()
      });
      
      const roundedPct = pct.toFixed(0);
      if (pct === 0) {
        toast.info(
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-rose-650">¡Producto Agotado! ⚠️</span>
            <span className="text-xs">
              Has terminado <strong>{product.name}</strong>. ¿Quieres añadirlo a tu lista de compras?
            </span>
            <Button 
              size="sm" 
              className="mt-1.5 h-7 text-[10px] bg-zinc-900 text-white font-bold"
              onClick={() => handleQuickAddEmptyToMarketList(product)}
            >
              Sí, añadir a lista
            </Button>
          </div>,
          { duration: 5000 }
        );
      } else if (pct <= 25) {
        toast.warning(`"${product.name}" está cerca de terminarse (queda solo el ${roundedPct}%).`);
      } else {
        toast.success(`Consumo de "${product.name}" ajustado al ${roundedPct}%.`);
      }
    } catch (e) {
      toast.error('Error al actualizar el porcentaje de consumo');
    }
  };

  // Open Finalize Shop Dialog
  const handleOpenFinalize = () => {
    if (!activeList || !activeList.items || activeList.items.length === 0) {
      toast.error('La lista está vacía, añade algunos productos primero');
      return;
    }
    const checkedCount = activeList.items.filter(item => item.checked).length;
    if (checkedCount === 0) {
      if (!window.confirm('No has marcado ningún artículo como cobrado/comprado. ¿Deseas finalizar todos los artículos aun así?')) {
        return;
      }
    }

    setFinalizeForm({
      accountId: accounts[0]?.id || '',
      registerTransaction: true
    });
    setIsFinalizeOpen(true);
  };

  // Finalize lists, restock items & adjust balance ledger
  const handleExecuteFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList) return;

    const account = accounts.find(a => a.id === finalizeForm.accountId);
    if (finalizeForm.registerTransaction && !account) {
      toast.error('Por favor, selecciona una cuenta para deducir el importe');
      return;
    }

    // Filter purchased items (if none items are checked, assume all of them are purchased for safety, or just the checked ones)
    const checkedItems = activeList.items.filter(item => item.checked);
    const itemsToProcess = checkedItems.length > 0 ? checkedItems : activeList.items;
    const finalCost = itemsToProcess.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (finalizeForm.registerTransaction && account && account.balance < finalCost) {
      if (!window.confirm(`El importe total ($${finalCost.toLocaleString()}) supera el saldo disponible en "${account.name}" ($${account.balance.toLocaleString()}). ¿Deseas continuar y registrar saldo negativo?`)) {
        return;
      }
    }

    try {
      // 1. Process Stock Restocking and Consumption reset for inventory products
      for (const item of itemsToProcess) {
        if (item.productId) {
          const matchedProd = products.find(p => p.id === item.productId);
          if (matchedProd) {
            const currentStock = matchedProd.stock || 0;
            const newStock = currentStock + item.qty;
            
            // Refill consumption to 100% since it's brand new
            await dbService.updateItem('purchase_products', matchedProd.id, {
              stock: newStock,
              consumptionPercentage: 100, // Reset to full!
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      // 2. Adjust Balance ledger & create Transaction expense if requested
      if (finalizeForm.registerTransaction && account) {
        const newBalance = account.balance - finalCost;
        
        // Update account
        await dbService.updateItem('accounts', account.id, { balance: newBalance });

        // Generate Transaction ledger
        // Find existing 'Compras' or 'Supermercado' category
        let purchaseCategory = categories.find(c => c.type === 'purchase');
        if (!purchaseCategory) {
          purchaseCategory = categories.find(c => c.name.toLowerCase() === 'comida' || c.name.toLowerCase() === 'mercado');
        }

        await dbService.addItem('transactions', {
          amount: finalCost,
          type: 'purchase', // Matches purchase audit
          categoryId: purchaseCategory ? purchaseCategory.id : (categories[0]?.id || ''),
          accountId: account.id,
          date: new Date().toISOString().split('T')[0],
          description: `Compra surtida: ${activeList.name}`,
          isEventual: false // Regular monthly groceries
        });
      }

      // 3. Mark list as Completed
      await dbService.updateItem('shopping_lists', activeList.id, {
        status: 'completed',
        updatedAt: new Date().toISOString()
      });

      toast.success(
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-emerald-800">¡Compra Surtida con Éxito! 🎉</span>
          <span className="text-xs">
            Se reabasteció el inventario y se resetearon los medidores de consumo al <strong>100%</strong>.
          </span>
          {finalizeForm.registerTransaction && account && (
            <span className="text-xs text-zinc-500">
              Se debitó ${finalCost.toLocaleString()} de la cuenta "<em>{account.name}</em>".
            </span>
          )}
        </div>,
        { duration: 5000 }
      );

      setIsFinalizeOpen(false);
      setActiveListId(null);
    } catch (e) {
      toast.error('Ocurrió un error al despachar la compra');
    }
  };

  // Filter products for the consumption view
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(consumptionSearch.toLowerCase()) || 
                            p.subcategory.toLowerCase().includes(consumptionSearch.toLowerCase());
      const matchesCat = selectedCatFilter === 'all' || p.categoryId === selectedCatFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, consumptionSearch, selectedCatFilter]);

  // Haversine distance formula between two lat/lng points client-side
  const computeDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's equatorial perimeter in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 1. Calculate stores in current radar coverage
  const radarStores = useMemo(() => {
    if (!radarCenter) return [];
    return sharedStores.map(store => {
      if (!store.latitude || !store.longitude) {
        return { ...store, distance: null };
      }
      const distance = computeDistanceKm(radarCenter.lat, radarCenter.lng, store.latitude, store.longitude);
      return { ...store, distance };
    }).filter(store => {
      if (store.distance === null) return false;
      return store.distance <= radarRadiusKm;
    }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [sharedStores, radarCenter, radarRadiusKm]);

  // 2. Aggregate available products in selected perimeter
  const radarProducts = useMemo(() => {
    if (radarStores.length === 0) return [];
    const perimeterStoreNames = new Set(radarStores.map(s => s.name.toLowerCase().trim()));
    return sharedCatalog.filter(product => {
      const match = product.store && perimeterStoreNames.has(product.store.toLowerCase().trim());
      return match;
    });
  }, [sharedCatalog, radarStores]);

  // 3. Info of currently selected store in specific store browser tab
  const activeSelectedStoreObj = useMemo(() => {
    return sharedStores.find(s => s.id === selectedRadarStoreId);
  }, [sharedStores, selectedRadarStoreId]);

  // 4. Products list for selected store browser
  const activeSelectedStoreProducts = useMemo(() => {
    if (!activeSelectedStoreObj) return [];
    return sharedCatalog.filter(p => {
      const isStoreMatch = p.store && p.store.toLowerCase().trim() === activeSelectedStoreObj.name.toLowerCase().trim();
      const isSearchMatch = !radarStoreSearchTerm.trim() || p.name.toLowerCase().includes(radarStoreSearchTerm.toLowerCase());
      return isStoreMatch && isSearchMatch;
    });
  }, [sharedCatalog, activeSelectedStoreObj, radarStoreSearchTerm]);

  return (
    <div className="space-y-8 animate-fade-in" id="market-view-root">
      {/* Sub-Header Tabs Row */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-2 flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('lists')}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'lists' 
                ? 'bg-zinc-900 text-white shadow-md' 
                : 'bg-zinc-100 text-zinc-650 hover:bg-zinc-200'
            }`}
          >
            <ShoppingCart className="size-3.5" />
            Mis Listas de Mercado
          </button>
          
          <button
            onClick={() => setActiveTab('consumption')}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'consumption' 
                ? 'bg-zinc-900 text-white shadow-md' 
                : 'bg-zinc-100 text-zinc-650 hover:bg-zinc-200'
            }`}
          >
            <Percent className="size-3.5" />
            Control de Consumo (% de Alacena)
          </button>

          <button
            onClick={() => setActiveTab('store-radar')}
            className={`py-2 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'store-radar' 
                ? 'bg-zinc-900 text-white shadow-md' 
                : 'bg-zinc-100 text-zinc-650 hover:bg-zinc-200'
            }`}
          >
            <Compass className="size-3.5" />
            Geolocalización & Radar de Tiendas
          </button>
        </div>

        {activeTab === 'lists' && (
          <Button 
            size="sm"
            className="text-xs bg-zinc-900 hover:bg-zinc-850 font-bold text-white shadow-sm h-9"
            onClick={() => setIsNewListOpen(true)}
          >
            <ListPlus className="size-3.5 mr-1.5" />
            Crear Nueva Lista
          </Button>
        )}
      </div>

      {/* VIEW PANEL 1: SHOPPING LISTS */}
      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Sidebar Left: Lists Panel Selector */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="pb-3 border-b border-zinc-100">
                <CardTitle className="text-xs font-black text-zinc-400 uppercase tracking-wider">Listas Activas</CardTitle>
                <CardDescription className="text-[10px] text-zinc-400">Listas pendientes para ir de compras</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 p-2 space-y-1">
                {pendingLists.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-400 italic">No hay listas pendientes</div>
                ) : (
                  pendingLists.map(list => {
                    const totalItems = list.items?.length || 0;
                    const boughtItems = list.items?.filter(item => item.checked).length || 0;
                    const score = totalItems > 0 ? `${boughtItems}/${totalItems}` : '0 ítems';

                    return (
                      <div 
                        key={list.id}
                        className={`group w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all ${
                          activeListId === list.id 
                            ? 'bg-zinc-900 text-white shadow' 
                            : 'hover:bg-zinc-150 text-zinc-700 bg-zinc-50'
                        }`}
                        onClick={() => setActiveListId(list.id)}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">{list.name}</span>
                          <span className={`text-[10px] font-medium leading-none mt-1 ${
                            activeListId === list.id ? 'text-zinc-350' : 'text-zinc-400'
                          }`}>
                            {score} comprados
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
                            activeListId === list.id ? 'text-zinc-400 hover:text-white hover:bg-zinc-805' : 'text-zinc-400 hover:text-rose-650'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id, list.name);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </CardContent>

              <CardHeader className="pt-2 pb-2 border-t border-zinc-100">
                <CardTitle className="text-xs font-black text-zinc-400 uppercase tracking-wider">Historial Completado</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[180px] overflow-y-auto">
                {completedLists.length === 0 ? (
                  <div className="text-center py-4 text-[11px] text-zinc-400 italic">Sin historial</div>
                ) : (
                  completedLists.map(list => (
                    <div 
                      key={list.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold ${
                        activeListId === list.id 
                          ? 'bg-zinc-900 text-white' 
                          : 'bg-zinc-50/50 hover:bg-zinc-100 text-zinc-550'
                      } cursor-pointer`}
                      onClick={() => setActiveListId(list.id)}
                    >
                      <span className="truncate pr-2">{list.name}</span>
                      <Badge className="bg-emerald-50 text-emerald-700 text-[8px] border border-emerald-100 shrink-0">Llenado ✓</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Column: Selected active list content */}
          <div className="lg:col-span-3 space-y-6">
            {!activeList ? (
              <Card className="border-none shadow-md bg-white p-12 text-center">
                <CardContent className="space-y-4 flex flex-col items-center justify-center">
                  <div className="p-4 bg-zinc-50 text-zinc-400 rounded-full">
                    <ShoppingCart className="size-10" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800">No hay ninguna lista de mercado seleccionada</h4>
                    <p className="text-xs text-zinc-500 text-balance max-w-sm mt-1">
                      Crea una nueva lista abajo o importa suministros agotados desde el panel de consumo por porcentaje.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsNewListOpen(true)}
                    className="bg-zinc-900 text-white font-bold text-xs"
                  >
                    Crear Nueva Lista
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-zinc-100 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-zinc-950">{activeList.name}</CardTitle>
                      {activeList.status === 'completed' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 text-[9px] uppercase">
                          Completada y Surtida
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 font-bold border border-amber-100 text-[9px] uppercase">
                          Pendiente de Compra
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {activeList.status === 'completed' 
                        ? 'Esta lista fue despachada y abasteció tu despensa.' 
                        : 'Añade productos de tu catálogo, táchalos en caja y finaliza para debitar del presupuesto.'}
                    </CardDescription>
                  </div>

                  {activeList.status === 'pending' && (
                    <Button
                      onClick={handleOpenFinalize}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm shrink-0"
                    >
                      <Check className="size-3.5 mr-1.5" />
                      Finalizar Compra
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Progress tracker & statistics bar */}
                  {activeList.items && activeList.items.length > 0 && (
                    <div className="p-4 bg-zinc-50 border border-zinc-150 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="w-full md:w-2/3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 leading-none">
                          <span>Estado del Carrito</span>
                          <span>{activeListProgress.checked} de {activeListProgress.total} artículos ({activeListProgress.pct.toFixed(0)}%)</span>
                        </div>
                        <Progress value={activeListProgress.pct} className="h-2 bg-zinc-200" indicatorClassName="bg-emerald-600" />
                      </div>

                      <div className="space-y-0.5 text-center md:text-right w-full md:w-max min-w-[120px]">
                        <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider block">Costo Estimado</span>
                        <strong className="text-lg font-black text-violet-650 block font-mono leading-none">
                          ${activeListCost.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* 1. Add item Form inside shopping list */}
                  {activeList.status === 'pending' && (
                    <div className="p-4 bg-zinc-50/55 rounded-2xl border border-dashed border-zinc-250 space-y-3">
                      <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                        <Plus className="size-4 text-zinc-500" />
                        Agregar Artículo a la Lista
                      </span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4 space-y-1">
                          <Label className="text-[10px]">Producto del Inventario</Label>
                          <Select value={newItemForm.productId} onValueChange={handleProductSelect}>
                            <SelectTrigger className="h-9 text-xs bg-white">
                              <SelectValue placeholder="Suministro de catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">✍️ Escribir ítem manual...</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.subcategory})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-4 space-y-1">
                          <Label className="text-[10px]">Articulo / Descripción</Label>
                          <Input 
                            value={newItemForm.customName}
                            onChange={e => setNewItemForm({ ...newItemForm, customName: e.target.value })}
                            placeholder="Ej. Arroz, Detergente..."
                            className="h-9 text-xs bg-white"
                            disabled={newItemForm.productId !== 'custom' && newItemForm.productId !== ''}
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px]">Cant.</Label>
                          <Input 
                            type="number"
                            value={newItemForm.qty}
                            onChange={e => setNewItemForm({ ...newItemForm, qty: e.target.value })}
                            className="h-9 text-xs bg-white font-mono"
                            min="1"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px]">Precio Est. ($)</Label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={newItemForm.price}
                            onChange={e => setNewItemForm({ ...newItemForm, price: e.target.value })}
                            placeholder="0"
                            className="h-9 text-xs bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          onClick={handleAddItemToList}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs h-8 px-4"
                        >
                          Añadir a Lista
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 2. Items list rendering */}
                  {!activeList.items || activeList.items.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 italic text-xs max-w-sm mx-auto">
                      Esta lista está vacía. Añade suministros arriba, o ve a la sección de Control de Consumo para escanear qué productos están agotándose.
                    </div>
                  ) : (
                    <div className="border rounded-2xl overflow-hidden divide-y">
                      {activeList.items.map(item => {
                        return (
                          <div 
                            key={item.id} 
                            className={`p-3.5 flex items-center justify-between gap-4 transition-colors ${
                              item.checked ? 'bg-zinc-50 text-zinc-400Line' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {activeList.status === 'pending' ? (
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() => handleToggleItemCheck(item.id, item.checked)}
                                  className="size-4.5 rounded text-emerald-600 border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                                />
                              ) : (
                                <Check className="size-4 text-emerald-600 shrink-0" />
                              )}

                              <div className="truncate">
                                <span className={`font-bold text-xs leading-loose block ${
                                  item.checked ? 'line-through text-zinc-400 font-medium' : 'text-zinc-850'
                                }`}>
                                  {item.name}
                                </span>
                                {item.subcategory && (
                                  <span className="text-[9px] text-zinc-400 font-medium font-sans uppercase">
                                    {item.subcategory}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-5 shrink-0">
                              <div className="text-right">
                                <span className="text-[11px] font-bold block text-zinc-900 font-mono">
                                  ${(item.price * item.qty).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium block">
                                  {item.qty} uds × ${item.price.toLocaleString()}
                                </span>
                              </div>

                              {activeList.status === 'pending' && (
                                <button
                                  type="button"
                                  className="text-zinc-400 hover:text-rose-600 p-1.5"
                                  onClick={() => handleRemoveItemFromList(item.id, item.name)}
                                >
                                  <X className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      )}

      {/* VIEW PANEL 2: CONSUMPTION TRACKER PER PERCENTAGE */}
      {activeTab === 'consumption' && (
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <CardTitle className="text-base font-bold text-zinc-900">Control de Consumo por Porcentaje</CardTitle>
            <CardDescription className="text-xs">
              Mide el nivel de tus provisiones (100% = Cerrado, 50% = Mitad, 0% = Agotado). Los productos con bajo nivel generarán alertas tempranas para ser reabastecidos con un solo click.
            </CardDescription>

            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
              <div className="relative md:col-span-8">
                <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
                <Input 
                  placeholder="Filtrar por nombre o subcategoría..." 
                  className="pl-9 h-9.5 text-xs bg-zinc-50 border-zinc-200"
                  value={consumptionSearch}
                  onChange={e => setConsumptionSearch(e.target.value)}
                />
                {consumptionSearch && (
                  <button onClick={() => setConsumptionSearch('')} className="absolute right-2.5 top-2.5 text-zinc-400 pr-1">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="md:col-span-4">
                <Select value={selectedCatFilter} onValueChange={setSelectedCatFilter}>
                  <SelectTrigger className="h-9.5 text-xs bg-zinc-50 border-zinc-200">
                    <SelectValue placeholder="Filtrar Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ver Todas</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 italic">No hay productos que coincidan con la búsqueda. Escribe más artículos en catálogo.</div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-[620px] overflow-y-auto">
                {filteredProducts.map(prod => {
                  const currentPct = prod.consumptionPercentage ?? 100;
                  
                  // Status colors decision variables
                  let colorClass = 'bg-emerald-500';
                  let bgBadge = 'bg-emerald-50 text-emerald-700 border-emerald-150';
                  let statusLabel = 'Lleno / Abundante';
                  
                  if (currentPct === 0) {
                    colorClass = 'bg-rose-650';
                    bgBadge = 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse';
                    statusLabel = 'Agotado ⚠️';
                  } else if (currentPct <= 25) {
                    colorClass = 'bg-rose-500';
                    bgBadge = 'bg-rose-50 text-rose-600 border-rose-100';
                    statusLabel = 'Casi Vacío ⚠️';
                  } else if (currentPct <= 50) {
                    colorClass = 'bg-amber-500';
                    bgBadge = 'bg-amber-50 text-amber-700 border-amber-100';
                    statusLabel = 'Por la mitad';
                  }

                  return (
                    <div key={prod.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-zinc-50/20 transition-all">
                      
                      {/* Left: Product title and alarm metadata */}
                      <div className="space-y-1 w-full md:w-1/4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-zinc-850 leading-none">{prod.name}</h4>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-zinc-50 border-zinc-150 font-medium text-zinc-400">
                            {prod.subcategory}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-bold uppercase py-0.5 px-1 rounded-md border ${bgBadge}`}>
                            {statusLabel}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-450 italic pl-1">
                            Stock físico: {prod.stock || 0} uds
                          </span>
                        </div>
                      </div>

                      {/* Middle: Consumption tracking percentage meters with sliders */}
                      <div className="flex-grow space-y-2.5">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-zinc-450 font-semibold">Consumido / Capacidad disponible:</span>
                          <span className="text-xs font-black text-zinc-900 font-mono">{currentPct}%</span>
                        </div>
                        
                        <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-350 ${colorClass}`} 
                            style={{ width: `${currentPct}%` }} 
                          />
                        </div>

                        {/* Interactive prompt buttons 0, 25, 50, 75, 100 */}
                        <div className="flex gap-1.5 justify-between">
                          <button
                            onClick={() => handleUpdateConsumption(prod, 100)}
                            className={`flex-grow h-7 text-[10px] rounded-lg border font-bold transition-all ${
                              currentPct === 100 
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' 
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-550'
                            }`}
                          >
                            100% (Nuevo)
                          </button>
                          
                          <button
                            onClick={() => handleUpdateConsumption(prod, 75)}
                            className={`flex-grow h-7 text-[10px] rounded-lg border font-bold transition-all ${
                              currentPct === 75 
                                ? 'bg-emerald-600 border-emerald-600 text-white' 
                                : 'bg-zinc-50 hover:bg-zinc-10s text-zinc-550'
                            }`}
                          >
                            75%
                          </button>

                          <button
                            onClick={() => handleUpdateConsumption(prod, 50)}
                            className={`flex-grow h-7 text-[10px] rounded-lg border font-bold transition-all ${
                              currentPct === 50 
                                ? 'bg-amber-500 border-amber-500 text-white' 
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-550'
                            }`}
                          >
                            50%
                          </button>

                          <button
                            onClick={() => handleUpdateConsumption(prod, 25)}
                            className={`flex-grow h-7 text-[10px] rounded-lg border font-bold transition-all ${
                              currentPct === 25 
                                ? 'bg-red-500 border-red-500 text-white' 
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-550'
                            }`}
                          >
                            25%
                          </button>

                          <button
                            onClick={() => handleUpdateConsumption(prod, 0)}
                            className={`flex-grow h-7 text-[10px] rounded-lg border font-bold transition-all ${
                              currentPct === 0 
                                ? 'bg-rose-700 border-rose-750 text-white shadow-sm' 
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-550'
                            }`}
                          >
                            0% (Agotado)
                          </button>
                        </div>
                      </div>

                      {/* Right: Quick action trigger Restock */}
                      <div className="shrink-0 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-[10.5px] border-zinc-200 hover:bg-zinc-50 bg-white font-black flex items-center gap-1.5"
                          onClick={() => handleQuickAddEmptyToMarketList(prod)}
                        >
                          <Plus className="size-3.5" />
                          Pedir a la lista
                        </Button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VIEW PANEL 3: GEOLOCALIZACION & RADAR DE TIENDAS (PRODUCTS & AREAS COOP) */}
      {activeTab === 'store-radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start animate-fade-in text-zinc-900" id="store-radar-layout">
          
          {/* Left Panel: Coverage Radius Controller */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border border-zinc-200 shadow-md bg-white">
              <CardHeader className="pb-3 border-b border-zinc-150">
                <CardTitle className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="size-4 text-indigo-600 animate-spin" style={{ animationDuration: '8s' }} />
                  <span>Panel del Radar</span>
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-400">
                  Controla la geocobertura de tiendas y víveres colectivos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-zinc-650">Modo de consulta:</Label>
                  <div className="grid grid-cols-2 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => setActiveRadarMode('perimeter')}
                      className={`py-1.5 text-[10px] font-bold rounded transition-all ${
                        activeRadarMode === 'perimeter'
                          ? 'bg-zinc-900 text-white shadow-sm'
                          : 'text-zinc-650 hover:text-zinc-900'
                      }`}
                    >
                      Radar de Área
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRadarMode('store-specific')}
                      className={`py-1.5 text-[10px] font-bold rounded transition-all ${
                        activeRadarMode === 'store-specific'
                          ? 'bg-zinc-900 text-white shadow-sm'
                          : 'text-zinc-650 hover:text-zinc-900'
                      }`}
                    >
                      Por Tienda
                    </button>
                  </div>
                </div>

                {/* Radius controller (Only for perimeter mode) */}
                {activeRadarMode === 'perimeter' && (
                  <div className="space-y-3 pt-1 border-t border-zinc-100">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                      <span>Radio de Cobertura</span>
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                        {radarRadiusKm.toFixed(1)} Km
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <input 
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={radarRadiusKm}
                        onChange={(e) => setRadarRadiusKm(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-400 font-bold px-0.5">
                        <span>0.5 Km</span>
                        <span>1.5 Km</span>
                        <span>3.0 Km</span>
                        <span>5.0 Km</span>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">Punto de Referencia:</span>
                      <p className="text-[10.5px] leading-snug text-zinc-600 font-medium truncate select-all" title={radarCenterAddress}>
                        {radarCenterAddress}
                      </p>
                      {radarCenter && (
                        <div className="text-[8px] font-mono text-zinc-400">
                          Lat: {radarCenter.lat.toFixed(5)}, Lng: {radarCenter.lng.toFixed(5)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific store search control */}
                {activeRadarMode === 'store-specific' && (
                  <div className="space-y-4 pt-1 border-t border-zinc-100">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-zinc-700">Seleccionar Establecimiento:</Label>
                      {sharedStores.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No hay tiendas registradas</p>
                      ) : (
                        <Select 
                          value={selectedRadarStoreId} 
                          onValueChange={setSelectedRadarStoreId}
                        >
                          <SelectTrigger className="w-full text-xs h-9 bg-white border border-zinc-200 text-zinc-900">
                            <SelectValue placeholder="Escoge un local comercial" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border text-zinc-900">
                            {sharedStores.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="radar-store-search" className="text-xs font-bold text-zinc-700">Buscar en su almacén:</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                          id="radar-store-search"
                          placeholder="Buscar víveres, marcas..."
                          value={radarStoreSearchTerm}
                          onChange={(e) => setRadarStoreSearchTerm(e.target.value)}
                          className="pl-8 text-xs h-9 bg-white border-zinc-200 placeholder-zinc-400 text-zinc-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* General stat widget */}
            <Card className="border border-zinc-200 shadow-sm bg-gradient-to-br from-indigo-50/20 to-zinc-50">
              <CardContent className="p-4 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-800 block">Consolidado Colectivo</span>
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="p-2 bg-white border rounded-xl shadow-sm">
                    <div className="text-lg font-black text-indigo-650">{sharedStores.length}</div>
                    <div className="text-[8px] font-bold text-zinc-400 uppercase">Tiendas Totales</div>
                  </div>
                  <div className="p-2 bg-white border rounded-xl shadow-sm">
                    <div className="text-lg font-black text-emerald-650">{sharedCatalog.length}</div>
                    <div className="text-[8px] font-bold text-zinc-400 uppercase">Productos Coop</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Workspace (Map & Stores/Products List) */}
          <div className="space-y-6 lg:col-span-3">
            {/* PANEL A: PERIMETER RADAR SEARCH */}
            {activeRadarMode === 'perimeter' && (
              <div className="space-y-6">
                <Card className="border border-zinc-200 shadow-md bg-white overflow-hidden">
                  <CardHeader className="bg-zinc-50 border-b border-zinc-200/50 py-3 flex flex-row items-center justify-between gap-1 flex-wrap">
                    <div>
                      <CardTitle className="text-sm font-bold text-zinc-900">Perímetro del Radar Geográfico</CardTitle>
                      <CardDescription>
                        Focaliza una zona y visualiza las tiendas y víveres que se encuentran dentro de la cobertura
                      </CardDescription>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                        {radarStores.length} Tiendas Cerca
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-bold border-emerald-250 text-emerald-700 bg-emerald-50">
                        {radarProducts.length} Víveres en Área
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-5">
                    <div className="text-[11px] leading-relaxed text-zinc-500 bg-zinc-50 p-2.5 rounded-lg border border-zinc-150">
                      <strong>💡 Instrucciones del Radar:</strong> Puedes mover el centro del radar haciendo clic en **cualquier punto del mapa**, o usando el cuadro de búsqueda para relocalizar (Ej. <em>Unicentro Bogotá</em>). El radar calculará automáticamente qué tiendas se ubican dentro de tu rango seleccionado y compilará su inventario disponible.
                    </div>
                    
                    <RadarStoreMap 
                      stores={sharedStores}
                      radarCenter={radarCenter}
                      radarRadiusKm={radarRadiusKm}
                      onCenterSelect={(lat, lng, address) => {
                        setRadarCenter({ lat, lng });
                        setRadarCenterAddress(address);
                      }}
                      onStoreMarkerClick={(id) => {
                        setSelectedRadarStoreId(id);
                        setActiveRadarMode('store-specific');
                        toast.info(`Cambiando a vista de inventario de tienda.`);
                      }}
                      heightClass="h-[340px]"
                    />
                  </CardContent>
                </Card>

                {/* Sublist of stores in perimeter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Grid Left: Stores inside coverage */}
                  <Card className="border border-zinc-200/80 shadow-md bg-white">
                    <CardHeader className="pb-3 border-b border-zinc-100">
                      <CardTitle className="text-xs font-black text-zinc-400 uppercase tracking-widest">Tiendas en Perímetro</CardTitle>
                      <CardDescription className="text-[10px] text-zinc-400">Ordenadas por cercanía al epicentro</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {radarStores.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                          <Store className="size-8 mx-auto text-zinc-300 mb-1.5" />
                          <p className="text-xs font-bold text-zinc-500">Sin tiendas en esta cobertura</p>
                          <p className="text-[10px] text-zinc-400 mt-1">Arrastra el radar o incrementa el radio de búsqueda en el slider.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                          {radarStores.map((store) => {
                            const init = store.name ? store.name.charAt(0).toUpperCase() : 'T';
                            return (
                              <div 
                                key={store.id} 
                                onClick={() => {
                                  setSelectedRadarStoreId(store.id);
                                  setActiveRadarMode('store-specific');
                                }}
                                className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-150 bg-white hover:border-indigo-400 hover:bg-zinc-50 cursor-pointer transition-all self-stretch"
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  {store.logoUrl ? (
                                    <img 
                                      src={store.logoUrl} 
                                      alt={store.name} 
                                      className="w-8 h-8 rounded-full border border-zinc-200 object-cover bg-white"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                      {init}
                                    </div>
                                  )}
                                  <div className="overflow-hidden">
                                    <h4 className="font-bold text-xs text-zinc-800 line-clamp-1 truncate">{store.name}</h4>
                                    <p className="text-[10px] text-zinc-400 truncate font-medium">{store.address || 'Sin dirección precisa'}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 pl-1.5">
                                  <Badge className="bg-emerald-50 text-emerald-800 border-none font-bold font-mono text-[9px] hover:bg-emerald-50 animate-pulse">
                                    {(store.distance || 0).toFixed(2)} km
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Grid Right: Collective catalog products in Area */}
                  <Card className="border border-zinc-200/80 shadow-md bg-white">
                    <CardHeader className="pb-3 border-b border-zinc-100 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-black text-zinc-400 uppercase tracking-widest">Víveres Sugeridos en Área</CardTitle>
                        <CardDescription className="text-[10px] text-zinc-400">Existencias asociadas a tiendas cercas</CardDescription>
                      </div>
                      <Badge className="bg-indigo-50 text-indigo-800 border-none font-bold text-[9px] hover:bg-indigo-50">
                        {radarProducts.length} Ítems
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {radarProducts.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                          <Tag className="size-8 mx-auto text-zinc-300 mb-1.5" />
                          <p className="text-xs font-bold text-zinc-500">Sin productos disponibles</p>
                          <p className="text-[10px] text-zinc-400 mt-1">Registra víveres para estas sucursales en el Catálogo Colectivo.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {radarProducts.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-zinc-100 bg-zinc-50/50 hover:bg-white transition-all text-xs">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-zinc-800 truncate leading-snug">{p.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-650 bg-indigo-50 px-1 rounded">
                                    {p.store}
                                  </span>
                                  {p.category && (
                                    <span className="text-[8.5px] text-zinc-400 truncate">{p.category}</span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-black text-indigo-800 text-xs font-mono block">
                                  ${p.price?.toLocaleString()}
                                </span>
                                <span className={`text-[8.5px] font-semibold leading-tight px-1 rounded ${(p.stock || 0) > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-505 bg-zinc-100'}`}>
                                  Stock: {p.stock || 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>
              </div>
            )}

            {/* PANEL B: STORE-SPECIFIC BROWSER */}
            {activeRadarMode === 'store-specific' && (
              <Card className="border border-zinc-200 shadow-md bg-white">
                <CardHeader className="bg-zinc-50 border-b border-zinc-150 py-3">
                  <div className="flex flex-col sm:flex-row items-add sm:items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {activeSelectedStoreObj?.logoUrl ? (
                        <img 
                          src={activeSelectedStoreObj.logoUrl} 
                          alt={activeSelectedStoreObj.name} 
                          className="w-10 h-10 rounded-full border border-zinc-200 object-cover shadow-sm bg-white"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                          {activeSelectedStoreObj?.name ? activeSelectedStoreObj.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-sm font-bold text-zinc-900">{activeSelectedStoreObj?.name || 'Selecciona una Tienda'}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[340px] text-zinc-400" title={activeSelectedStoreObj?.address}>
                          {activeSelectedStoreObj?.address || 'Establecimiento del Catálogo Colectivo'}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="text-xs font-bold border-indigo-200 text-indigo-700 bg-indigo-50 shrink-0 self-stretch sm:self-auto text-center justify-center">
                      {activeSelectedStoreProducts.length} Productos Registrados
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {activeSelectedStoreProducts.length === 0 ? (
                    <div className="text-center py-16 text-zinc-400">
                      <Store className="size-12 mx-auto text-zinc-300 mb-3" />
                      <p className="font-bold text-zinc-650 text-sm">Este local no tiene víveres en el catálogo colectivo</p>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-2">
                        Puedes registrar y asignarle productos a "<strong>{activeSelectedStoreObj?.name || 'esta tienda'}</strong>" desde la pestaña de **Catálogo** para consultarlos en esta pantalla.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {activeSelectedStoreProducts.map((p) => {
                        const hasStock = p.stock && p.stock > 0;
                        return (
                          <div 
                            key={p.id} 
                            className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-between hover:bg-white hover:border-indigo-400 hover:shadow-md transition-all space-y-3"
                          >
                            <div className="space-y-1">
                              <Badge className="bg-zinc-200 text-zinc-700 text-[8px] uppercase tracking-wider font-extrabold border-none hover:bg-zinc-200">
                                {p.category || 'General'}
                              </Badge>
                              <p className="font-extrabold text-xs text-zinc-800 leading-snug line-clamp-2">{p.name}</p>
                              {p.subcategory && (
                                <p className="text-[10px] text-zinc-400 font-medium truncate">{p.subcategory}</p>
                              )}
                            </div>

                            <div className="border-t border-zinc-100 pt-3 flex items-center justify-between mt-auto">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-400 font-bold block leading-none uppercase">Precio</span>
                                <span className="text-sm font-black text-indigo-750 font-mono">${p.price?.toLocaleString()}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-zinc-400 font-bold block leading-none uppercase">Stock Cero</span>
                                <Badge className={`mt-1 font-bold text-[10px] font-mono border-none ${
                                  hasStock 
                                    ? 'bg-emerald-50 text-emerald-800' 
                                    : 'bg-zinc-150 text-zinc-500 hover:bg-zinc-150'
                                }`}>
                                  {p.stock || 0} un
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      )}
      {isNewListOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-sm border-none shadow-2xl bg-white relative">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700"
              onClick={() => setIsNewListOpen(false)}
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-zinc-900">Crear Nueva Lista de Mercado</CardTitle>
              <CardDescription className="text-xs">
                Asigna un nombre para agrupar los víveres que vas a reponer.
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleCreateList}>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="list-name">Nombre de la lista</Label>
                  <Input 
                    id="list-name"
                    placeholder="Ej. Súper Quincenal, Verdulería de la Esquina..."
                    value={newListForm.name}
                    onChange={e => setNewListForm({ name: e.target.value })}
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="py-4 bg-zinc-50 border-t flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewListOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-zinc-900 hover:bg-zinc-850 text-white"
                >
                  Crear Lista
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL B: FINALIZE / DESPACHAR SHOPPING LIST */}
      {isFinalizeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-sm border-none shadow-2xl bg-white relative">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-zinc-100 text-zinc-400"
              onClick={() => setIsFinalizeOpen(false)}
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-zinc-900">Finalizar Compra y Cuadrar Cuentas</CardTitle>
              <CardDescription className="text-xs">
                Esta acción abastecerá automáticamente el stock de tu inventario y reseteará los productos consumidos al 100%.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleExecuteFinalize}>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-zinc-50/70 text-xs">
                  <ShoppingCart className="size-4.5 text-violet-600 shrink-0" />
                  <div>
                    <span className="block font-bold">Importe total a pagar:</span>
                    <span className="text-sm font-black text-rose-600 font-mono">${activeListCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 p-1 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={finalizeForm.registerTransaction}
                      onChange={e => setFinalizeForm({ ...finalizeForm, registerTransaction: e.target.checked })}
                      className="size-4 rounded text-emerald-600 border-zinc-100 focus:ring-emerald-500 cursor-pointer"
                    />
                    Deducir gasto de mis Cuentas Financieras
                  </label>
                </div>

                {finalizeForm.registerTransaction && (
                  <div className="space-y-1">
                    <Label htmlFor="finalize-acc">Deducir de la cuenta:</Label>
                    <Select 
                      value={finalizeForm.accountId} 
                      onValueChange={val => setFinalizeForm({ ...finalizeForm, accountId: val })}
                    >
                      <SelectTrigger id="finalize-acc">
                        <SelectValue placeholder="Seleccionar billetera" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            <span>{acc.name} (Saldo: ${acc.balance.toLocaleString()})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-150 flex gap-2 items-start text-[11px] text-emerald-850 leading-normal">
                  <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Efecto en inventario:</strong> Los productos comprados se sumarán al stock físico nacional y su marcador de consumo regresará triunfante al <strong>100%</strong>.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="py-4 bg-zinc-50 border-t flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsFinalizeOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Confirmar y Surtir
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
