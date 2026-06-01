import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseCategory, PurchaseProduct, PurchaseStore } from '@/src/types';
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
  Package, 
  Search, 
  Plus, 
  Minus, 
  DollarSign, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  MapPin, 
  Tag, 
  TrendingDown, 
  TrendingUp, 
  X, 
  Check, 
  Filter, 
  ArrowUpDown,
  Archive
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export function InventoryView() {
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [categories, setCategories] = useState<PurchaseCategory[]>([]);
  const [stores, setStores] = useState<PurchaseStore[]>([]);
  
  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Create Product Dialog State for "Registrar Inventario Actual"
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    categoryId: '',
    subcategory: '',
    defaultPrice: '',
    stock: '1',
    minStock: '2',
    lastStore: ''
  });
  const [newStoreCustom, setNewStoreCustom] = useState('');

  // Edit Product Modal State
  const [editingProd, setEditingProd] = useState<PurchaseProduct | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    categoryId: '',
    subcategory: '',
    defaultPrice: '',
    stock: '',
    minStock: '',
    lastStore: ''
  });
  const [editStoreCustom, setEditStoreCustom] = useState('');

  // Load subscriptions to Collections
  useEffect(() => {
    const unsubProducts = dbService.subscribeToCollection('purchase_products', setProducts);
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
    const unsubStores = dbService.subscribeToCollection('purchase_stores', setStores);

    return () => {
      unsubProducts();
      unsubCategories();
      unsubStores();
    };
  }, []);

  // Listen to Global header button context triggers for adding inventory objects
  useEffect(() => {
    const handleOpenCreateObj = () => {
      setIsCreateOpen(true);
      setNewForm({
        name: '',
        categoryId: '',
        subcategory: '',
        defaultPrice: '',
        stock: '1',
        minStock: '2',
        lastStore: ''
      });
      setNewStoreCustom('');
    };

    window.addEventListener('open-new-inventory-dialog', handleOpenCreateObj);
    return () => {
      window.removeEventListener('open-new-inventory-dialog', handleOpenCreateObj);
    };
  }, []);

  // Calculate high-level KPIs metrics
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalItems = products.length;
    let totalUnits = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = p.stock || 0;
      const price = p.defaultPrice || 0;
      totalValue += stock * price;
      totalUnits += stock;
      if (stock <= (p.minStock ?? 2)) {
        lowStockCount++;
      }
    });

    return { totalValue, totalItems, totalUnits, lowStockCount };
  }, [products]);

  // Subtotals per category calculation
  const categorySubtotals = useMemo(() => {
    const subtotals: Record<string, { name: string; value: number; units: number; count: number }> = {};
    
    // Seed and initialize existing categories
    categories.forEach(cat => {
      subtotals[cat.id] = { name: cat.name, value: 0, units: 0, count: 0 };
    });
    
    // Fallback/Unknown category structure
    const fallbackId = 'unknown';
    subtotals[fallbackId] = { name: 'Sin categorizar', value: 0, units: 0, count: 0 };

    products.forEach(prod => {
      const catId = prod.categoryId || fallbackId;
      if (!subtotals[catId]) {
        subtotals[catId] = { name: 'Sin categorizar', value: 0, units: 0, count: 0 };
      }
      const stock = prod.stock || 0;
      const price = prod.defaultPrice || 0;
      subtotals[catId].value += stock * price;
      subtotals[catId].units += stock;
      subtotals[catId].count += 1;
    });

    // Filtering out category subtotals with zero products for cleaner layout
    return Object.entries(subtotals)
      .map(([id, info]) => ({ id, ...info }))
      .filter(item => item.count > 0 || item.id !== fallbackId);
  }, [products, categories]);

  // Discount a regular unit manually
  const handleModifyStock = async (product: PurchaseProduct, delta: number) => {
    const currentStock = product.stock || 0;
    const newStock = Math.max(0, currentStock + delta);

    if (delta < 0 && currentStock === 0) {
      toast.error('No hay existencias disponibles para descontar');
      return;
    }

    try {
      await dbService.updateItem('purchase_products', product.id, {
        stock: newStock,
        updatedAt: new Date().toISOString()
      });

      if (delta < 0) {
        const valueReduced = product.defaultPrice * Math.abs(delta);
        toast.info(
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-zinc-900">Inventario descontado</span>
            <span className="text-xs">
              Se restaron <strong>{Math.abs(delta)} ud.</strong> de <em>{product.name}</em>.
            </span>
            <span className="text-xs text-rose-650 font-semibold">
              Valor de inventario descontado: -${valueReduced.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>,
          { duration: 4000 }
        );
      } else {
        toast.success(`Se agregaron ${delta} unidades a "${product.name}"`);
      }
    } catch (e) {
      toast.error('Ocurrió un error al actualizar el stock');
    }
  };

  // Open Edit Dialog Product Modal
  const handleOpenEdit = (product: PurchaseProduct) => {
    setEditingProd(product);
    setEditForm({
      name: product.name,
      categoryId: product.categoryId || '',
      subcategory: product.subcategory || '',
      defaultPrice: String(product.defaultPrice || ''),
      stock: String(product.stock || 0),
      minStock: String(product.minStock ?? 2),
      lastStore: product.lastStore || ''
    });
    setEditStoreCustom('');
  };

  // Save changes from Edit Modall
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProd) return;

    if (!editForm.name.trim()) {
      toast.error('Especifica un nombre para el producto');
      return;
    }

    const resolvedStore = editForm.lastStore === 'custom-store'
      ? editStoreCustom.trim()
      : (editForm.lastStore.trim() || 'Desconocido');

    try {
      await dbService.updateItem('purchase_products', editingProd.id, {
        name: editForm.name.trim(),
        categoryId: editForm.categoryId,
        subcategory: editForm.subcategory,
        defaultPrice: parseFloat(editForm.defaultPrice) || 0,
        stock: parseInt(editForm.stock) || 0,
        minStock: parseInt(editForm.minStock) || 0,
        lastStore: resolvedStore,
        updatedAt: new Date().toISOString()
      });

      toast.success('Producto e inventario actualizados con éxito');
      setEditingProd(null);
    } catch (err) {
      toast.error('Error al guardar los cambios en el producto');
    }
  };

  // Delete product with confirmation
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar definitivamente "${name}" del inventario?`)) return;
    try {
      await dbService.deleteItem('purchase_products', id);
      toast.success('Producto removido del catálogo');
    } catch (e) {
      toast.error('Error al eliminar producto');
    }
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        // Search term match
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              p.lastStore.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Category match
        const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;

        // Stock filter match
        let matchesStock = true;
        const stockVal = p.stock || 0;
        const limitVal = p.minStock ?? 2;
        if (stockFilter === 'low') {
          matchesStock = stockVal <= limitVal && stockVal > 0;
        } else if (stockFilter === 'out') {
          matchesStock = stockVal === 0;
        } else if (stockFilter === 'ok') {
          matchesStock = stockVal > limitVal;
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        let compareA: any = a.name.toLowerCase();
        let compareB: any = b.name.toLowerCase();

        if (sortBy === 'value') {
          compareA = (a.stock || 0) * (a.defaultPrice || 0);
          compareB = (b.stock || 0) * (b.defaultPrice || 0);
        } else if (sortBy === 'stock') {
          compareA = a.stock || 0;
          compareB = b.stock || 0;
        }

        if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, searchTerm, selectedCategory, stockFilter, sortBy, sortOrder]);

  const toggleSort = (field: 'name' | 'value' | 'stock') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // default to desc for numeric, asc for alpha
    }
  };

  // Get matching category list subcategories
  const selectedCatSubcategories = useMemo(() => {
    if (!editForm.categoryId) return [];
    const found = categories.find(c => c.id === editForm.categoryId);
    return found ? found.subcategories : [];
  }, [editForm.categoryId, categories]);

  // Get matching category list subcategories for new item form
  const newCatSubcategories = useMemo(() => {
    if (!newForm.categoryId) return [];
    const found = categories.find(c => c.id === newForm.categoryId);
    return found ? found.subcategories : [];
  }, [newForm.categoryId, categories]);

  // Create Product logic for "Registrar Inventario Actual"
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim() || !newForm.categoryId) {
      toast.error('Especifica un nombre y una categoría para el producto');
      return;
    }

    const resolvedStore = newForm.lastStore === 'custom-store'
      ? newStoreCustom.trim()
      : (newForm.lastStore.trim() || 'Desconocido');

    try {
      const payload = {
        name: newForm.name.trim(),
        categoryId: newForm.categoryId,
        subcategory: newForm.subcategory || 'General',
        isRegular: true,
        defaultPrice: parseFloat(newForm.defaultPrice) || 0,
        lastStore: resolvedStore,
        stock: parseInt(newForm.stock) || 0,
        minStock: parseInt(newForm.minStock) || 0,
        updatedAt: new Date().toISOString()
      };

      await dbService.addItem('purchase_products', payload);
      toast.success(`Producto "${payload.name}" registrado en inventario con stock inicial de ${payload.stock} unidades.`);
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el producto en el inventario');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 4 KPI Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-600" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Valor Inventario</span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                <DollarSign className="size-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                ${stats.totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-zinc-400 text-[10px] mt-1 font-medium">Equivalente financiero de existencias</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Unidades Existentes</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Package className="size-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                {stats.totalUnits.toLocaleString('es-ES')} <span className="text-xs text-zinc-400 font-bold uppercase">Uds</span>
              </h3>
              <p className="text-zinc-400 text-[10px] mt-1 font-medium">Suma física total en almacén</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Artículos en Catálogo</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Archive className="size-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                {stats.totalItems.toLocaleString('es-ES')} <span className="text-xs text-zinc-400 font-bold uppercase">Tipos</span>
              </h3>
              <p className="text-zinc-400 text-[10px] mt-1 font-medium">Gama total de productos registrados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Límite de Stock</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <AlertTriangle className="size-5 animate-pulse" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className={`text-2xl font-black tracking-tight ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                {stats.lowStockCount} <span className="text-xs text-zinc-400 font-bold uppercase">Por reponer</span>
              </h3>
              <p className="text-zinc-400 text-[10px] mt-1 font-medium">Bajo stock / Agotados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Subtotals per category */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md bg-white">
            <CardHeader className="pb-3 border-b border-zinc-100">
              <CardTitle className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <Tag className="size-4 text-violet-500" />
                Subtotales de Inventario
              </CardTitle>
              <CardDescription className="text-[11px] text-zinc-500">
                Distribución monetaria y conteo de piezas por categoría
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {categorySubtotals.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 italic">
                  No hay productos registrados en el inventario para calcular subtotales.
                </div>
              ) : (
                categorySubtotals.map(cat => {
                  const percentage = stats.totalValue > 0 ? (cat.value / stats.totalValue) * 100 : 0;
                  return (
                    <div key={cat.id} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-700 truncate max-w-[150px]" title={cat.name}>
                          {cat.name}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-zinc-900 block font-mono">
                            ${cat.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium block">
                            {cat.units} uds • {cat.count} art • {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-1.5 bg-zinc-50 rounded-full" 
                        indicatorClassName="bg-violet-600 group-hover:bg-violet-700 transition-colors"
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Interactive Search, Filters & Product Grid */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md bg-white">
            <CardHeader className="pb-4 border-b border-zinc-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-zinc-900">Control de Existencias en Almacén</CardTitle>
                  <CardDescription className="text-xs">
                    Busca productos, edítalos y descuenta existencias consumidas manualmente. El dinero se restará de inmediato.
                  </CardDescription>
                </div>
              </div>

              {/* Advanced search and filters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                <div className="relative md:col-span-5">
                  <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
                  <Input 
                    placeholder="Buscar producto, subcategoría o tienda..." 
                    className="pl-9 h-9.5 text-xs bg-zinc-50 border-zinc-200"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-zinc-200"
                    >
                      <X className="size-3 text-zinc-400" />
                    </button>
                  )}
                </div>

                <div className="md:col-span-3">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-9.5 text-xs bg-zinc-50 border-zinc-200">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ver Categorías</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Select value={stockFilter} onValueChange={(val: any) => setStockFilter(val)}>
                    <SelectTrigger className="h-9.5 text-xs bg-zinc-50 border-zinc-200">
                      <SelectValue placeholder="Estado Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ver Stock</SelectItem>
                      <SelectItem value="ok">Con Stock</SelectItem>
                      <SelectItem value="low">Límite Crítico</SelectItem>
                      <SelectItem value="out">Sin Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="h-9.5 text-xs bg-zinc-50 border-zinc-200" title="Ordenar por">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Por Nombre</SelectItem>
                      <SelectItem value="value">Por Valor</SelectItem>
                      <SelectItem value="stock">Por Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                  <Filter className="size-10 text-zinc-300" />
                  <p className="text-zinc-500 font-medium text-sm">No encontramos ningún producto</p>
                  <p className="text-zinc-400 text-xs text-pretty max-w-[280px]">
                    Cambia los términos de búsqueda o filtros. Recuerda que puedes registrar nuevos productos en la sección de Ajustes / Compras.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 max-h-[580px] overflow-y-auto">
                  {filteredProducts.map(prod => {
                    const price = prod.defaultPrice || 0;
                    const stock = prod.stock || 0;
                    const totalMoneyValue = stock * price;
                    const threshold = prod.minStock ?? 2;
                    const isLowStock = stock <= threshold && stock > 0;
                    const isOutOfStock = stock === 0;

                    // Match store
                    const matchedStore = stores.find(s => s.name.toLowerCase() === prod.lastStore.toLowerCase());
                    const matchedCategory = categories.find(c => c.id === prod.categoryId);

                    return (
                      <div key={prod.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors group">
                        
                        {/* Title, Category & Store Info metadata */}
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-zinc-900 leading-tight block">{prod.name}</h4>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 bg-zinc-50 font-normal border-zinc-200 text-zinc-500">
                              {prod.subcategory}
                            </Badge>
                            {isOutOfStock && (
                              <span className="inline-flex size-2 rounded-full bg-rose-500 animate-ping" />
                            )}
                          </div>

                          <div className="flex items-center gap-3.5 text-xs text-zinc-500 font-sans flex-wrap">
                            <span className="flex items-center gap-1 shrink-0">
                              <Tag className="size-3.5 text-zinc-400" />
                              {matchedCategory?.name || 'General'}
                            </span>
                            <span className="flex items-center gap-1.5 text-zinc-500 shrink-0 truncate max-w-[150px]">
                              {matchedStore?.logoUrl ? (
                                <img src={matchedStore.logoUrl} alt={prod.lastStore} className="size-4 object-contain rounded" referrerPolicy="no-referrer" />
                              ) : (
                                <MapPin className="size-3.5 text-zinc-400" />
                              )}
                              {prod.lastStore}
                            </span>
                          </div>
                        </div>

                        {/* Inventory Value in Money Display */}
                        <div className="flex items-center gap-5 md:gap-7 justify-between md:justify-end">
                          <div className="text-left md:text-right space-y-0.5 min-w-[100px]">
                            <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider block">Valor de existencias</span>
                            <strong className="text-sm font-black text-violet-600 block font-mono leading-none">
                              ${totalMoneyValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                            <span className="text-[10px] text-zinc-400 font-medium block">
                              Unitario: ${price.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Quick Stock Controls (+ / -) */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 p-0.5 rounded-lg select-none">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-7 rounded-md text-zinc-500 hover:text-rose-600"
                                onClick={() => handleModifyStock(prod, -1)}
                                disabled={stock <= 0}
                                title="Descontar 1 unidad"
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <span className="w-10 text-center text-xs font-black font-mono text-zinc-900">
                                {stock}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-7 rounded-md text-zinc-500 hover:text-emerald-600"
                                onClick={() => handleModifyStock(prod, 1)}
                                title="Añadir 1 unidad"
                              >
                                <Plus className="size-3.5" />
                              </Button>
                            </div>

                            {/* Badge/Warning alerts of stock */}
                            {isOutOfStock ? (
                              <span className="text-[9px] px-1 bg-rose-50 text-rose-700 font-bold uppercase tracking-wider rounded border border-rose-100">
                                AGOTADO
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[9px] px-1 bg-amber-50 text-amber-700 font-bold uppercase tracking-wider rounded border border-amber-100 animate-pulse">
                                REPOSICIÓN ({threshold})
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 text-zinc-400 font-bold uppercase tracking-wider">
                                SUFICIENTE
                              </span>
                            )}
                          </div>

                          {/* Edit / Delete actions icons */}
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-8 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-full"
                              onClick={() => handleOpenEdit(prod)}
                              title="Editar producto o cantidades"
                            >
                              <Edit3 className="size-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-8 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-full animate-hover"
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              title="Eliminar de catálogo"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Editing Dialog Backdrop Modal */}
      {editingProd && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md border-none shadow-2xl bg-white animate-fade-in relative">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700"
              onClick={() => setEditingProd(null)}
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-zinc-900">Editar Producto e Inventario</CardTitle>
              <CardDescription className="text-xs">
                Estás modificando los parámetros base del producto en el catálogo.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveEditProduct}>
              <CardContent className="space-y-4 max-h-[460px] overflow-y-auto">
                <div className="space-y-1">
                  <Label htmlFor="editName">Nombre del Producto</Label>
                  <Input 
                    id="editName"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="editCategory">Categoría</Label>
                    <Select 
                      value={editForm.categoryId} 
                      onValueChange={(val) => setEditForm({ ...editForm, categoryId: val, subcategory: '' })}
                    >
                      <SelectTrigger id="editCategory" className="bg-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="editSubcat">Subcategoría</Label>
                    <Select 
                      value={editForm.subcategory} 
                      onValueChange={(val) => setEditForm({...editForm, subcategory: val})}
                    >
                      <SelectTrigger id="editSubcat" className="bg-white" disabled={!editForm.categoryId}>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCatSubcategories.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="editPrice">Precio Unitario ($)</Label>
                    <Input 
                      id="editPrice"
                      type="number"
                      step="0.01"
                      value={editForm.defaultPrice}
                      onChange={e => setEditForm({ ...editForm, defaultPrice: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="editStock">Cantidad en Stock (Física)</Label>
                    <Input 
                      id="editStock"
                      type="number"
                      value={editForm.stock}
                      onChange={e => setEditForm({...editForm, stock: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="editMin">Límite Crítico (Alerta)</Label>
                    <Input 
                      id="editMin"
                      type="number"
                      value={editForm.minStock}
                      onChange={e => setEditForm({ ...editForm, minStock: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="editStore">Tienda / Establecimiento</Label>
                    <Select 
                      value={editForm.lastStore} 
                      onValueChange={(val) => setEditForm({...editForm, lastStore: val})}
                    >
                      <SelectTrigger id="editStore" className="bg-white">
                        <SelectValue placeholder="Establecimiento" />
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
                </div>

                {editForm.lastStore === 'custom-store' && (
                  <div className="space-y-1">
                    <Label htmlFor="editStoreCustom">Nombre de la nueva tienda</Label>
                    <Input 
                      id="editStoreCustom"
                      placeholder="Ej. Mercado Central, Feria" 
                      value={editStoreCustom}
                      onChange={e => setEditStoreCustom(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>

              <CardFooter className="py-4 bg-zinc-50 border-t flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingProd(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  Guardar Cambios
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Complete registrar inventario actual dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md bg-white p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <form onSubmit={handleCreateProduct}>
            <DialogHeader className="p-6 pb-4 border-b border-zinc-100 bg-zinc-50/50">
              <DialogTitle className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-2">
                <Package className="size-5 text-zinc-800" />
                Registrar Inventario Actual
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 font-sans mt-1">
                Registra tus artículos y existencias actuales para configurar lo que ya tienes disponible en tu almacén.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-4">
              {/* Product name */}
              <div className="space-y-1.5">
                <Label htmlFor="newName" className="text-zinc-700 font-bold text-xs">Nombre de Artículo / Producto</Label>
                <Input 
                  id="newName"
                  required
                  placeholder="Ej. Detergente de Ropa 3L, Arroz Diana 1kg"
                  value={newForm.name}
                  onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  className="bg-zinc-50 border-zinc-200 h-9.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <Label htmlFor="newCategory" className="text-zinc-700 font-bold text-xs">Categoría</Label>
                  <Select 
                    value={newForm.categoryId} 
                    onValueChange={(val) => setNewForm({ ...newForm, categoryId: val, subcategory: '' })}
                  >
                    <SelectTrigger id="newCategory" className="bg-zinc-50 border-zinc-200 h-9.5 text-xs">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategory */}
                <div className="space-y-1.5">
                  <Label htmlFor="newSubcat" className="text-zinc-700 font-bold text-xs">Subcategoría</Label>
                  <Select 
                    value={newForm.subcategory} 
                    onValueChange={(val) => setNewForm({ ...newForm, subcategory: val })}
                  >
                    <SelectTrigger id="newSubcat" className="bg-zinc-50 border-zinc-200 h-9.5 text-xs" disabled={!newForm.categoryId}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {newCatSubcategories.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Estimated Unit Price */}
                <div className="space-y-1.5">
                  <Label htmlFor="newPrice" className="text-zinc-700 font-bold text-xs">Precio Unitario Estimado ($)</Label>
                  <Input 
                    id="newPrice"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 1200"
                    value={newForm.defaultPrice}
                    onChange={e => setNewForm({ ...newForm, defaultPrice: e.target.value })}
                    className="bg-zinc-50 border-zinc-200 h-9.5 text-xs"
                  />
                </div>

                {/* Initial Stock */}
                <div className="space-y-1.5">
                  <Label htmlFor="newStock" className="text-zinc-700 font-bold text-xs">Unidades Existentes</Label>
                  <Input 
                    id="newStock"
                    type="number"
                    min="0"
                    value={newForm.stock}
                    onChange={e => setNewForm({ ...newForm, stock: e.target.value })}
                    className="bg-zinc-50 border-zinc-200 h-9.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* ... */}
                <div className="space-y-1.5">
                  <Label htmlFor="newMin" className="text-zinc-700 font-bold text-xs">Límite Crítico (Alerta)</Label>
                  <Input 
                    id="newMin"
                    type="number"
                    min="0"
                    value={newForm.minStock}
                    onChange={e => setNewForm({ ...newForm, minStock: e.target.value })}
                    className="bg-zinc-50 border-zinc-200 h-9.5 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newStore" className="text-zinc-700 font-bold text-xs">Tienda / Lugar de Compra</Label>
                  <Select 
                    value={newForm.lastStore} 
                    onValueChange={(val) => setNewForm({ ...newForm, lastStore: val })}
                  >
                    <SelectTrigger id="newStore" className="bg-zinc-50 border-zinc-200 h-9.5 text-xs">
                      <SelectValue placeholder="Seleccionar" />
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
                      <SelectItem value="custom-store">Escribir otra tienda...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newForm.lastStore === 'custom-store' && (
                <div className="space-y-1.5 animate-fade-in">
                  <Label htmlFor="newStoreCustom" className="text-zinc-700 font-bold text-xs">Escribe el nombre de la tienda</Label>
                  <Input 
                    id="newStoreCustom"
                    required
                    placeholder="Ej. Éxito, Carulla, Mercado Local..." 
                    value={newStoreCustom}
                    onChange={e => setNewStoreCustom(e.target.value)}
                    className="bg-zinc-50 border-zinc-200 h-9.5 text-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="p-6 pt-4 border-t border-zinc-100 bg-zinc-50/50 flex flex-row items-center justify-end gap-2.5">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="font-bold text-xs text-zinc-700 h-9"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-9"
              >
                Registrar Producto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
