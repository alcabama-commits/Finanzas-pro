import React, { useState, useEffect } from 'react';
import { UserSettings, Account, Category } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Wallet, 
  Tag, 
  Briefcase, 
  Check, 
  X, 
  DollarSign, 
  HelpCircle,
  PiggyBank,
  ShoppingBag,
  Receipt
} from 'lucide-react';
import { PurchasesPanel } from './PurchasesPanel';

interface SettingsProps {
  settings: UserSettings | null;
  onSave: (settings: UserSettings) => void;
  accounts: Account[];
}

const COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Zinc', value: '#18181b' },
];

export function Settings({ settings, onSave, accounts }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'activos' | 'pasivos'>('activos');
  
  // States for general Pasivos settings
  const [formData, setFormData] = useState<UserSettings>(settings || { monthlyLimit: 1000, billingCycle: '30' });
  const [loading, setLoading] = useState(false);

  // States for Activos - Adding Account
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');

  // States for Inline Account Balance Editing
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccBalance, setEditAccBalance] = useState('');

  // States for Pasivos - Gasto Directo type: 'expense'
  const [pasivosSubTab, setPasivosSubTab] = useState<'gastos' | 'compras'>('gastos');

  // States for Eventual Income Concepts
  const [newConcept, setNewConcept] = useState('');
  const [eventualConcepts, setEventualConcepts] = useState<string[]>([]);

  // Update form data state if prop settings change
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setEventualConcepts(settings.eventualIncomeConcepts || [
        'Freelance / Honorarios',
        'Venta de artículo / activo',
        'Regalo / Ocasional',
        'Rendimiento financiero',
        'Reembolso',
        'Otro concepto eventual'
      ]);
    } else {
      setEventualConcepts([
        'Freelance / Honorarios',
        'Venta de artículo / activo',
        'Regalo / Ocasional',
        'Rendimiento financiero',
        'Reembolso',
        'Otro concepto eventual'
      ]);
    }
  }, [settings]);

  // Handle saving general Pasivos settings
  const handleSaveBudget = async () => {
    setLoading(true);
    try {
      await dbService.setUser(formData);
      onSave(formData);
      toast.success('Ajustes de presupuesto guardados correctamente');
    } catch (e) {
      toast.error('Error al guardar ajustes de presupuesto');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConcept = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = newConcept.trim();
    if (!cleanLabel) return;
    if (eventualConcepts.some(c => c.toLowerCase() === cleanLabel.toLowerCase())) {
      toast.error('Este concepto ya está registrado');
      return;
    }
    const updated = [...eventualConcepts, cleanLabel];
    setEventualConcepts(updated);
    setNewConcept('');
    
    try {
      const updatedSettings: UserSettings = {
        ...formData,
        eventualIncomeConcepts: updated
      };
      await dbService.setUser(updatedSettings);
      onSave(updatedSettings);
      toast.success('Concepto registrado correctamente');
    } catch (err) {
      toast.error('Error al guardar el concepto');
    }
  };

  const handleDeleteConcept = async (concept: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el concepto "${concept}"?`)) return;
    const updated = eventualConcepts.filter(c => c !== concept);
    setEventualConcepts(updated);
    
    try {
      const updatedSettings: UserSettings = {
        ...formData,
        eventualIncomeConcepts: updated
      };
      await dbService.setUser(updatedSettings);
      onSave(updatedSettings);
      toast.success('Concepto eliminado correctamente');
    } catch (err) {
      toast.error('Error al eliminar el concepto');
    }
  };



  // 2. Create a new Account / Fund (Account in collection)
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      toast.error('Especifica el nombre del nuevo fondo o cuenta');
      return;
    }
    const initialBalanceVal = parseFloat(newAccountBalance) || 0;

    try {
      await dbService.addItem('accounts', {
        name: newAccountName.trim(),
        balance: initialBalanceVal,
        color: '#18181b', // Default Zinc dark color
        icon: 'wallet',
        createdAt: new Date().toISOString()
      });
      toast.success(`Cuenta/Fondo "${newAccountName.trim()}" registrado con saldo inicial de $${initialBalanceVal.toLocaleString()}`);
      setNewAccountName('');
      setNewAccountBalance('');
    } catch (err) {
      toast.error('Error al registrar el fondo o cuenta');
    }
  };

  // Inline Account Balance Change Save
  const handleSaveAccountBalance = async (accId: string) => {
    const parsedVal = parseFloat(editAccBalance);
    if (isNaN(parsedVal)) {
      toast.error('Ingresa un valor numérico válido');
      return;
    }
    try {
      await dbService.updateItem('accounts', accId, {
        balance: parsedVal
      });
      toast.success('Saldo del fondo actualizado con éxito');
      setEditingAccId(null);
    } catch (err) {
      toast.error('Error al actualizar saldo de la cuenta');
    }
  };

  // Delete account
  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas borrar la cuenta "${name}"? Su saldo quedará ignorado.`)) return;
    try {
      await dbService.deleteItem('accounts', id);
      toast.success('Cuenta ó fondo eliminado');
    } catch (e) {
      toast.error('Error al eliminar la cuenta');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Segmented Tab Swapper at the top */}
      <div className="flex bg-zinc-100 p-1 rounded-xl max-w-md w-full border border-zinc-200 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('activos')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
            activeTab === 'activos'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50/50'
          }`}
        >
          <TrendingUp className="size-4 text-emerald-500" />
          Ajustes de ACTIVOS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pasivos')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
            activeTab === 'pasivos'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50/50'
          }`}
        >
          <TrendingDown className="size-4 text-rose-500" />
          Ajustes de PASIVOS
        </button>
      </div>

      {/* ACTIVE SCREEN: ACTIVOS */}
      {activeTab === 'activos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Card left: Accounts & funds controls */}
          <div className="space-y-6">
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="pb-3 border-b border-zinc-100">
                <CardTitle className="text-sm font-bold text-zinc-850 flex items-center gap-2">
                  <Wallet className="size-4.5 text-blue-600" />
                  1. Crear y Gestionar Cuentas y Fondos
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Registra cuentas donde guardas efectivo o activos financieros y edita sus saldos iniciales.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-5 space-y-5">
                {/* Form to create a new Account */}
                <form onSubmit={handleAddAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-name">Nombre de la Cuenta</Label>
                    <Input
                      id="acc-name"
                      placeholder="Ej. Bancolombia, Efectivo Personal..."
                      value={newAccountName}
                      onChange={e => setNewAccountName(e.target.value)}
                      className="h-9.5 text-xs bg-zinc-50 border-zinc-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-balance">Saldo Inicial ($)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="acc-balance"
                        type="number"
                        placeholder="0.00"
                        value={newAccountBalance}
                        onChange={e => setNewAccountBalance(e.target.value)}
                        className="h-9.5 text-xs bg-zinc-50 border-zinc-200 font-mono"
                      />
                      <Button 
                        type="submit" 
                        size="sm" 
                        className="bg-zinc-900 hover:bg-zinc-800 text-white h-9.5 text-xs font-bold shrink-0 px-3.5"
                      >
                        Registrar
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Accounts and current inline adjusters list */}
                <div className="pt-4 border-t border-zinc-100/80 space-y-3">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Cuentas y Fondos Activos</h4>
                  {accounts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-400 italic">
                      No hay cuentas creadas en el sistema.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {accounts.map(acc => {
                        const isEditing = editingAccId === acc.id;
                        return (
                          <div 
                            key={acc.id} 
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50/30 gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-zinc-100 text-zinc-650 rounded-lg">
                                <PiggyBank className="size-4" />
                              </div>
                              <div>
                                <span className="text-xs font-extrabold text-zinc-800 block leading-tight">{acc.name}</span>
                                <span className="text-[10px] text-zinc-400 font-medium font-sans uppercase">Fondo registrado</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editAccBalance}
                                    onChange={e => setEditAccBalance(e.target.value)}
                                    className="w-24 h-8 text-xs font-bold font-mono py-0 text-emerald-700 bg-white"
                                  />
                                  <Button 
                                    size="icon" 
                                    className="size-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shrink-0"
                                    onClick={() => handleSaveAccountBalance(acc.id)}
                                  >
                                    <Check className="size-3.5" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="outline"
                                    className="size-8 text-zinc-400 hover:text-zinc-600 rounded-lg shrink-0"
                                    onClick={() => setEditingAccId(null)}
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2.5">
                                  <span 
                                    className="text-xs font-black font-mono text-zinc-900 cursor-pointer hover:underline bg-zinc-100/50 py-1 px-2 rounded border border-zinc-150"
                                    title="Haz clic para ajustar saldo directamente"
                                    onClick={() => {
                                      setEditingAccId(acc.id);
                                      setEditAccBalance(String(acc.balance || 0));
                                    }}
                                  >
                                    ${(Number(acc.balance) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>

                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-zinc-400 hover:text-indigo-600 size-7.5 rounded-full"
                                      onClick={() => {
                                        setEditingAccId(acc.id);
                                        setEditAccBalance(String(acc.balance || 0));
                                      }}
                                    >
                                      <SettingsIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost" 
                                      size="icon" 
                                      disabled={acc.name.toLowerCase() === 'efectivo'}
                                      className="text-zinc-400 hover:text-rose-600 size-7.5 rounded-full disabled:opacity-30 disabled:pointer-events-none"
                                      onClick={() => handleDeleteAccount(acc.id, acc.name)}
                                      title={acc.name.toLowerCase() === 'efectivo' ? 'No puedes borrar el fondo principal "Efectivo"' : 'Eliminar cuenta'}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card right: Conceptos de Ingresos Eventuales (Configuración) */}
          <div className="space-y-6">
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="pb-3 border-b border-zinc-100">
                <CardTitle className="text-sm font-bold text-zinc-850 flex items-center gap-2">
                  <Receipt className="size-4.5 text-amber-600" />
                  2. Conceptos de Ingresos Eventuales (Configuración)
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Agrega o elimina los conceptos de ingresos eventuales u ocasionales que aparecen como desplegables en el formulario de Nueva Transacción.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <form onSubmit={handleAddConcept} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="concept-name" className="text-zinc-650 text-xs font-bold">Agregar nuevo concepto eventual</Label>
                    <div className="flex gap-2">
                      <Input
                        id="concept-name"
                        placeholder="Ej. Devolución de Garantía, Freelance Web, Venta Consola..."
                        value={newConcept}
                        onChange={e => setNewConcept(e.target.value)}
                        className="h-9.5 text-xs bg-zinc-50 border-zinc-200"
                        required
                      />
                      <Button 
                        type="submit" 
                        size="sm" 
                        className="bg-amber-600 hover:bg-amber-700 text-white h-9.5 text-xs font-bold shrink-0 px-4"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Agregar Concepto
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="pt-4 border-t border-zinc-100/80 space-y-3">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Conceptos Eventuales Actuales</h4>
                  {eventualConcepts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-400 italic">
                      No hay conceptos eventuales configurados. Usa el formulario de arriba para agregar uno.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {eventualConcepts.map((concept, idx) => (
                        <div 
                          key={`${concept}-${idx}`} 
                          className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-150 bg-amber-50/10 hover:bg-amber-50/25 transition-colors group relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                          <div className="flex items-center gap-2 pl-2">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            <span className="text-xs font-bold text-zinc-700">{concept}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            className="text-zinc-400 hover:text-rose-600 size-6 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteConcept(concept)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* ACTIVE SCREEN: PASIVOS */}
      {activeTab === 'pasivos' && (
        <div className="space-y-6 w-full animate-fade-in">
          {/* Sub-Tabs for Pasivos: Gastos Directos vs Compras de Tienda */}
          <div className="flex border-b border-zinc-200 gap-6 pb-0 mb-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setPasivosSubTab('gastos')}
              className={`pb-3 text-sm font-bold transition-all relative px-1 flex items-center gap-2 whitespace-nowrap ${
                pasivosSubTab === 'gastos'
                  ? 'text-zinc-900 border-b-2 border-zinc-900 font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Receipt className={`size-4 ${pasivosSubTab === 'gastos' ? 'text-rose-600' : 'text-zinc-400'}`} />
              🧾 Gastos Directos (Arriendo, Servicios Públicos)
            </button>
            <button
              type="button"
              onClick={() => setPasivosSubTab('compras')}
              className={`pb-3 text-sm font-bold transition-all relative px-1 flex items-center gap-2 whitespace-nowrap ${
                pasivosSubTab === 'compras'
                  ? 'text-zinc-900 border-b-2 border-zinc-900 font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <ShoppingBag className={`size-4 ${pasivosSubTab === 'compras' ? 'text-indigo-600' : 'text-zinc-400'}`} />
              🛒 Compras Eventuales e Inventario
            </button>
          </div>

          {/* Sub-tab 1: Gastos Directos (Arriendo, Servicios) */}
          {pasivosSubTab === 'gastos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start w-full">
              {/* Column 1: Budget limit preferences and toggles */}
              <div className="lg:col-span-1 space-y-6 animate-fade-in block">
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-3 border-b border-zinc-100">
                    <CardTitle className="text-sm font-bold text-zinc-850 flex items-center gap-2">
                      <SettingsIcon className="size-4.5 text-zinc-750" />
                      Preferencias de Presupuesto (Límites de Saldo)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configura tus límites y alertas para tus deudas o ciclos de facturación pasivos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="limit">Límite de Gastos Mensual ($)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 size-4 text-zinc-400" />
                        <Input 
                          id="limit" 
                          type="number" 
                          value={formData.monthlyLimit}
                          onChange={e => setFormData({ ...formData, monthlyLimit: parseFloat(e.target.value) || 0 })}
                          className="pl-9 bg-zinc-50 border-zinc-200"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400">Te avisaremos con notificaciones cuando consumas más del 80%.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cycle">Ciclo de Corte del Mes</Label>
                      <Select 
                        value={formData.billingCycle} 
                        onValueChange={(v: '15' | '30') => setFormData({ ...formData, billingCycle: v })}
                      >
                        <SelectTrigger id="cycle" className="bg-white border-zinc-200">
                          <SelectValue placeholder="Seleccionar ciclo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Quincenal (Días 15 y 30)</SelectItem>
                          <SelectItem value="30">Mensual (Día 30)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-zinc-400">
                        {formData.billingCycle === '15' 
                          ? 'Tus gastos mensuales recurrentes se cortarán en tramos de 15 días.' 
                          : 'Corte regular al final de cada mes calendario completo.'}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-zinc-50/50 flex justify-between items-center py-3.5 rounded-b-xl border-t border-zinc-105">
                    <p className="text-[10px] text-zinc-450 font-medium">Actualizado: {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleDateString() : 'Por configurar'}</p>
                    <Button onClick={handleSaveBudget} disabled={loading} size="sm" className="bg-zinc-900 text-white hover:bg-zinc-805 text-xs font-bold leading-none h-8.5 px-4">
                      {loading ? 'Guardando...' : 'Guardar Ajustes'}
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-3 border-b border-zinc-100">
                    <CardTitle className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                      <Bell className="size-4.5 text-zinc-650" />
                      Notificaciones y Seguridad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-xl bg-zinc-50/50">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Alertas de Límite</p>
                        <p className="text-[10px] text-zinc-500">Notificación inmediata al alcanzar el presupuesto.</p>
                      </div>
                      <div className="size-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold uppercase animate-pulse">ON</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Column 2: Explanation block routing to categories page */}
              <div className="lg:col-span-2 space-y-6 animate-fade-in block">
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-3 border-b border-zinc-100">
                    <CardTitle className="text-sm font-bold text-zinc-850 flex items-center gap-2">
                      <Receipt className="size-4.5 text-rose-600" />
                      Categorización de Gastos Directos (Pasivos)
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      La asignación y catalogación de tus conceptos de gasto directo (Arriendo, Servicios de Luz, Agua, Internet, Suscripciones, etc.) ahora se realiza de forma exclusiva desde la sección unificada **Categorías** en el menú principal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4 text-xs text-zinc-650 leading-relaxed">
                    <p>
                      Para evitar incoherencias y tener un único origen de verdad, ya no es posible registrar ni eliminar tipos de gasto directo desde este panel.
                    </p>
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                      <p className="font-extrabold text-zinc-800 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                        <span>➔</span> ¿Cómo crear un concepto de gasto directo?
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 text-zinc-605 text-[11px]">
                        <li>Dirígete a la pestaña <strong>Categorías</strong> en el menú lateral.</li>
                        <li>Selecciona la opción de <strong>Pasivos</strong> en la parte superior.</li>
                        <li>Haz clic en el botón <strong>Gasto Directo</strong> para registrar un nuevo tipo, configurar su color, su meta de límite mensual estimado, débito automático u otras opciones avanzadas.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Compras e Inventario */}
          {pasivosSubTab === 'compras' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start w-full animate-fade-in">
              {/* Left description / info panel */}
              <div className="xl:col-span-1 space-y-6">
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-3 border-b border-zinc-100">
                    <CardTitle className="text-sm font-bold text-zinc-850 flex items-center gap-2">
                      <ShoppingBag className="size-4.5 text-indigo-600" />
                      Gestión de Compras Eventuales
                    </CardTitle>
                    <CardDescription className="text-xs">
                      A diferencia de los Gastos Directos (arriendos, servicios), las **Compras Eventuales** corresponden a adquisiciones de artículos esporádicos o específicos en establecimientos seleccionados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 text-xs text-zinc-650 space-y-3 leading-relaxed">
                    <p>
                      ✓ <strong>Alimentación Automática de Activos Fijos:</strong> Al registrar y guardar una compra eventual, esta se añade directamente al listado de tus **Activos Fijos** activos, facilitando el control patrimonial.
                    </p>
                    <p>
                      ✓ <strong>Flujo Automatizado:</strong> Configura tus supermercados, tiendas y los artículos de stock con los cuales alimentas el catálogo e inventario.
                    </p>
                    <p>
                      ✓ <strong>Sincronización en la Hoja:</strong> Cada compra registrada deduce saldo del fondo financiero seleccionado y crea una fila automáticamente en tu planilla enlazada de Google Sheets.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Right panel: Full PurchasesPanel */}
              <div className="xl:col-span-2">
                <PurchasesPanel accounts={accounts} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
