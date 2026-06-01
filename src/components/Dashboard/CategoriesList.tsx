import React, { useState } from 'react';
import { Category } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Tag, Trash2, Edit2, TrendingUp, TrendingDown, ShoppingBag, X,
  Building2, Receipt, Wifi, Play, CreditCard, Heart, BookOpen, 
  Utensils, ShoppingCart, Car, HelpCircle, Banknote, PiggyBank,
  Film, Home, Smartphone, Wrench, Gift, Flame, Trophy, MapPin, Sparkles
} from 'lucide-react';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';

interface CategoriesListProps {
  categories: Category[];
}

const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Zinc', value: '#18181b' },
];

export const AVAILABLE_ICONS = [
  { id: 'building-2', label: 'Arriendo', icon: Building2 },
  { id: 'receipt', label: 'Servicios', icon: Receipt },
  { id: 'wifi', label: 'Internet', icon: Wifi },
  { id: 'play', label: 'Suscripciones', icon: Play },
  { id: 'credit-card', label: 'Tarjetas', icon: CreditCard },
  { id: 'heart', label: 'Salud', icon: Heart },
  { id: 'book-open', label: 'Educación', icon: BookOpen },
  { id: 'utensils', label: 'Comida', icon: Utensils },
  { id: 'shopping-cart', label: 'Mercado', icon: ShoppingCart },
  { id: 'car', label: 'Transporte', icon: Car },
  { id: 'banknote', label: 'Sueldo', icon: Banknote },
  { id: 'piggy-bank', label: 'Ahorro', icon: PiggyBank },
  { id: 'home', label: 'Hogar', icon: Home },
  { id: 'smartphone', label: 'Celular', icon: Smartphone },
  { id: 'film', label: 'Cine/Ocio', icon: Film },
  { id: 'wrench', label: 'Reparaciones', icon: Wrench },
  { id: 'gift', label: 'Regalos', icon: Gift },
  { id: 'flame', label: 'Servicios Gas', icon: Flame },
  { id: 'trophy', label: 'Premios', icon: Trophy },
  { id: 'map-pin', label: 'Viajes', icon: MapPin },
  { id: 'sparkles', label: 'Estética', icon: Sparkles },
  { id: 'tag', label: 'General', icon: Tag },
  { id: 'help-circle', label: 'Otros', icon: HelpCircle },
];

export const getCategoryIconComponent = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'building-2':
    case 'building':
    case 'arriendo':
      return Building2;
    case 'receipt':
    case 'servicios':
      return Receipt;
    case 'wifi':
    case 'internet':
      return Wifi;
    case 'play':
    case 'suscripciones':
      return Play;
    case 'credit-card':
    case 'tarjetas':
      return CreditCard;
    case 'heart':
    case 'salud':
      return Heart;
    case 'book-open':
    case 'education':
    case 'educación':
      return BookOpen;
    case 'utensils':
    case 'comida':
      return Utensils;
    case 'shopping-cart':
    case 'mercado':
      return ShoppingCart;
    case 'car':
    case 'transporte':
      return Car;
    case 'banknote':
    case 'sueldo':
      return Banknote;
    case 'piggy-bank':
    case 'ahorro':
      return PiggyBank;
    case 'home':
    case 'hogar':
      return Home;
    case 'smartphone':
    case 'celular':
      return Smartphone;
    case 'film':
    case 'cine/ocio':
    case 'ocio':
      return Film;
    case 'wrench':
    case 'reparaciones':
      return Wrench;
    case 'gift':
    case 'regalos':
      return Gift;
    case 'flame': return Flame;
    case 'trophy': return Trophy;
    case 'map-pin': return MapPin;
    case 'sparkles': return Sparkles;
    case 'tag': return Tag;
    default: return HelpCircle;
  }
};

export function CategoriesList({ categories }: CategoriesListProps) {
  const [adding, setAdding] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ 
    name: '', 
    type: 'expense' as 'income' | 'expense' | 'purchase', 
    color: '#3b82f6',
    icon: 'tag',
    isAutoDebit: false,
    isNoCost: false,
    isEventual: false,
    estimatedLimit: '',
    paymentType: 'fixed' as 'fixed' | 'variable',
    fixedAmount: '',
    periodicity: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannually' | 'annually' | 'eventual'
  });

  // Local state to track additions input text for each specific Category ID
  const [newSubcatInputs, setNewSubcatInputs] = useState<Record<string, string>>({});

  const handleAdd = async () => {
    if (!newCat.name) return;
    try {
      await dbService.addItem('categories', {
        ...newCat,
        estimatedLimit: parseFloat(newCat.estimatedLimit) || 0,
        fixedAmount: newCat.paymentType === 'fixed' ? (parseFloat(newCat.fixedAmount) || 0) : 0,
        subcategories: [], // Initialize empty
      });
      setAdding(false);
      setNewCat({ 
        name: '', 
        type: 'expense', 
        color: '#3b82f6',
        icon: 'tag',
        isAutoDebit: false,
        isNoCost: false,
        isEventual: false,
        estimatedLimit: '',
        paymentType: 'fixed',
        fixedAmount: '',
        periodicity: 'monthly'
      });
      toast.success('Categoría creada');
    } catch (e) {
      toast.error('Error al crear categoría');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dbService.deleteItem('categories', id);
      toast.success('Categoría eliminada');
    } catch (e) {
      toast.error('No se pudo eliminar');
    }
  };

  const handleAddSubcategory = async (category: Category) => {
    const text = newSubcatInputs[category.id]?.trim();
    if (!text) return;

    const currentSubcats = category.subcategories || [];
    if (currentSubcats.includes(text)) {
      toast.warning('Esta subcategoría ya existe en la categoría.');
      return;
    }

    try {
      const updated = [...currentSubcats, text];
      await dbService.updateItem('categories', category.id, {
        subcategories: updated
      });
      setNewSubcatInputs({
        ...newSubcatInputs,
        [category.id]: ''
      });
      toast.success(`Subcategoría "${text}" registrada`);
    } catch (e) {
      console.error(e);
      toast.error('Ocurrió un error al registrar la subcategoría.');
    }
  };

  const handleDeleteSubcategory = async (category: Category, subName: string) => {
    try {
      const updated = (category.subcategories || []).filter(s => s !== subName);
      await dbService.updateItem('categories', category.id, {
        subcategories: updated
      });
      toast.success(`Subcategoría "${subName}" eliminada`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo remover la subcategoría.');
    }
  };

  const [activeTab, setActiveTab] = useState<'activos' | 'pasivos'>('activos');
  const [pasivosSubTab, setPasivosSubTab] = useState<'expense' | 'purchase'>('expense');

  const assetsCategories = categories.filter(c => c.type === 'income');
  const liabilitiesCategories = categories.filter(c => c.type === 'expense' || c.type === 'purchase');
  const activeCategoriesList = activeTab === 'activos' 
    ? assetsCategories 
    : liabilitiesCategories.filter(c => {
        if (pasivosSubTab === 'expense') return c.type === 'expense';
        if (pasivosSubTab === 'purchase') return c.type === 'purchase';
        return true;
      });

  const expensesCount = liabilitiesCategories.filter(c => c.type === 'expense').length;
  const purchasesCount = liabilitiesCategories.filter(c => c.type === 'purchase').length;

  // Auto set new Category default type depending on active tab when opening
  const handleToggleAdding = () => {
    if (editingCatId) {
      handleCancelEdit();
      return;
    }
    if (!adding) {
      setNewCat(prev => ({
        ...prev,
        type: activeTab === 'activos' 
          ? 'income' 
          : (pasivosSubTab === 'purchase' ? 'purchase' : 'expense'),
        icon: activeTab === 'activos' ? 'banknote' : 'tag'
      }));
    }
    setAdding(!adding);
  };

  const handleStartEdit = (category: Category) => {
    setEditingCatId(category.id);
    setAdding(false);
    setNewCat({
      name: category.name,
      type: category.type as 'income' | 'expense' | 'purchase',
      color: category.color || '#3b82f6',
      icon: category.icon || 'tag',
      isAutoDebit: category.isAutoDebit || false,
      isNoCost: category.isNoCost || false,
      isEventual: category.isEventual || false,
      estimatedLimit: category.estimatedLimit !== undefined ? String(category.estimatedLimit) : '',
      paymentType: category.paymentType || 'fixed',
      fixedAmount: category.fixedAmount !== undefined ? String(category.fixedAmount) : '',
      periodicity: category.periodicity || 'monthly'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setNewCat({ 
      name: '', 
      type: 'expense' as 'income' | 'expense' | 'purchase', 
      color: '#3b82f6',
      icon: 'tag',
      isAutoDebit: false,
      isNoCost: false,
      isEventual: false,
      estimatedLimit: '',
      paymentType: 'fixed',
      fixedAmount: '',
      periodicity: 'monthly'
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCatId || !newCat.name) return;
    try {
      await dbService.updateItem('categories', editingCatId, {
        ...newCat,
        estimatedLimit: parseFloat(newCat.estimatedLimit) || 0,
        fixedAmount: newCat.paymentType === 'fixed' ? (parseFloat(newCat.fixedAmount) || 0) : 0,
      });
      setEditingCatId(null);
      setNewCat({ 
        name: '', 
        type: 'expense', 
        color: '#3b82f6',
        icon: 'tag',
        isAutoDebit: false,
        isNoCost: false,
        isEventual: false,
        estimatedLimit: '',
        paymentType: 'fixed',
        fixedAmount: '',
        periodicity: 'monthly'
      });
      toast.success('Categoría actualizada con éxito');
    } catch (e) {
      toast.error('Error al actualizar la categoría');
    }
  };

  const getLabel = (type: string) => {
    if (type === 'income') return 'Ingreso';
    if (type === 'expense') return 'Pago';
    return 'Compra';
  };

  return (
    <div className="space-y-6">
      {/* Visual Header & Create Trigger Row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-950">Categorías de Operaciones</h3>
          <p className="text-xs text-zinc-500 font-medium">Estuctura tus ingresos y egresos asociando subcategorías detalladas a cada elemento.</p>
        </div>
        <Button 
          onClick={handleToggleAdding} 
          variant={(adding || editingCatId) ? "outline" : "default"} 
          className="shrink-0 font-bold"
        >
          {(adding || editingCatId) ? 'Cancelar' : <><Plus className="mr-1.5 size-4" /> Nueva Categoría</>}
        </Button>
      </div>

      {(adding || editingCatId) && (
        <Card className="border-zinc-900 border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-900">
              {editingCatId ? `Editar Categoría: ${newCat.name}` : 'Agregar Nueva Categoría'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input 
                placeholder="Ej. Comida, Transporte, Sueldo, Compras" 
                value={newCat.name}
                onChange={e => setNewCat({...newCat, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Tráfico</Label>
              <Select value={newCat.type} onValueChange={(v: any) => setNewCat({...newCat, type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Activo: Ingreso</SelectItem>
                  <SelectItem value="expense">Pasivo: Pago</SelectItem>
                  <SelectItem value="purchase">Pasivo: Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button 
                    key={c.value}
                    type="button"
                    className={`size-6 rounded-full border-2 transition-all ${newCat.color === c.value ? 'scale-125 border-zinc-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setNewCat({...newCat, color: c.value})}
                  />
                ))}
              </div>
            </div>

            <div className="col-span-1 md:col-span-3 space-y-1.5 border-t border-zinc-100 pt-3">
              <Label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Tag className="size-3.5" /> Icono de la Categoría
              </Label>
              <div className="grid grid-cols-4 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-11 gap-2 p-3 bg-zinc-50/85 rounded-xl border border-zinc-200 shadow-3xs max-h-[190px] overflow-y-auto">
                {AVAILABLE_ICONS.map(item => {
                  const IconComp = item.icon;
                  const isSelected = newCat.icon === item.id || (newCat.icon === 'tag' && item.id === 'tag');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNewCat({ ...newCat, icon: item.id })}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all group shrink-0 ${
                        isSelected
                          ? 'border-zinc-900 bg-white text-zinc-900 shadow-xs scale-102 font-extrabold ring-1 ring-zinc-950'
                          : 'border-zinc-200/50 bg-white/60 text-zinc-500 hover:border-zinc-300 hover:bg-white hover:text-zinc-800'
                      }`}
                    >
                      <IconComp className={`size-4 ${isSelected ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                      <span className="text-[9px] font-bold leading-none tracking-tight truncate max-w-full">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>


          </CardContent>
          <CardFooter className="justify-end gap-2">
            {editingCatId ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>Cancelar Edición</Button>
                <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
              </>
            ) : (
              <Button onClick={handleAdd}>Guardar</Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Tabs Selector for Activos / Pasivos */}
      <div className="flex flex-col space-y-4">
        {/* Navigation bar */}
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => {
              setActiveTab('activos');
              setAdding(false);
              setEditingCatId(null);
            }}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'activos'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <TrendingUp className="size-4" />
            <span>ACTIVOS (Ingresos)</span>
            <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
              activeTab === 'activos' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-400'
            }`}>
              {assetsCategories.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('pasivos');
              setAdding(false);
              setEditingCatId(null);
            }}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'pasivos'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <TrendingDown className="size-4" />
            <span>PASIVOS (Gastos y Compras)</span>
            <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
              activeTab === 'pasivos' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-400'
            }`}>
              {liabilitiesCategories.length}
            </span>
          </button>
        </div>

        {/* Dynamic subtabs inline if Pasivos is active */}
        {activeTab === 'pasivos' && (
          <div className="flex flex-wrap items-center gap-2 bg-zinc-100/80 p-1.5 rounded-xl border border-zinc-200 w-fit self-start animate-fade-in shadow-3xs">
            <button
              type="button"
              onClick={() => {
                setPasivosSubTab('expense');
                setAdding(false);
                setEditingCatId(null);
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                pasivosSubTab === 'expense'
                  ? 'bg-rose-50 border border-rose-200/80 text-rose-700 shadow-3xs'
                  : 'text-zinc-550 hover:bg-zinc-200/50 hover:text-rose-600'
              }`}
            >
              💸 Pagos ({expensesCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setPasivosSubTab('purchase');
                setAdding(false);
                setEditingCatId(null);
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                pasivosSubTab === 'purchase'
                  ? 'bg-amber-50 border border-amber-200/80 text-amber-700 shadow-3xs'
                  : 'text-zinc-550 hover:bg-zinc-200/50 hover:text-amber-600'
              }`}
            >
              🛍️ Compras y Canasta ({purchasesCount})
            </button>
          </div>
        )}

        {/* Informational description panel based on category group */}
        <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 text-xs">
          {activeTab === 'activos' ? (
            <div className="flex gap-2 items-start text-zinc-600">
              <TrendingUp className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-800">Categorías de Activos / Ingresos:</span> Representan los orígenes y flujos positivos de capital (por ejemplo, salarios, rentabilidades, rendimientos, etc.). Configura las subcategorías para registrar adecuadamente cada procedencia.
              </div>
            </div>
          ) : (
            <div className="flex gap-2 items-start text-zinc-600">
              <TrendingDown className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Categorías de Pasivos / Egresos:</span> Representan gastos planeados, deudas, o salidas de dinero (alimentación, transporte, suscripciones). Configura sus propiedades especiales y subcategorías para automatizar su comportamiento y visualizarlas en Pasivos.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeCategoriesList.map(category => (
          <Card key={category.id} className="relative group overflow-hidden border-zinc-200 flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: category.color }} />
            <CardContent className="p-4 flex flex-col justify-between flex-1 space-y-4">
              {/* Top Banner Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg shrink-0 flex items-center justify-center size-8" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                    {React.createElement(getCategoryIconComponent(category.icon || 'tag'), { className: "size-4" })}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-zinc-900 truncate">
                      {category.name}
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">{getLabel(category.type)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 size-7"
                    onClick={() => handleStartEdit(category)}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 size-7"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>



              {/* Subcategories Management Layer */}
              <div className="border-t border-zinc-100 pt-3 flex flex-col space-y-2">
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                  <Tag className="size-3 text-zinc-400" />
                  Subcategorías ({category.subcategories?.length || 0})
                </span>

                {/* Existing Subcategories tags list */}
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                  {category.subcategories && category.subcategories.length > 0 ? (
                    category.subcategories.map((sub, i) => (
                      <span 
                        key={i} 
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-700 border border-zinc-200/65"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubcategory(category, sub)}
                          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-450 hover:text-zinc-700"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-400 italic">Sin subcategorías registradas</span>
                  )}
                </div>

                {/* Create/Add a subcategory inline for this specific category card */}
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    placeholder="Nueva subcat..."
                    className="h-7 text-[10px] pl-2 border-zinc-200 rounded-md shadow-3xs"
                    value={newSubcatInputs[category.id] || ''}
                    onChange={(e) => setNewSubcatInputs({
                      ...newSubcatInputs,
                      [category.id]: e.target.value
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcategory(category);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="size-7 rounded-md shrink-0 bg-zinc-900 hover:bg-zinc-800 text-white"
                    onClick={() => handleAddSubcategory(category)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeCategoriesList.length === 0 && !adding && (
          <div className="col-span-full py-12 text-center text-zinc-400 text-xs font-medium">
            No tienes categorías registradas en esta sección. ¡Crea una nueva presionando el botón superior!
          </div>
        )}
      </div>
    </div>
  );
}
