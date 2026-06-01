import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dbService } from '@/src/lib/db';
import { Account, Category, UserSettings, Debt } from '@/src/types';
import { Plus, Wallet, Tag, Calendar as CalendarIcon, Hash, TrendingUp, TrendingDown, User, Receipt, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface AddTransactionDialogProps {
  accounts: Account[];
  categories: Category[];
  activeTab?: string;
  settings?: UserSettings | null;
  defaultType?: 'income' | 'expense' | 'purchase';
  defaultIsEventual?: boolean;
  buttonClassName?: string;
  triggerElement?: React.ReactNode;
}

export function AddTransactionDialog({ 
  accounts, 
  categories, 
  activeTab, 
  settings, 
  defaultType, 
  defaultIsEventual, 
  buttonClassName, 
  triggerElement 
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payWithDebt, setPayWithDebt] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

  // Subscribe to debts to enable paying with credit cards or revolving credits
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('debts', setDebts);
    return () => unsub();
  }, []);

  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'purchase',
    categoryId: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    isEventual: false,
    payerOrEntity: '',
    concept: '',
    customConcept: ''
  });

  // Get configured eventual income concepts
  const eventualConcepts = settings?.eventualIncomeConcepts || [
    'Freelance / Honorarios',
    'Venta de artículo / activo',
    'Regalo / Ocasional',
    'Rendimiento financiero',
    'Reembolso',
    'Otro concepto eventual'
  ];

  // Sync state when open state or default props change
  useEffect(() => {
    if (open) {
      let initialType: 'income' | 'expense' | 'purchase' = defaultType || 'expense';
      let initialIsEventual = defaultIsEventual !== undefined ? defaultIsEventual : false;

      // Auto check based on current active view tab
      if (!defaultType) {
        if (activeTab === 'income') {
          initialType = 'income';
          initialIsEventual = defaultIsEventual !== undefined ? defaultIsEventual : true; // Default to income eventual
        } else if (activeTab === 'expense') {
          initialType = 'expense';
        } else if (activeTab === 'purchase') {
          initialType = 'purchase';
        }
      }

      // First income category to pre-fill if type is income
      let preferredCategoryId = '';
      if (initialType === 'income') {
        const firstIncomeCat = categories.find(c => c.type === 'income');
        if (firstIncomeCat) preferredCategoryId = firstIncomeCat.id;
      }

      setFormData({
        amount: '',
        type: initialType,
        categoryId: preferredCategoryId,
        accountId: accounts[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        isEventual: initialIsEventual,
        payerOrEntity: '',
        concept: eventualConcepts[0] || '',
        customConcept: ''
      });
      setPayWithDebt(false);
      setSelectedDebtId('');
    }
  }, [open, activeTab, defaultType, defaultIsEventual, accounts, categories, settings]);

  const selectedCategory = categories.find(c => c.id === formData.categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalCategoryId = formData.categoryId;
    if (!finalCategoryId && formData.type === 'income' && formData.isEventual) {
      const firstIncomeCat = categories.find(c => c.type === 'income');
      if (firstIncomeCat) {
        finalCategoryId = firstIncomeCat.id;
      } else if (categories.length > 0) {
        finalCategoryId = categories[0].id;
      }
    }

    if ((formData.amount === '' && !selectedCategory?.isNoCost) || (!payWithDebt && !formData.accountId) || (payWithDebt && !selectedDebtId) || !finalCategoryId) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (formData.type === 'income' && formData.isEventual) {
      if (!formData.payerOrEntity.trim()) {
        toast.error('Especifica la persona o entidad que realizó el ingreso');
        return;
      }
      if (!formData.concept) {
        toast.error('Selecciona un concepto para el ingreso');
        return;
      }
      if (formData.concept === 'Otro' && !formData.customConcept.trim()) {
        toast.error('Especifica el concepto personalizado');
        return;
      }
    }

    setLoading(true);
    try {
      const amount = selectedCategory?.isNoCost ? 0 : parseFloat(formData.amount);
      const account = !payWithDebt ? accounts.find(a => a.id === formData.accountId) : null;
      
      if (!payWithDebt && !account) throw new Error('Cuenta no encontrada');

      const conceptToSave = formData.type === 'income' && formData.isEventual
        ? (formData.concept === 'Otro' ? formData.customConcept.trim() : formData.concept)
        : '';
      const payerToSave = formData.type === 'income' && formData.isEventual
        ? formData.payerOrEntity.trim()
        : '';

      // 1. Create Transaction
      await dbService.addItem('transactions', {
        amount,
        type: formData.type,
        categoryId: finalCategoryId,
        accountId: payWithDebt ? '' : formData.accountId,
        date: new Date(formData.date).toISOString(),
        description: formData.description,
        isEventual: formData.isEventual,
        payerOrEntity: payerToSave,
        concept: conceptToSave,
        createdAt: new Date().toISOString(),
        paidWithDebt: payWithDebt,
        debtId: payWithDebt ? selectedDebtId : undefined
      });

      // 2. Update Account or Credit Card Balance
      if (payWithDebt) {
        const debtObj = debts.find(d => d.id === selectedDebtId);
        if (debtObj) {
          const currentRemaining = Number(debtObj.remainingAmount) || 0;
          await dbService.updateItem('debts', selectedDebtId, {
            remainingAmount: currentRemaining + amount
          });
          toast.warning('⚠️ ¡Pago con deuda registrado! Acabas de aumentar tu pasivo. Esto te aleja de tu libertad financiera.');
        }
      } else if (account) {
        const currentBalance = Number(account.balance) || 0;
        const balanceChange = formData.type === 'income' ? amount : -amount;
        await dbService.updateItem('accounts', account.id, {
          balance: currentBalance + balanceChange
        });
        toast.success('Transacción registrada exitosamente');
      }

      setOpen(false);
      setFormData({
        amount: '',
        type: 'expense',
        categoryId: '',
        accountId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        isEventual: false,
        payerOrEntity: '',
        concept: '',
        customConcept: ''
      });
      setPayWithDebt(false);
      setSelectedDebtId('');
    } catch (error: any) {
      console.error('Error al registrar la transacción:', error);
      let errorMsg = 'Error al registrar la transacción';
      if (error && typeof error === 'object') {
        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed && parsed.error) {
              errorMsg += `: ${parsed.error}`;
            } else {
              errorMsg += `: ${error.message}`;
            }
          } catch {
            errorMsg += `: ${error.message}`;
          }
        } else {
          errorMsg += `: ${JSON.stringify(error)}`;
        }
      } else if (error) {
        errorMsg += `: ${String(error)}`;
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerElement || (
            <Button className={buttonClassName || "bg-zinc-900 shadow-lg hover:shadow-xl transition-all"} />
          )
        }
      >
        {!triggerElement ? (
          <>
            <Plus className="mr-2 size-4" />
            Nueva Transacción
          </>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {defaultType === 'income' && defaultIsEventual === true 
              ? 'Registrar Ingreso Eventual (Ocasional)' 
              : 'Registrar Movimiento'
            }
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {!(defaultType === 'income' && defaultIsEventual === true) && (
            <div className="grid grid-cols-3 gap-2">
              <div 
                onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '', amount: '' })}
                className={`p-2.5 rounded-lg border-2 cursor-pointer text-center transition-all ${
                  formData.type === 'expense' 
                    ? 'border-rose-500 bg-rose-50 text-rose-700' 
                    : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <TrendingDown className="mx-auto mb-1 size-4" />
                <span className="text-xs font-semibold block">Pago / Obligación</span>
              </div>
              <div 
                onClick={() => setFormData({ ...formData, type: 'income', categoryId: '', amount: '' })}
                className={`p-2.5 rounded-lg border-2 cursor-pointer text-center transition-all ${
                  formData.type === 'income' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <TrendingUp className="mx-auto mb-1 size-4" />
                <span className="text-xs font-semibold block">Ingreso</span>
              </div>
              <div 
                onClick={() => setFormData({ ...formData, type: 'purchase', categoryId: '', amount: '' })}
                className={`p-2.5 rounded-lg border-2 cursor-pointer text-center transition-all ${
                  formData.type === 'purchase' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <Tag className="mx-auto mb-1 size-4" />
                <span className="text-xs font-semibold block">Compra</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Monto ($)</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 size-4 text-zinc-400" />
              <Input 
                id="amount" 
                type="number" 
                step="0.01" 
                placeholder={selectedCategory?.isNoCost ? "0.00 (Incluido en otro plan)" : "0.00"} 
                className="pl-9"
                value={selectedCategory?.isNoCost ? "0" : formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled={selectedCategory?.isNoCost}
                required={!selectedCategory?.isNoCost}
              />
            </div>
            {selectedCategory?.isNoCost && (
              <p className="text-[10px] text-indigo-500 font-medium">Este pago está clasificado como sin costo o incluido en su totalidad.</p>
            )}
          </div>

          {/* Pay with debt toggle feature requested */}
          {['expense', 'purchase'].includes(formData.type) && (
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="payWithDebt"
                  checked={payWithDebt}
                  onChange={(e) => {
                    setPayWithDebt(e.target.checked);
                    setSelectedDebtId('');
                  }}
                  className="size-4 text-rose-600 border-zinc-300 rounded focus:ring-rose-500 cursor-pointer"
                />
                <Label htmlFor="payWithDebt" className="text-rose-900 font-extrabold cursor-pointer flex items-center gap-1">
                  🔴 ¿Pagar con Deuda? (Tarjeta / Crédito)
                </Label>
              </div>

              {payWithDebt && (
                <div className="space-y-1.5 animate-slide-in">
                  <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider flex items-center gap-1">
                    ⚠️ ¡Cuidado! Pagar con deuda te devalúa y te aleja de tu libertad financiera.
                  </span>
                  
                  <select
                    required
                    className="w-full h-9.5 px-3 bg-white border border-rose-250 rounded-lg text-xs text-rose-950 font-bold select-none outline-none focus:ring-1 focus:ring-rose-600"
                    value={selectedDebtId}
                    onChange={(e) => setSelectedDebtId(e.target.value)}
                  >
                    <option value="">-- Selecciona Tarjeta o Crédito --</option>
                    {debts.filter(d => d.status === 'active').map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.creditor}) - Saldo: ${d.remainingAmount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className={defaultType === 'income' && defaultIsEventual === true ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'}>
            {!payWithDebt ? (
              <div className="space-y-2 animate-fade-in">
                <Label>Cuenta Destino</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData({ ...formData, accountId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                    {accounts.length === 0 && <SelectItem value="_" disabled>Crea una cuenta primero</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="p-3.5 bg-zinc-100 rounded-lg flex items-center justify-center border border-zinc-200 select-none animate-fade-in">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center">💸 Cargado a Deuda</span>
              </div>
            )}
            {!(defaultType === 'income' && defaultIsEventual === true) && (
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(v) => {
                    const cat = categories.find(c => c.id === v);
                    const updates: any = { categoryId: v };
                    if (cat) {
                      updates.isEventual = cat.isEventual || false;
                      if (cat.isNoCost) {
                        updates.amount = '0';
                      } else {
                        updates.amount = '';
                      }
                    } else {
                      updates.amount = '';
                    }
                    setFormData(prev => ({ ...prev, ...updates }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === formData.type).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {categories.filter(c => c.type === formData.type).length === 0 && (
                      <SelectItem value="_" disabled>Crea una categoría primero</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 size-4 text-zinc-400" />
              <Input 
                id="date" 
                type="date"
                className="pl-9"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

           {!(defaultType === 'income' && defaultIsEventual === true) && (
             <div className="space-y-1.5">
              <Label>Periodicidad o Frecuencia</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isEventual: false })}
                  className={`py-2 px-3 text-xs rounded-xl border font-bold text-center transition-all ${
                    !formData.isEventual 
                      ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-650 hover:bg-zinc-100'
                  }`}
                >
                  🔄 Recurrente (Mensual)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isEventual: true })}
                  className={`py-2 px-3 text-xs rounded-xl border font-bold text-center transition-all ${
                    formData.isEventual 
                      ? 'bg-amber-600 border-amber-600 text-white shadow-sm' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-650 hover:bg-zinc-100'
                  }`}
                >
                  📅 Eventual (Ocasional)
                </button>
              </div>
            </div>
          )}

          {formData.type === 'income' && formData.isEventual && (
            <div className="space-y-3.5 p-3.5 bg-amber-50/20 border border-amber-150 rounded-xl animate-fade-in text-left">
              <div className="space-y-1.5">
                <Label htmlFor="payer" className="text-amber-800 text-xs font-black flex items-center gap-1.5">
                  <User className="size-3.5" />
                  Persona o Entidad que realiza el ingreso <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="payer"
                  placeholder="Ej. Juan Pérez, Empresa de Servicios SA"
                  value={formData.payerOrEntity}
                  onChange={(e) => setFormData({ ...formData, payerOrEntity: e.target.value })}
                  className="bg-white border-amber-200 focus-visible:ring-amber-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-amber-800 text-xs font-black flex items-center gap-1.5">
                  <Receipt className="size-3.5" />
                  Concepto eventual <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.concept}
                  onValueChange={(v) => {
                    const updates: any = { concept: v };
                    if (v !== 'Otro') {
                      updates.customConcept = '';
                    }
                    setFormData(prev => ({ ...prev, ...updates }));
                  }}
                >
                  <SelectTrigger className="bg-white border-amber-200 text-xs">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventualConcepts.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="Otro">Otro concepto distinto...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.concept === 'Otro' && (
                <div className="space-y-1.5 pl-2.5 border-l-2 border-amber-500 animate-fade-in">
                  <Label htmlFor="customConcept" className="text-amber-805 text-[11px] font-extrabold">
                    Especificar Concepto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customConcept"
                    placeholder="Ej. Devolución de depósito"
                    value={formData.customConcept}
                    onChange={(e) => setFormData({ ...formData, customConcept: e.target.value })}
                    className="bg-white border-amber-200 text-xs"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (Opcional)</Label>
            <Input 
              id="description" 
              placeholder="Ej. Almuerzo en restaurante"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {(formData.isEventual || (selectedCategory && (selectedCategory.isAutoDebit || selectedCategory.isNoCost))) && (
            <div className="p-3 rounded-xl border border-zinc-150 bg-zinc-50 flex flex-col gap-1 text-[11px] leading-tight">
              <span className="font-bold text-zinc-700">Propiedades del Movimiento:</span>
              <div className="flex flex-col gap-1 mt-1">
                {formData.isEventual && (
                  <span className="text-amber-600 font-extrabold flex items-center gap-1">
                    📅 Movimiento Eventual (No impacta límites mensuales estáticos)
                  </span>
                )}
                {selectedCategory?.isAutoDebit && (
                  <span className="text-rose-600 font-extrabold flex items-center gap-1">
                    🔄 Débito Automático (Se debita solo de tus fondos)
                  </span>
                )}
                {selectedCategory?.isNoCost && (
                  <span className="text-indigo-600 font-extrabold flex items-center gap-1">
                    🎁 Sin costo real / Incluido por defecto ($0)
                  </span>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Procesando...' : 'Guardar Transacción'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
