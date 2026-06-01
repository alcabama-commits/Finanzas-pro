import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Account, Category, UserSettings, RecurringIncome } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  Calendar, 
  ShoppingBag, 
  Wallet,
  Coins,
  CheckCircle,
  Play,
  Edit2,
  Clock,
  Briefcase,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart, 
  Pie,
  Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfToday, getDate, endOfToday, lastDayOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface OverviewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  settings: UserSettings | null;
}

export function Overview({ transactions, accounts, categories, settings }: OverviewProps) {
  const [incomes, setIncomes] = useState<RecurringIncome[]>([]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<RecurringIncome | null>(null);
  
  const [confirmForm, setConfirmForm] = useState({
    amount: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Subscribe to recurring incomes inside Overview
  useEffect(() => {
    const unsubIncomes = dbService.subscribeToCollection('recurring_incomes', setIncomes);
    return () => {
      unsubIncomes();
    };
  }, []);

  // Quick direct confirmation helper
  const handleDirectConfirm = async (inc: RecurringIncome) => {
    const account = accounts.find(a => a.id === inc.accountId);
    if (!account) {
      toast.error('La cuenta asociada por defecto ya no existe. Elige "Editar y Registrar" para cambiar de cuenta.');
      return;
    }

    try {
      const todayISO = new Date().toISOString();
      const todayShort = todayISO.split('T')[0];

      // 1. Create Transaction
      await dbService.addItem('transactions', {
        amount: inc.amount,
        type: 'income',
        categoryId: inc.categoryId,
        accountId: inc.accountId,
        date: todayISO,
        description: `${inc.name} (Sueldo/Ingreso Recurrente Automático)`,
        isEventual: false
      });

      // 2. Update Account balance
      const currentBalance = Number(account.balance) || 0;
      await dbService.updateItem('accounts', account.id, {
        balance: currentBalance + inc.amount
      });

      // 3. Update Last applied date
      await dbService.updateItem('recurring_incomes', inc.id, {
        lastAppliedDate: todayShort
      });

      toast.success(`💰 ¡Logrado! Se depositaron $${inc.amount.toLocaleString()} en la cuenta "${account.name}" con éxito.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el depósito en el sistema');
    }
  };

  // Mark as already registered (dismiss from notifications)
  const handleMarkAsRegistered = async (inc: RecurringIncome) => {
    try {
      const todayISO = new Date().toISOString();
      const todayShort = todayISO.split('T')[0];

      // Update Last applied date so it disappears from the current cycle
      await dbService.updateItem('recurring_incomes', inc.id, {
        lastAppliedDate: todayShort
      });

      toast.success(`Se marcó "${inc.name}" como ya registrado para este período sin modificar tus saldos ni transacciones.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el estado del ingreso');
    }
  };

  // Launch modal to adjust details first
  const handleOpenAdjustConfirm = (inc: RecurringIncome) => {
    setSelectedIncome(inc);
    setConfirmForm({
      amount: String(inc.amount),
      accountId: inc.accountId,
      date: new Date().toISOString().split('T')[0],
      notes: `${inc.name} (Verificado y Ajustado)`
    });
    setIsConfirmDialogOpen(true);
  };

  // Handle submit from the modal
  const handleSaveAdjustedDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncome) return;

    const value = parseFloat(confirmForm.amount);
    if (isNaN(value) || value <= 0) {
      toast.error('El monto debe ser un valor positivo válido');
      return;
    }

    if (!confirmForm.accountId) {
      toast.error('Selecciona una cuenta de destino');
      return;
    }

    const account = accounts.find(a => a.id === confirmForm.accountId);
    if (!account) {
      toast.error('La cuenta destino no existe');
      return;
    }

    try {
      const receiveDateISO = new Date(confirmForm.date).toISOString();
      const receiveDateShort = confirmForm.date;

      // 1. Create Transaction record
      await dbService.addItem('transactions', {
        amount: value,
        type: 'income',
        categoryId: selectedIncome.categoryId,
        accountId: confirmForm.accountId,
        date: receiveDateISO,
        description: `${selectedIncome.name} (Sueldo/Ingreso Verificado)`,
        isEventual: false
      });

      // 2. Update recipient balance
      const currentBalance = Number(account.balance) || 0;
      await dbService.updateItem('accounts', account.id, {
        balance: currentBalance + value
      });

      // 3. Mark lastAppliedDate on model
      await dbService.updateItem('recurring_incomes', selectedIncome.id, {
        lastAppliedDate: receiveDateShort
      });

      toast.success(`💰 ¡Excelente! Registrado depósito verificado de $${value.toLocaleString()} en "${account.name}".`);
      setIsConfirmDialogOpen(false);
      setSelectedIncome(null);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo verificar el ingreso planificado en el sistema.');
    }
  };

  // Calculate pending paydays
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
  const currentPeriod = useMemo(() => {
    const today = startOfToday();
    const day = getDate(today);
    
    if (settings?.billingCycle === '15') {
      if (day <= 15) {
        return {
          start: startOfMonth(today),
          end: new Date(today.getFullYear(), today.getMonth(), 15, 23, 59, 59),
          label: 'Primera Quincena (1-15)'
        };
      } else {
        return {
          start: new Date(today.getFullYear(), today.getMonth(), 16),
          end: endOfMonth(today),
          label: 'Segunda Quincena (16-Fin)'
        };
      }
    }
    
    return {
      start: startOfMonth(today),
      end: endOfMonth(today),
      label: format(today, 'MMMM', { locale: es })
    };
  }, [settings?.billingCycle]);

  const periodTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return isWithinInterval(tDate, { start: currentPeriod.start, end: currentPeriod.end });
    });
  }, [transactions, currentPeriod]);

  const stats = useMemo(() => {
    const income = periodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Total expenses
    const expenses = periodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Filtered by eventuality
    const expensesEventual = periodTransactions
      .filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return t.type === 'expense' && (t.isEventual || cat?.isEventual);
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expensesRecurrent = expenses - expensesEventual;

    // Total purchases
    const purchases = periodTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);

    const purchasesEventual = periodTransactions
      .filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return t.type === 'purchase' && (t.isEventual || cat?.isEventual);
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const purchasesRecurrent = purchases - purchasesEventual;

    const totalEgresosEventual = expensesEventual + purchasesEventual;
    const totalEgresosRecurrent = expensesRecurrent + purchasesRecurrent;
    
    const balance = income - expenses - purchases;
    const totalBalanceAcrossAccounts = accounts.reduce((sum, a) => sum + a.balance, 0);

    return { 
      income, 
      expenses, 
      expensesRecurrent,
      expensesEventual,
      purchases, 
      purchasesRecurrent,
      purchasesEventual,
      totalEgresosEventual,
      totalEgresosRecurrent,
      balance, 
      totalBalanceAcrossAccounts 
    };
  }, [periodTransactions, accounts, categories]);

  const limitProgress = useMemo(() => {
    if (!settings?.monthlyLimit) return 0;
    const totalOutflow = stats.expenses + stats.purchases;
    return Math.min(100, (totalOutflow / settings.monthlyLimit) * 100);
  }, [stats.expenses, stats.purchases, settings?.monthlyLimit]);

  const chartData = useMemo(() => {
    // Group transactions by date for the current period
    const days: Record<string, { Gasto: number, Compra: number }> = {};
    periodTransactions.forEach(t => {
      const d = format(new Date(t.date), 'dd/MM');
      if (!days[d]) days[d] = { Gasto: 0, Compra: 0 };
      if (t.type === 'expense') {
        days[d].Gasto += t.amount;
      } else if (t.type === 'purchase') {
        days[d].Compra += t.amount;
      }
    });

    return Object.entries(days)
      .map(([name, data]) => ({ name, Gasto: data.Gasto, Compra: data.Compra }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [periodTransactions]);

  const categoryData = useMemo(() => {
    const cats: Record<string, { value: number, color: string }> = {};
    periodTransactions.filter(t => t.type === 'expense' || t.type === 'purchase').forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Otros';
      const color = cat?.color || '#A1A1AA';
      
      if (!cats[name]) cats[name] = { value: 0, color };
      cats[name].value += t.amount;
    });

    return Object.entries(cats).map(([name, data]) => ({ name, ...data }));
  }, [periodTransactions, categories]);

  return (
    <div className="space-y-6">
      {/* Alert if reaching limit */}
      {settings?.monthlyLimit && limitProgress >= 80 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-4 text-amber-900">
            <AlertCircle className="size-6 text-amber-600 shrink-0" />
            <div className="flex-grow">
              <p className="font-bold">¡Atención! Te estás acercando a tu límite de pagos.</p>
              <p className="text-sm opacity-90">
                Has utilizado el {limitProgress.toFixed(1)}% de tu límite fijado (${settings.monthlyLimit.toLocaleString()}) en egresos de este periodo ({currentPeriod.label}).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Section: Pending Recurring Incomes */}
      {pendingNotificationIncomes.length > 0 && (
        <Card className="border-emerald-250 bg-gradient-to-r from-emerald-50/50 via-white to-white shadow-sm overflow-hidden animate-fade-in">
          <CardHeader className="pb-3 border-b border-zinc-100/50 bg-emerald-50/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <Coins className="size-5 shrink-0" />
              </div>
              <div>
                <CardTitle className="text-emerald-950 font-bold text-sm tracking-wide uppercase">
                  ✓ Verificación de Ingresos Frecuentes
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600 mt-0.5">
                  Estás en rango de cobro de tus ingresos recurrentes de este ciclo. Confirma su ingreso real para cargarlos automáticamente en tus cuentas de balance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingNotificationIncomes.map(inc => {
                const targetAccount = accounts.find(a => a.id === inc.accountId);
                return (
                  <div key={inc.id} className="p-3.5 bg-white border border-zinc-200 hover:border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all duration-200">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                          Día de Pago: {inc.dayOfMonth}
                        </Badge>
                        {!inc.active && (
                          <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-800 font-bold border-none">
                            🔄 Reactivado para Confirmar
                          </Badge>
                        )}
                        <span className="text-[10px] text-indigo-600 font-mono font-semibold uppercase bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150">
                          {inc.frequency || 'mensual'}{inc.startMonth ? ` (Inicio: Mes ${inc.startMonth})` : ''}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-zinc-900 text-sm truncate">{inc.name}</h4>
                      <p className="text-xs font-bold text-emerald-600 font-mono">
                        + ${inc.amount.toLocaleString()} <span className="text-zinc-400 text-[10px] font-sans font-medium">en {targetAccount?.name || 'Cuenta de cobro'}</span>
                      </p>
                    </div>

                    <div className="flex gap-2 self-start sm:self-center shrink-0 w-full sm:w-auto">
                      <Button 
                        onClick={() => handleOpenAdjustConfirm(inc)}
                        variant="outline" 
                        size="sm" 
                        type="button"
                        className="text-xs font-bold px-3 border-zinc-250 flex-grow sm:flex-grow-0 h-9 text-zinc-700 hover:bg-zinc-50"
                      >
                        <Edit2 className="size-3 mr-1" /> Ajustar
                      </Button>
                      <Button 
                        onClick={() => handleDirectConfirm(inc)}
                        size="sm" 
                        type="button"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 flex-grow sm:flex-grow-0 h-9 shadow-sm"
                      >
                        <CheckCircle className="size-3 mr-1.5" /> Recibir Pago
                      </Button>
                      <Button 
                        onClick={() => handleMarkAsRegistered(inc)}
                        variant="outline" 
                        size="sm" 
                        type="button"
                        className="text-xs font-bold px-3 border hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800 flex-grow sm:flex-grow-0 h-9"
                      >
                        <Check className="size-3.5 mr-1 text-zinc-500" /> Ya Registrado
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Section: Activos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <div className="size-3 rounded-full bg-emerald-500" />
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 uppercase">Activos</h3>
          <span className="text-xs text-zinc-500 font-medium font-sans">(Ingresos y Fondos que suman valor)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard 
            title="Saldos en Cuentas" 
            value={stats.totalBalanceAcrossAccounts} 
            icon={<Wallet className="text-blue-600 size-5" />} 
            description="Fondos disponibles actuales en tus cuentas y activos"
            color="text-blue-600"
          />
          <StatCard 
            title="Ingresos del Periodo" 
            value={stats.income} 
            icon={<TrendingUp className="text-emerald-600 size-5" />} 
            description={`Ingresos recibidos en ${currentPeriod.label}`}
            color="text-emerald-600"
          />
        </div>
      </div>

      {/* Visual Section: Pasivos */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <div className="size-3 rounded-full bg-rose-500" />
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 uppercase">Pasivos</h3>
          <span className="text-xs text-zinc-500 font-medium font-sans">(Egresos, Compras y Salidas de dinero)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Pagos del Periodo" 
            value={stats.expenses} 
            icon={<TrendingDown className="text-rose-600 size-5" />} 
            description={
              <div className="space-y-1 mt-1">
                <p className="opacity-90 leading-relaxed">Pagos/obligaciones fijos y eventuales de {currentPeriod.label}.</p>
                <div className="flex justify-between items-center text-[10px] border-t border-zinc-100 pt-1 font-semibold">
                  <span className="text-zinc-400">🔄 Mensual Fijo:</span>
                  <span className="text-zinc-700">${stats.expensesRecurrent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] pb-0.5 font-semibold">
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">📅 Pagos Eventuales:</span>
                  <span className="text-amber-700">${stats.expensesEventual.toLocaleString()}</span>
                </div>
              </div>
            }
            color="text-rose-600"
          />
          <StatCard 
            title="Compras Realizadas" 
            value={stats.purchases} 
            icon={<ShoppingBag className="text-blue-600 size-5" />} 
            description={
              <div className="space-y-1 mt-1">
                <p className="opacity-90 leading-relaxed font-sans">Adquisiciones de consumo y compras eventuales.</p>
                <div className="flex justify-between items-center text-[10px] border-t border-zinc-100 pt-1 font-semibold">
                  <span className="text-zinc-400">🔄 Consumo Regular:</span>
                  <span className="text-zinc-700">${stats.purchasesRecurrent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] pb-0.5 font-semibold">
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">📅 Compras Eventuales:</span>
                  <span className="text-amber-700">${stats.purchasesEventual.toLocaleString()}</span>
                </div>
              </div>
            }
            color="text-blue-600"
          />
          <Card className="relative overflow-hidden border-rose-100 bg-rose-50/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center justify-between">
                <span>Límite de Consumo</span>
                <Badge variant="outline" className="text-[10px] bg-white border-rose-200 text-rose-700 font-bold uppercase animate-pulse">
                  {currentPeriod.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-rose-700">${(stats.expenses + stats.purchases).toLocaleString()}</span>
                <span className="text-xs text-zinc-500">límite: ${settings?.monthlyLimit.toLocaleString()}</span>
              </div>
              <Progress value={limitProgress} className="h-2 bg-rose-100" />
              <div className="space-y-1.5 mt-2.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium">
                  <span>🔄 Consumo Regular:</span>
                  <span className="font-bold text-zinc-700">${stats.totalEgresosRecurrent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium">
                  <span>📅 Egresos Eventuales:</span>
                  <span className="font-bold text-amber-700">${stats.totalEgresosEventual.toLocaleString()}</span>
                </div>
                <p className="text-[9px] text-zinc-405 leading-relaxed italic border-t border-dashed border-zinc-200 pt-1">
                  Pagos eventuales (ropa, tecnología, impuestos anuales) no cuentan como compromisos fijos mensuales.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-zinc-500" />
              Pasivos Diarios (Pago vs Compra) - {currentPeriod.label}
            </CardTitle>
            <CardDescription>
              Seguimiento comparativo diario de tus pagos fijos contra adquisiciones/compras.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    cursor={{ fill: '#f5f5f5' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Gasto" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" name="Pago / Obligación" />
                  <Bar dataKey="Compra" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" name="Compra" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                No hay transacciones registradas de tipo Pago o Compra en esta quincena/periodo.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pasivos por Categoría</CardTitle>
            <CardDescription>Visualización global del periodo</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col justify-between">
            {categoryData.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                         formatter={(v: number) => [`$${v.toLocaleString()}`, 'Consumido']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5 overflow-y-auto max-h-[100px] pr-1">
                  {categoryData.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-zinc-600 truncate">{c.name}</span>
                      </div>
                      <span className="font-semibold shrink-0">${c.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                Sin egresos reportados en este ciclo quincenal/mensual.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog to custom adjust & verify recurring income */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        {selectedIncome && (
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-zinc-900">
                <Coins className="size-5 text-emerald-600" />
                Controlar y Recibir Pago Recurrente
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Modifica los datos reales de este depósito (monto final recibido, cuenta o fecha) antes de que se contabilice en tus balances activos.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveAdjustedDeposit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="income-name" className="text-xs font-bold text-zinc-550">Concepto de Ingreso</Label>
                <Input 
                  id="income-name" 
                  value={selectedIncome.name} 
                  disabled 
                  className="bg-zinc-50 border-zinc-200 text-zinc-600 font-bold font-sans"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-amount" className="text-xs font-bold text-zinc-550">Monto Real Recibido ($)</Label>
                <Input 
                  id="confirm-amount" 
                  type="number"
                  step="0.01"
                  required
                  placeholder="3,500,000" 
                  value={confirmForm.amount}
                  onChange={(e) => setConfirmForm({ ...confirmForm, amount: e.target.value })}
                />
                <span className="text-[10px] text-zinc-400 block font-normal">Modifica el valor neto si hubo retenciones, horas extra o deducciones este mes.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm-account" className="text-xs font-bold text-zinc-550">Buzón de Depósito</Label>
                  <Select 
                    value={confirmForm.accountId} 
                    onValueChange={(v) => setConfirmForm({ ...confirmForm, accountId: v })}
                  >
                    <SelectTrigger id="confirm-account">
                      <SelectValue placeholder="Elige cuenta receptora..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} (${a.balance.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-date" className="text-xs font-bold text-zinc-550">Fecha de Depósito</Label>
                  <Input 
                    id="confirm-date" 
                    type="date"
                    required
                    value={confirmForm.date}
                    onChange={(e) => setConfirmForm({ ...confirmForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-notes" className="text-xs font-bold text-zinc-550 font-sans">Notas adicionales del abono</Label>
                <Input 
                  id="confirm-notes" 
                  placeholder="Ej. Consignación de nómina de la quincena regular" 
                  value={confirmForm.notes}
                  onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
                />
              </div>

              <DialogFooter className="pt-4 flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-10 text-xs font-bold"
                  onClick={() => {
                    setIsConfirmDialogOpen(false);
                    setSelectedIncome(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs px-5 shadow-sm"
                >
                  Confirmar Depósito Verificado
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon, description, color }: { 
  title: string, 
  value: number, 
  icon: React.ReactNode, 
  description: React.ReactNode,
  color?: string
}) {
  return (
    <Card className="hover:border-zinc-300 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</CardTitle>
        <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-extrabold ${color || 'text-zinc-900'}`}>
          ${value.toLocaleString()}
        </div>
        <div className="text-xs text-zinc-500 mt-1.5 font-sans font-medium">{description}</div>
      </CardContent>
    </Card>
  );
}
