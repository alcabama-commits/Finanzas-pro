import React, { useState, useEffect, useMemo } from 'react';
import { FixedAsset } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { 
  Building, 
  Car, 
  Tv, 
  Smartphone, 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Calendar, 
  MapPin, 
  Activity, 
  ShieldAlert, 
  Info,
  X,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

export function FixedAssetsView() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'real_estate' as 'real_estate' | 'vehicle' | 'appliance' | 'technology' | 'other',
    estimatedValue: '',
    purchaseDate: '',
    description: '',
    location: '',
    status: 'active' as 'active' | 'sold' | 'deprecated' | 'donated'
  });

  useEffect(() => {
    const unsub = dbService.subscribeToCollection('fixed_assets', setAssets);
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active');
    const totalValue = activeAssets.reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0);
    const count = activeAssets.length;
    
    // Group values by category
    const categoryValues = activeAssets.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + (Number(a.estimatedValue) || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalValue,
      count,
      categoryValues
    };
  }, [assets]);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      name: '',
      category: 'real_estate',
      estimatedValue: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      description: '',
      location: '',
      status: 'active'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (asset: FixedAsset) => {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      category: asset.category,
      estimatedValue: String(asset.estimatedValue),
      purchaseDate: asset.purchaseDate || '',
      description: asset.description || '',
      location: asset.location || '',
      status: asset.status
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.estimatedValue) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    const valueNum = parseFloat(form.estimatedValue);
    if (isNaN(valueNum) || valueNum < 0) {
      toast.error('El valor estimado debe ser un número válido');
      return;
    }

    const itemData = {
      name: form.name.trim(),
      category: form.category,
      estimatedValue: valueNum,
      purchaseDate: form.purchaseDate,
      description: form.description.trim(),
      location: form.location.trim(),
      status: form.status,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await dbService.updateItem('fixed_assets', editingId, itemData);
        toast.success(`Activo Fijo "${itemData.name}" actualizado`);
      } else {
        await dbService.addItem('fixed_assets', {
          ...itemData,
          createdAt: new Date().toISOString()
        });
        toast.success(`Activo Fijo "${itemData.name}" registrado correctamente`);
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el activo fijo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este activo de tus registros?')) return;
    try {
      await dbService.deleteItem('fixed_assets', id);
      toast.success('Activo eliminado del sistema');
    } catch (err) {
      toast.error('Error al eliminar el activo');
    }
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'real_estate':
        return { label: 'Bienes Raíces / Propiedades', icon: <Building className="size-4.5 text-blue-600" />, bg: 'bg-blue-50 border-blue-200 text-blue-700' };
      case 'vehicle':
        return { label: 'Vehículos / Transporte', icon: <Car className="size-4.5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
      case 'appliance':
        return { label: 'Electrodomésticos / Hogar', icon: <Tv className="size-4.5 text-amber-600" />, bg: 'bg-amber-50 border-amber-200 text-amber-700' };
      case 'technology':
        return { label: 'Tecnología / Equipos', icon: <Smartphone className="size-4.5 text-violet-600" />, bg: 'bg-violet-50 border-violet-200 text-violet-700' };
      default:
        return { label: 'Otros Activos Fijos', icon: <Package className="size-4.5 text-zinc-600" />, bg: 'bg-zinc-50 border-zinc-200 text-zinc-700' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Activo', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'sold':
        return { label: 'Vendido', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'deprecated':
        return { label: 'Depreciado', bg: 'bg-zinc-100 text-zinc-650 border-zinc-200' };
      case 'donated':
        return { label: 'Donado', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      default:
        return { label: 'Desconocido', bg: 'bg-zinc-100 text-zinc-700' };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-zinc-200 bg-white shadow-xs">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Patrimonio en Activos Fijos</span>
              <h3 className="text-3xl font-black text-zinc-900 font-mono tracking-tight">
                ${stats.totalValue.toLocaleString('es-ES')}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Suma aproximada de las posesiones registradas activas.
              </p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100 self-start">
              <DollarSign className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 bg-white shadow-xs">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Bienes Registrados</span>
              <h3 className="text-3xl font-black text-zinc-900 font-mono tracking-tight">
                {stats.count}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Cantidad total de propiedades, carros y equipos.
              </p>
            </div>
            <div className="bg-blue-50 text-blue-700 p-3 rounded-2xl border border-blue-100 self-start">
              <Building className="size-6" />
            </div>
          </CardContent>
        </Card>

        {/* Categories Quick Stats */}
        <Card className="border border-zinc-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-black text-zinc-450 uppercase tracking-widest">Distribución por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1 flex flex-col gap-1.5 justify-center">
            {['real_estate', 'vehicle', 'appliance', 'technology', 'other'].map(cat => {
              const val = stats.categoryValues[cat] || 0;
              const details = getCategoryDetails(cat);
              if (val === 0) return null;
              return (
                <div key={cat} className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-650 flex items-center gap-1.5 font-medium">
                    {details.icon} {details.label.split(' / ')[0]}
                  </span>
                  <span className="font-extrabold text-zinc-800 font-mono">${val.toLocaleString('es-ES')}</span>
                </div>
              );
            })}
            {Object.keys(stats.categoryValues).length === 0 && (
              <p className="text-xs italic text-zinc-400 text-center py-2">Registra tus propiedades para ver la distribución.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action panel and Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-600" />
            Registro y Control de Activos Fijos
          </h3>
          <p className="text-xs text-zinc-500 mt-1 leading-normal max-w-2xl">
            Registra los bienes raíces, vehículos, electrodomésticos importantes u otras propiedades valiosas que posees para conocer el valor total de tu patrimonio real no líquido.
          </p>
        </div>
        <Button 
          onClick={handleOpenNew} 
          className="bg-zinc-950 hover:bg-zinc-850 text-white font-bold text-xs h-10 px-5 rounded-xl shrink-0 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="size-4" /> Registrar Activo Fijo
        </Button>
      </div>

      {/* Form Card Drawer/Dropdown */}
      {isFormOpen && (
        <Card className="border-indigo-200 shadow-xs bg-indigo-50/5 p-5 rounded-2xl animate-fade-in">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                  {editingId ? '🛠️ Modificar Activo Fijo' : '✨ Nuevo Registro de Activo Fijo'}
                </h4>
                <p className="text-[11px] text-zinc-450 mt-1">
                  Ingresa las características de tu bien para calcular su impacto en tu balance patrimonial.
                </p>
              </div>
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className="size-8 rounded-full text-zinc-400 hover:text-rose-600 hover:bg-rose-50" 
                onClick={() => setIsFormOpen(false)}
              >
                <X className="size-4.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="asset-name" className="text-xs font-bold text-zinc-700">Nombre del Activo</Label>
                <Input 
                  id="asset-name" 
                  placeholder="Ej. Apartamento Norte, Automóvil BMW X3" 
                  className="h-10 text-xs rounded-xl border-zinc-200 bg-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-category" className="text-xs font-bold text-zinc-700">Categoría del Bien</Label>
                <Select 
                  value={form.category} 
                  onValueChange={(v: any) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="asset-category" className="h-10 text-xs rounded-xl border-zinc-200 bg-white">
                    <SelectValue placeholder="Seleccione Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_estate">🏠 Bienes Raíces / Propiedades</SelectItem>
                    <SelectItem value="vehicle">🚗 Vehículos y Transporte</SelectItem>
                    <SelectItem value="appliance">📺 Electrodomésticos y Hogar</SelectItem>
                    <SelectItem value="technology">💻 Tecnología y Equipos</SelectItem>
                    <SelectItem value="other">📦 Otro Activo Fijo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-value" className="text-xs font-bold text-zinc-700">Valor Estimado Actual ($)</Label>
                <Input 
                  id="asset-value" 
                  type="number"
                  placeholder="250,000,000" 
                  className="h-10 text-xs rounded-xl border-zinc-200 bg-white font-mono"
                  value={form.estimatedValue}
                  onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="asset-date" className="text-xs font-bold text-zinc-700">Fecha de Adquisición</Label>
                <Input 
                  id="asset-date" 
                  type="date"
                  className="h-10 text-xs rounded-xl border-zinc-200 bg-white"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-location" className="text-xs font-bold text-zinc-700">Ubicación Física</Label>
                <Input 
                  id="asset-location" 
                  placeholder="Ej. Calle 100 #20-50, Garaje principal" 
                  className="h-10 text-xs rounded-xl border-zinc-200 bg-white"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asset-status" className="text-xs font-bold text-zinc-700">Estado del Activo</Label>
                <Select 
                  value={form.status} 
                  onValueChange={(v: any) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger id="asset-status" className="h-10 text-xs rounded-xl border-zinc-200 bg-white">
                    <SelectValue placeholder="Seleccione Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">🟢 En Uso / Activo</SelectItem>
                    <SelectItem value="sold">🔵 Vendido / Realizado</SelectItem>
                    <SelectItem value="deprecated">⚪ Depreciado / Obsoleto</SelectItem>
                    <SelectItem value="donated">🟣 Donado / Cedido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-desc" className="text-xs font-bold text-zinc-700">Especificaciones o Notas Opcionales</Label>
              <Input 
                id="asset-desc" 
                placeholder="Ej. Placas XXX-123. Asegurado contra todo riesgo hasta diciembre." 
                className="h-10 text-xs rounded-xl border-zinc-200 bg-white"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-150">
              <Button 
                type="button" 
                variant="outline" 
                className="text-xs h-9.5 rounded-xl px-4"
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9.5 rounded-xl px-5"
              >
                {editingId ? 'Guardar Cambios' : 'Registrar Bien Patrimonial'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Grid of registered assets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => {
          const detail = getCategoryDetails(asset.category);
          const st = getStatusBadge(asset.status);

          return (
            <Card 
              key={asset.id} 
              className={`overflow-hidden transition-all duration-200 border bg-white shadow-xs group flex flex-col justify-between ${
                asset.status !== 'active' 
                  ? 'opacity-60 border-dashed border-zinc-200 bg-zinc-50/50' 
                  : 'hover:shadow-md hover:border-zinc-300'
              }`}
            >
              {/* Card Header with category status and title */}
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 bg-zinc-50/50 flex flex-col gap-1.5">
                <div className="flex justify-between items-center gap-2">
                  <Badge className={`text-[9px] font-bold px-2 py-0.5 border rounded-full font-sans tracking-wide uppercase ${detail.bg}`}>
                    <span className="flex items-center gap-1">
                      {detail.icon} {detail.label}
                    </span>
                  </Badge>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-full font-serif ${st.bg}`}>
                    {st.label}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-2 mt-1">
                  <h4 className="font-extrabold text-zinc-900 text-sm leading-snug truncate group-hover:text-zinc-950">
                    {asset.name}
                  </h4>
                  <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-7 rounded-lg hover:bg-zinc-200/60"
                      onClick={() => handleOpenEdit(asset)}
                    >
                      <Edit3 className="size-3.5 text-zinc-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-7 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => handleDelete(asset.id)}
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Card Content with stats values */}
              <CardContent className="p-4 flex flex-col gap-3 flex-1 justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black font-sans">Valor Actual:</span>
                    <span className="text-lg font-black text-indigo-700 font-mono ml-auto">
                      ${(asset.estimatedValue || 0).toLocaleString('es-ES')}
                    </span>
                  </div>

                  {asset.description && (
                    <p className="text-zinc-600 text-xs leading-relaxed italic border-t border-dashed border-zinc-100 pt-2 mt-2 font-serif">
                      "{asset.description}"
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-150 p-2.5 rounded-xl mt-1 leading-normal font-sans">
                  {asset.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-zinc-400 shrink-0" />
                      <span className="truncate">Ubicación: <strong className="text-zinc-700">{asset.location}</strong></span>
                    </div>
                  )}
                  {asset.purchaseDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-zinc-400 shrink-0" />
                      <span>Adquirido: <strong className="text-zinc-700 font-mono">{format(new Date(asset.purchaseDate), 'dd/MM/yyyy')}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Activity className="size-3 text-zinc-400 shrink-0" />
                    <span>Último ajuste: <strong className="text-zinc-700">{asset.updatedAt ? format(new Date(asset.updatedAt), 'dd/MM/yyyy HH:mm') : 'Original'}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {assets.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white">
            <Building className="mx-auto mb-3 size-10 text-zinc-300 animate-pulse" />
            <h5 className="font-bold text-zinc-700 text-sm">No hay Activos Fijos registrados</h5>
            <p className="text-xs text-zinc-450 mt-1 max-w-sm mx-auto leading-relaxed">
              Define tus propiedades inmobiliarias, autos, electrodomésticos costosos y pertenencias para vigilar el valor neto de tu patrimonio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
