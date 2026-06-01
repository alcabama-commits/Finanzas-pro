import React, { useState, useEffect, useMemo } from 'react';
import { RecurringIncome, Account, Category } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Briefcase,
  Play,
  RotateCcw,
  X,
  CreditCard,
  Check
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function RecurringIncomesView() {
  const [incomes, setIncomes] = useState<RecurringIncome[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Creation/Edit state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Correction/Confirmation dynamic state
  const [confirmingTemplate, setConfirmingTemplate] = useState<RecurringIncome | null>(null);
  const [confirmingAmount, setConfirmingAmount] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    accountId: '',
    categoryId: '',
    dayOfMonth: '1',
    description: '',
    active: true,
    frequency: 'mensual' as 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual',
    startMonth: String(new Date().getMonth() + 1)
  });

  // Load subscriptions to Collections
  useEffect(() => {
    const unsubIncomes = dbService.subscribeToCollection('recurring_incomes', setIncomes);
    const unsubAccounts = dbService.subscribeToCollection('accounts', setAccounts);
    const unsubCategories = dbService.subscribeToCollection('categories', setCategories);

    return () => {
      unsubIncomes();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  // Filter income categories
  const incomeCategories = useMemo(() => {
    return categories.filter(c => c.type === 'income');
  }, [categories]);

  // Handle open new form
  const handleOpenNewForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      amount: '',
      accountId: accounts[0]?.id || '',
      categoryId: incomeCategories[0]?.id || '',
      dayOfMonth: '15',
      description: '',
      active: true,
      frequency: 'mensual',
      startMonth: String(new Date().getMonth() + 1)
    });
    setIsFormOpen(true);
  };

  // Handle open edit
  const handleOpenEdit = (inc: RecurringIncome) => {
    setEditingId(inc.id);
    setFormData({
      name: inc.name,
      amount: String(inc.amount),
      accountId: inc.accountId,
      categoryId: inc.categoryId,
      dayOfMonth: String(inc.dayOfMonth),
      description: inc.description || '',
      active: inc.active,
      frequency: inc.frequency || 'mensual',
      startMonth: String(inc.startMonth || new Date().getMonth() + 1)
    });
    setIsFormOpen(true);
  };

  // Save / Update recurring income
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount || !formData.accountId || !formData.categoryId) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    const value = parseFloat(formData.amount);
    if (isNaN(value) || value <= 0) {
      toast.error('El monto debe ser un número positivo');
      return;
    }

    const day = parseInt(formData.dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('Día del mes inválido (1-31)');
      return;
    }

    const isCustomFreq = formData.frequency !== 'mensual' && formData.frequency !== 'quincenal';
    const parsedStartMonth = parseInt(formData.startMonth);

    const finalData = {
      name: formData.name.trim(),
      amount: value,
      accountId: formData.accountId,
      categoryId: formData.categoryId,
      dayOfMonth: day,
      description: formData.description.trim(),
      active: formData.active,
      frequency: formData.frequency,
      startMonth: isCustomFreq ? (isNaN(parsedStartMonth) ? 1 : parsedStartMonth) : undefined
    };

    try {
      if (editingId) {
        await dbService.updateItem('recurring_incomes', editingId, finalData);
        toast.success(`Ingreso recurrente "${finalData.name}" actualizado con éxito`);
      } else {
        await dbService.addItem('recurring_incomes', finalData);
        if (isCustomFreq) {
          toast.success(`Ingreso recurrente "${finalData.name}" configurado con frecuencia "${finalData.frequency}" (Mes de inicio: ${formData.startMonth}).`);
        } else {
          toast.success(`Ingreso recurrente "${finalData.name}" configurado. Se repetirá con frecuencia ${finalData.frequency}.`);
        }
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Hubo un error al guardar la plantilla');
    }
  };

  // Toggle active switcher
  const handleToggleActive = async (inc: RecurringIncome) => {
    try {
      await dbService.updateItem('recurring_incomes', inc.id, {
        active: !inc.active
      });
      toast.success(inc.active ? `"${inc.name}" pausado` : `"${inc.name}" activado`);
    } catch (err) {
      toast.error('No se pudo cambiar el estado');
    }
  };

  // Delete recurring income
  const handleDelete = async (incId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este ingreso recurrente?')) return;
    try {
      await dbService.deleteItem('recurring_incomes', incId);
      toast.success('Ingreso recurrente eliminado');
    } catch (err) {
      toast.error('Error al intentar eliminar');
    }
  };

  // Trigger flow to confirm and potentially correct the income amount
  const handleApplyIncome = (inc: RecurringIncome) => {
    setConfirmingTemplate(inc);
    setConfirmingAmount(String(inc.amount || 0));
  };

  const handleMarkAsRegistered = async (inc: RecurringIncome) => {
    try {
      const todayISO = new Date().toISOString();
      const now = new Date();
      const todayShort = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      await dbService.updateItem('recurring_incomes', inc.id, {
        lastAppliedDate: todayShort
      });

      toast.success(`Se marcó "${inc.name}" como ya registrado para este período sin modificar saldos ni transacciones.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el estado del ingreso');
    }
  };

  const handleApplyIncomeConfirm = async () => {
    if (!confirmingTemplate) return;
    const inc = confirmingTemplate;
    const account = accounts.find(a => a.id === inc.accountId);
    if (!account) {
      toast.error('La cuenta asociada ya no existe');
      return;
    }

    const correctedAmount = parseFloat(confirmingAmount);
    if (isNaN(correctedAmount) || correctedAmount <= 0) {
      toast.error('Por favor ingresa un monto de ingreso alternativo o principal válido');
      return;
    }

    try {
      const todayISO = new Date().toISOString();
      const now = new Date();
      const todayShort = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Create Transaction
      await dbService.addItem('transactions', {
        amount: correctedAmount,
        type: 'income',
        categoryId: inc.categoryId,
        accountId: inc.accountId,
        date: todayISO,
        description: `${inc.name} (Sueldo/Ingreso Recurrente Confirmado)`,
        isEventual: false
      });

      // 2. Update Account balance
      const currentBalance = Number(account.balance) || 0;
      await dbService.updateItem('accounts', account.id, {
        balance: currentBalance + correctedAmount
      });

      // 3. Update Last applied date
      await dbService.updateItem('recurring_incomes', inc.id, {
        lastAppliedDate: todayShort
      });

      toast.success(`¡Monto de $${correctedAmount.toLocaleString('es-ES')} cargado exitosamente a la cuenta "${account.name}"!`);
      setConfirmingTemplate(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al aplicar el ingreso en el sistema');
    }
  };

  // Check which incomes are "payable today"
  const pendingNotificationIncomes = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1 to 12
    const currentYear = today.getFullYear();

    // Helper to check if a month matches the custom frequency startMonth
    const isIncomeDueInMonth = (frequency: string | undefined, startMonth: number | undefined, targetMonth: number): boolean => {
      if (!frequency || frequency === 'mensual' || frequency === 'quincenal') {
        return true;
      }
      const sMonth = startMonth || 1; // Default to Enero (1)
      if (frequency === 'anual') {
        return targetMonth === sMonth;
      }
      if (frequency === 'semestral') {
        return (targetMonth - sMonth + 12) % 6 === 0;
      }
      if (frequency === 'trimestral') {
        return (targetMonth - sMonth + 12) % 3 === 0;
      }
      if (frequency === 'bimestral') {
        return (targetMonth - sMonth + 12) % 2 === 0;
      }
      return true;
    };

    // Helper to check if an income was already applied in the current cycle
    const hasBeenAppliedInCurrentPeriod = (inc: RecurringIncome) => {
      if (!inc.lastAppliedDate) return false;

      const [appYear, appMonth, appDay] = inc.lastAppliedDate.split('-').map(Number);
      if (appYear !== currentYear || appMonth !== currentMonth) {
        return false;
      }

      if (inc.frequency === 'quincenal') {
        if (currentDay <= 15) {
          return appDay <= 15;
        } else {
          return appDay > 15;
        }
      }

      return true;
    };

    return incomes.filter(inc => {
      if (!inc.active) return false;

      // If it was already registered/applied in the current period, do not show
      if (hasBeenAppliedInCurrentPeriod(inc)) {
        return false;
      }

      // Check if current month is due
      const isDueThisMonth = isIncomeDueInMonth(inc.frequency, inc.startMonth, currentMonth);

      // 1. Is today exactly the due day?
      const isTodayDue = isDueThisMonth && currentDay === inc.dayOfMonth;

      // 2. Is today exactly one day before the due day?
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const tomorrowMonth = tomorrow.getMonth() + 1;
      const isTomorrowDueMonth = isIncomeDueInMonth(inc.frequency, inc.startMonth, tomorrowMonth);
      const isOneDayBefore = isTomorrowDueMonth && tomorrow.getDate() === inc.dayOfMonth;

      // 3. Is today after the due day?
      const isPastDue = isDueThisMonth && (inc.dayOfMonth <= currentDay);

      return isTodayDue || isOneDayBefore || isPastDue;
    });
  }, [incomes]);

  return (
    <div className="space-y-6">
      {/* Alert Panel for Pending Salaries/Incomes */}
      {pendingNotificationIncomes.length > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 self-start text-emerald-700">
                <CheckCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-900 text-sm">¿Llegó tu pago? Registros recurrentes pendientes</h4>
                <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl font-medium">
                  Hemos detectado que estás cerca de la fecha para recibir tus ingresos recurrentes programados. 
                  Regístralos directo en tus cuentas con un solo click sin tener que llenar el formulario de nuevo.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
              {pendingNotificationIncomes.map(inc => (
                <div key={inc.id} className="flex flex-wrap items-center gap-2">
                  <Button 
                    onClick={() => handleApplyIncome(inc)}
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8.5 rounded-lg flex-1 sm:flex-none justify-center px-3"
                  >
                    <Play className="mr-1.5 size-3.5 fill-current" /> Recibir {inc.name} (${inc.amount.toLocaleString()}){!inc.active && " (🔄)"}
                  </Button>
                  <Button 
                    onClick={() => handleMarkAsRegistered(inc)}
                    variant="outline"
                    size="sm" 
                    className="bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800 h-8.5 rounded-lg font-bold flex-1 sm:flex-none justify-center px-3"
                  >
                    <Check className="size-3.5 mr-1 text-zinc-500" /> Ya Registrado
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Info and lists */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-250 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Briefcase className="size-5 text-indigo-500" />
            Configuración de Ingresos Recurrentes (Sueldos, Rendas, etc.)
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Define tus salarios, honorarios o ingresos mensuales fijos. Guarda el valor para agilizar los depósitos mensuales en tus cuentas.
          </p>
        </div>
        <Button onClick={handleOpenNewForm} className="bg-zinc-950 text-white hover:bg-zinc-800 font-bold">
          <Plus className="mr-1.5 size-4" /> Configurar Nuevo
        </Button>
      </div>

      {/* Creation/Edit dialogue drawer */}
      {isFormOpen && (
        <Card className="border-indigo-150 shadow-md bg-indigo-50/10">
          <CardHeader className="pb-3 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
                {editingId ? '🛠️ Modificar Plantilla de Ingreso' : '✨ Nueva Configuración Frecuente'}
              </CardTitle>
              <CardDescription className="text-xs text-indigo-650 mt-1">
                Establece el día aproximado y valor aproximado para registrarlo con un click.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500" onClick={() => setIsFormOpen(false)}>
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inc-name">Nombre / Concepto</Label>
                  <Input 
                    id="inc-name" 
                    placeholder="Ej. Salario Empresa SAS" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-amount">Monto ($)</Label>
                  <Input 
                    id="inc-amount" 
                    type="number"
                    step="0.01"
                    placeholder="1,200,000" 
                    className="font-mono font-bold"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-frequency" className="text-xs font-bold text-zinc-700">Periodicidad / Frecuencia</Label>
                  <Select 
                    value={formData.frequency} 
                    onValueChange={(v: any) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger id="inc-frequency" className="bg-white">
                      <SelectValue placeholder="Seleccione frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quincenal">📅 Quincenal</SelectItem>
                      <SelectItem value="mensual">📅 Mensual</SelectItem>
                      <SelectItem value="bimestral">📅 Bimestral</SelectItem>
                      <SelectItem value="trimestral">📅 Trimestral</SelectItem>
                      <SelectItem value="semestral">📅 Semestral</SelectItem>
                      <SelectItem value="anual">📅 Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-day">Día del período cobro aproximado</Label>
                  <Select 
                    value={formData.dayOfMonth} 
                    onValueChange={(v) => setFormData({ ...formData, dayOfMonth: v })}
                  >
                    <SelectTrigger id="inc-day">
                      <SelectValue placeholder="Seleccione día" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(day => (
                        <SelectItem key={day} value={day}>Día {day} de cobro</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.frequency !== 'mensual' && formData.frequency !== 'quincenal' && (
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3.5 animate-fade-in text-left">
                  <span className="text-xl">🗓️</span>
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="inc-start-month" className="text-xs font-black text-indigo-950">🗓️ ¿En qué mes se recibe el primer cobro?</Label>
                    <p className="text-[10.5px] text-zinc-500">Para frecuencias especiales, necesitamos saber cuándo se inicia el ciclo para activar el aviso correctamente.</p>
                    <Select 
                      value={formData.startMonth} 
                      onValueChange={(v) => setFormData({ ...formData, startMonth: v })}
                    >
                      <SelectTrigger id="inc-start-month" className="h-9 w-full sm:w-56 mt-1 text-xs rounded-lg bg-white border-indigo-200 text-indigo-900 font-bold">
                        <SelectValue placeholder="Seleccione mes de inicio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">📅 Enero</SelectItem>
                        <SelectItem value="2">📅 Febrero</SelectItem>
                        <SelectItem value="3">📅 Marzo</SelectItem>
                        <SelectItem value="4">📅 Abril</SelectItem>
                        <SelectItem value="5">📅 Mayo</SelectItem>
                        <SelectItem value="6">📅 Junio</SelectItem>
                        <SelectItem value="7">📅 Julio</SelectItem>
                        <SelectItem value="8">📅 Agosto</SelectItem>
                        <SelectItem value="9">📅 Septiembre</SelectItem>
                        <SelectItem value="10">📅 Octubre</SelectItem>
                        <SelectItem value="11">📅 Noviembre</SelectItem>
                        <SelectItem value="12">📅 Diciembre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inc-account">Cuenta Destino por defecto</Label>
                  <Select 
                    value={formData.accountId} 
                    onValueChange={(v) => setFormData({ ...formData, accountId: v })}
                  >
                    <SelectTrigger id="inc-account">
                      <SelectValue placeholder="Cuentas disponibles" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} (${a.balance.toLocaleString()})</SelectItem>
                      ))}
                      {accounts.length === 0 && <SelectItem value="_" disabled>Crea una cuenta primero</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-category">Categoría asociada</Label>
                  <Select 
                    value={formData.categoryId} 
                    onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                  >
                    <SelectTrigger id="inc-category">
                      <SelectValue placeholder="Categorías de ingresos" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeCategories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      {incomeCategories.length === 0 && (
                        <SelectItem value="_" disabled>Crea una categoría de ingresos primero</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inc-description">Notas o Descripción opcional</Label>
                <Input 
                  id="inc-description" 
                  placeholder="Ej. Depósito quincenal de nómina" 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                      formData.active 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                    }`}
                  >
                    {formData.active ? '● Activo' : '○ Pausado'}
                  </button>
                  <span className="text-[10px] text-zinc-400">Si está pausado, no arrojará alertas pendientes.</span>
                </div>
                <div className="flex gap-2.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    Guardar Configuración
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Incomes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {incomes.map(inc => {
          const account = accounts.find(a => a.id === inc.accountId);
          const category = categories.find(c => c.id === inc.categoryId);
          const isAppliedThisMonth = inc.lastAppliedDate?.startsWith(format(new Date(), 'yyyy-MM'));

          return (
            <Card key={inc.id} className={`overflow-hidden transition-all ${
              !inc.active 
                ? 'opacity-60 border-dashed border-zinc-200 bg-zinc-50/50' 
                : 'hover:shadow-md'
            }`}>
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 bg-zinc-50">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <Badge variant="outline" className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border-indigo-150 uppercase tracking-widest">
                      🔄 {inc.frequency || 'mensual'}{inc.startMonth ? ` (Ini: Mes ${inc.startMonth})` : ''} • Día {inc.dayOfMonth}
                    </Badge>
                    <h4 className="font-extrabold text-zinc-800 text-base mt-1.5 leading-snug">{inc.name}</h4>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-7 hover:bg-zinc-200"
                      onClick={() => handleOpenEdit(inc)}
                    >
                      <Edit3 className="size-3.5 text-zinc-650" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-7 hover:bg-red-50 hover:text-red-500"
                      onClick={() => handleDelete(inc.id)}
                    >
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 flex flex-col justify-between h-[150px]">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-emerald-600 font-extrabold text-xl font-mono">${inc.amount.toLocaleString()}</span>
                    <button 
                      onClick={() => handleToggleActive(inc)}
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase transition-all ${
                        inc.active 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-zinc-150 text-zinc-500 hover:bg-zinc-250'
                      }`}
                    >
                      {inc.active ? 'Activo' : 'Pausado'}
                    </button>
                  </div>

                  {inc.description && (
                    <p className="text-zinc-500 text-[11px] font-sans leading-normal italic truncate">
                      {inc.description}
                    </p>
                  )}

                  <div className="flex flex-col gap-1 text-[11px] leading-relaxed pt-1 border-t border-dashed border-zinc-200 mt-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <CreditCard className="size-3 text-zinc-400" />
                      <span>Destino:</span>
                      <strong className="text-zinc-700 truncate">{account?.name || '---'}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Clock className="size-3 text-zinc-400" />
                      <span>Último pago:</span>
                      <strong className="text-zinc-700 font-mono">
                        {inc.lastAppliedDate 
                          ? format(parseISO(inc.lastAppliedDate), 'dd/MM/yyyy') 
                          : 'Nunca registrado'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => handleApplyIncome(inc)}
                    disabled={!inc.active}
                    size="sm"
                    className={`w-full text-xs font-bold leading-none ${
                      isAppliedThisMonth 
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    }`}
                  >
                    {isAppliedThisMonth 
                      ? '🔄 Volver a duplicar este mes' 
                      : '⚡ Confirmar recibo este mes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {incomes.length === 0 && (
          <div className="col-span-full py-12 text-center rounded-xl border-2 border-dashed border-zinc-200 bg-white">
            <TrendingUp className="mx-auto mb-2 size-10 text-zinc-300" />
            <h5 className="font-extrabold text-zinc-700 text-sm">No hay ingresos recurrentes configurados</h5>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Presiona el botón de arriba para configurar tu salario o renta recurrente.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal to confirm and/or correct the Recurring Income block */}
      {confirmingTemplate && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-sm border border-zinc-200 bg-white p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 flex items-center gap-1.5">
                  💰 Confirmar Monto Recibido
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Revisa o ajusta el monto final para <strong className="text-zinc-800">"{confirmingTemplate.name}"</strong> antes de agregarlo al balance.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-8 rounded-full text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                onClick={() => setConfirmingTemplate(null)}
              >
                <X className="size-4.5" />
              </Button>
            </div>

            <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-150 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-450">Frecuencia programada:</span>
                <span className="font-black uppercase text-indigo-700">
                  {confirmingTemplate.frequency || 'mensual'}{confirmingTemplate.startMonth ? ` (Ini: Mes ${confirmingTemplate.startMonth})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Cuenta receptora:</span>
                <span className="font-bold text-zinc-850">
                  {accounts.find(a => a.id === confirmingTemplate.accountId)?.name || '---'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Categoría contable:</span>
                <span className="font-bold text-zinc-850">
                  {categories.find(c => c.id === confirmingTemplate.categoryId)?.name || '---'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-amount" className="text-xs font-bold text-zinc-700">Monto del Ingreso Real ($)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs font-black">$</span>
                <Input 
                  id="confirm-amount"
                  type="number"
                  step="0.01"
                  className="h-9.5 text-xs pl-7 font-mono font-extrabold text-emerald-600 rounded-xl"
                  value={confirmingAmount}
                  onChange={(e) => setConfirmingAmount(e.target.value)}
                />
              </div>
              <span className="text-[9px] text-zinc-450 italic leading-normal block">
                * Al confirmar, se generará una transacción de ingreso y se sumará al saldo actual de la cuenta.
              </span>
            </div>

            <div className="flex justify-end gap-2.5 pt-1.5 border-t border-zinc-100">
              <Button 
                variant="outline" 
                className="text-xs h-9 rounded-xl font-medium"
                onClick={() => setConfirmingTemplate(null)}
              >
                Cancelar
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl px-4 flex items-center gap-1"
                onClick={handleApplyIncomeConfirm}
              >
                Confirmar y Cargar Saldo
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
