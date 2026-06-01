import React, { useState, useEffect, useMemo } from 'react';
import { Debt, DebtPayment, Account, Category } from '@/src/types';
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
  Building2, 
  HandCoins,
  DollarSign,
  Calendar, 
  ChevronRight,
  Plus, 
  Trash2, 
  Edit3, 
  Percent, 
  Clock, 
  FileText,
  Bookmark,
  Activity,
  Award,
  CircleDollarSign,
  Briefcase,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ListFilter,
  Flame,
  Snowflake,
  ShieldAlert,
  X,
  CreditCard,
  Wallet
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function DebtsView() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI Panels / States
  const [activeStrategy, setActiveStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');

  // Editing state
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  // Debt Form Fields
  const [debtForm, setDebtForm] = useState({
    name: '',
    creditor: '',
    totalAmount: '',
    remainingAmount: '',
    interestRate: '0',
    dueDate: '',
    minimumPayment: '',
    status: 'active' as 'active' | 'paid',
    type: 'general' as 'general' | 'credit_card' | 'revolving',
    description: ''
  });

  // Payment Form Fields
  const [paymentForm, setPaymentForm] = useState({
    debtId: '',
    amount: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Load subscriptions
  useEffect(() => {
    const unsubDebts = dbService.subscribeToCollection('debts', setDebts);
    const unsubPayments = dbService.subscribeToCollection('debt_payments', setPayments);
    const unsubAccounts = dbService.subscribeToCollection('accounts', setAccounts);
    const unsubCategories = dbService.subscribeToCollection('categories', setCategories);

    return () => {
      unsubDebts();
      unsubPayments();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'expense');
  }, [categories]);

  // Overall Financial Debt Stats
  const stats = useMemo(() => {
    const activeDebts = debts.filter(d => d.status === 'active');
    
    const totalOriginalDebt = debts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const totalRemainingDebt = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    const totalSavingsOrPaid = Math.max(0, totalOriginalDebt - totalRemainingDebt);
    
    const paidPercentage = totalOriginalDebt > 0 ? (totalSavingsOrPaid / totalOriginalDebt) * 105 : 0; 
    const realPercentage = totalOriginalDebt > 0 ? (totalSavingsOrPaid / totalOriginalDebt) * 100 : 0;

    const totalMinDue = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
    const numPaidDebts = debts.filter(d => d.status === 'paid').length;

    // Weighted average interest rate of active debts
    const activeRemaining = activeDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    let weightedIntRateSum = 0;
    if (activeRemaining > 0) {
      activeDebts.forEach(d => {
        weightedIntRateSum += (d.interestRate || 0) * (d.remainingAmount || 0);
      });
    }
    const avgInterestRate = activeRemaining > 0 ? (weightedIntRateSum / activeRemaining) : 0;

    return {
      totalOriginalDebt,
      totalRemainingDebt,
      totalPaidAmount: totalSavingsOrPaid,
      paidRatio: realPercentage,
      totalMinDue,
      avgInterestRate,
      activeCount: activeDebts.length,
      paidCount: numPaidDebts
    };
  }, [debts]);

  // Sorting list by strategy
  // - Bola de Nieve (Snowball): Active debts sorted by remainingAmount (lowest to highest)
  // - Avalancha (Avalanche): Active debts sorted by interestRate (highest to lowest)
  const prioritizedActiveDebts = useMemo(() => {
    const active = debts.filter(d => d.status === 'active');
    if (activeStrategy === 'snowball') {
      return [...active].sort((a, b) => a.remainingAmount - b.remainingAmount);
    } else {
      return [...active].sort((a, b) => b.interestRate - a.interestRate);
    }
  }, [debts, activeStrategy]);

  // Edit Debt Dialog Opener
  const handleOpenEditDebt = (d: Debt) => {
    setEditingDebtId(d.id);
    setDebtForm({
      name: d.name,
      creditor: d.creditor,
      totalAmount: String(d.totalAmount),
      remainingAmount: String(d.remainingAmount),
      interestRate: String(d.interestRate || 0),
      dueDate: d.dueDate || '',
      minimumPayment: String(d.minimumPayment || 0),
      status: d.status,
      type: d.type || 'general',
      description: d.description || ''
    });
    setIsDebtFormOpen(true);
  };

  // Create/Update Debt Trigger
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, creditor, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate } = debtForm;

    if (!name.trim() || !creditor.trim() || !totalAmount) {
      toast.error('Completa los campos obligatorios: Nombre, Acreedor y Total Prestado');
      return;
    }

    const principal = parseFloat(totalAmount);
    let remaining = remainingAmount ? parseFloat(remainingAmount) : principal;

    if (isNaN(principal) || principal <= 0) {
      toast.error('Monto Total Prestado inválido');
      return;
    }

    if (remaining > principal) {
      toast.error('El saldo restante no puede ser mayor al capital prestado original');
      return;
    }

    const rate = parseFloat(interestRate) || 0;
    const minPay = parseFloat(minimumPayment) || 0;
    const statusVal = remaining <= 0 ? 'paid' : debtForm.status;

    const finalDebtData = {
      name: name.trim(),
      creditor: creditor.trim(),
      totalAmount: principal,
      remainingAmount: remaining <= 0 ? 0 : remaining,
      interestRate: rate,
      minimumPayment: minPay,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      status: statusVal,
      type: debtForm.type || 'general',
      description: debtForm.description.trim()
    };

    try {
      if (editingDebtId) {
        await dbService.updateItem('debts', editingDebtId, finalDebtData);
        toast.success(`Deuda "${finalDebtData.name}" actualizada con éxito.`);
      } else {
        await dbService.addItem('debts', finalDebtData);
        toast.success(`Deuda registrada con "${finalDebtData.creditor}". Ya puedes planificar tus pagos.`);
      }
      setIsDebtFormOpen(false);
      setEditingDebtId(null);
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al guardar la deuda');
    }
  };

  // Delete Debt Wrapper
  const handleDeleteDebt = async (debtId: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la deuda de "${name}"? Esto borrará también sus registros de amortización.`)) return;

    try {
      // 1. Delete associated payments first
      const associatedPayments = payments.filter(p => p.debtId === debtId);
      for (const p of associatedPayments) {
        await dbService.deleteItem('debt_payments', p.id);
      }
      // 2. Delete actual debt
      await dbService.deleteItem('debts', debtId);
      toast.success('Deuda y amortizaciones eliminadas');
    } catch (err) {
      toast.error('Error al intentar eliminar');
    }
  };

  // Fast Payment dialog launcher
  const handleOpenPaymentModal = (debtId: string) => {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    setPaymentForm({
      debtId: debtId,
      amount: String(debt.minimumPayment || ''),
      accountId: accounts[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsPaymentFormOpen(true);
  };

  // Submitting a payment (reducts account, creates txn, lowers remaining debt)
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { debtId, amount, accountId, date, notes } = paymentForm;

    if (!debtId || !amount || !accountId) {
      toast.error('Completa los campos obligatorios: Deuda, Monto y Cuenta de retiro');
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      toast.error('El monto pagado debe ser mayor a cero');
      return;
    }

    const debt = debts.find(d => d.id === debtId);
    if (!debt) {
      toast.error('La deuda asociada ya no existe');
      return;
    }

    if (value > debt.remainingAmount) {
      toast.error(`No puedes abonar un monto ($${value.toLocaleString()}) superior a la deuda actual ($${debt.remainingAmount.toLocaleString()})`);
      return;
    }

    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      toast.error('La cuenta seleccionada no existe');
      return;
    }

    const currentBalance = Number(account.balance) || 0;
    if (currentBalance < value) {
      const confirmAnyway = confirm(`Saldo insuficiente en "${account.name}". Tu cuenta quedará en negativo ($${(currentBalance - value).toLocaleString()}). ¿Proceder de todos modos?`);
      if (!confirmAnyway) return;
    }

    try {
      // 1. Deduct balance from the account
      await dbService.updateItem('accounts', account.id, {
        balance: currentBalance - value
      });

      // 2. Find/Match or build a proper category
      let categoryId = expenseCategories[0]?.id || '';
      const debtCat = expenseCategories.find(c => 
        c.name.toLowerCase().includes('deuda') || 
        c.name.toLowerCase().includes('préstamo') ||
        c.name.toLowerCase().includes('pago')
      );
      if (debtCat) {
        categoryId = debtCat.id;
      }

      // 3. Create Transaction item to show on history dashboards
      await dbService.addItem('transactions', {
        amount: value,
        type: 'expense',
        categoryId: categoryId || 'debts_payment', 
        accountId: account.id,
        date: new Date(date).toISOString(),
        description: `Servicio de Deuda: Abono a ${debt.name} (${debt.creditor})`,
        isEventual: false
      });

      // 4. Create local DebtPayment document
      await dbService.addItem('debt_payments', {
        debtId,
        amount: value,
        accountId,
        date,
        notes: notes.trim()
      });

      // 5. Update remaining amount of the main Debt structure
      const newRemaining = Math.max(0, debt.remainingAmount - value);
      const isNowPaid = newRemaining === 0;

      await dbService.updateItem('debts', debt.id, {
        remainingAmount: newRemaining,
        status: isNowPaid ? 'paid' : 'active'
      });

      toast.success(isNowPaid 
        ? `🎉 ¡Excelente logro! Has liquidado por completo tu deuda con "${debt.creditor}".` 
        : `Abono de $${value.toLocaleString()} registrado con éxito. Restan $${newRemaining.toLocaleString()}.`
      );

      setIsPaymentFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Hubo un error al registrar el pago de deuda.');
    }
  };

  // Reverting/Deleting a historic payment
  const handleRevertPayment = async (pay: DebtPayment) => {
    const parentDebt = debts.find(d => d.id === pay.debtId);
    const account = accounts.find(a => a.id === pay.accountId);

    if (!parentDebt) {
      toast.error('La deuda asociada a este pago ya no existe. No se puede revertir.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas revertir este abono por $${pay.amount.toLocaleString()}? Esto reestablecerá el saldo de la deuda y reembolsará el dinero a la cuenta seleccionada.`)) return;

    try {
      // 1. Return money to chosen account if exists
      if (account) {
        await dbService.updateItem('accounts', account.id, {
          balance: (Number(account.balance) || 0) + pay.amount
        });
      }

      // 2. Add amount back to Debt target
      await dbService.updateItem('debts', parentDebt.id, {
        remainingAmount: parentDebt.remainingAmount + pay.amount,
        status: 'active'
      });

      // 3. Delete Payment registry
      await dbService.deleteItem('debt_payments', pay.id);

      toast.success('El abono fue cancelado y los montos restablecidos en el sistema.');
    } catch (err) {
      console.error(err);
      toast.error('Error al revertir el abono de dinero');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Debt Health Dashboard Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Metric 1: Progress visual */}
        <Card className="lg:col-span-2 shadow-sm border border-zinc-250 bg-gradient-to-br from-zinc-50 to-white overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-zinc-500 font-extrabold text-[11px] uppercase tracking-wider">
                  Progreso de Desamortización General
                </CardTitle>
                <CardDescription className="text-xl font-bold text-zinc-800 font-sans">
                  Suma de Capital e Intereses Totales
                </CardDescription>
              </div>
              <HandCoins className="text-amber-500 size-6 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <span className="text-[10px] text-zinc-400 font-medium">Original Financiado:</span>
                <p className="text-lg font-black text-rose-650 font-mono">
                  ${stats.totalOriginalDebt.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-medium">Saldo por Pagar (Hoy):</span>
                <p className="text-xl font-black text-rose-500 font-mono">
                  ${stats.totalRemainingDebt.toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-zinc-200/50 sm:pl-4 pt-2 sm:pt-0">
                <span className="text-[10px] text-zinc-400 font-medium">Monto Histórico Pagado:</span>
                <p className="text-lg font-black text-emerald-600 font-mono">
                  ${stats.totalPaidAmount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-700">
                <span>Porcentaje de Alivio Financiero</span>
                <span className="font-mono text-emerald-600">{stats.paidRatio.toFixed(1)}%</span>
              </div>
              <Progress value={stats.paidRatio} className="h-2 bg-zinc-200" />
              <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                Has devuelto y liberado el <strong>{stats.paidRatio.toFixed(1)}%</strong> de tus fondos pendientes contraídos con acreedores bancarios o terceros.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Small Metrics Widgets Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card className="shadow-sm border border-zinc-250 bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Pago Mensual Mínimo</span>
                <p className="text-xl font-black text-zinc-800 font-mono">${stats.totalMinDue.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500">Mínimo total para el mes de activos.</p>
              </div>
              <div className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-650">
                <Calendar className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-zinc-250 bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Tasa Promedio Ponderada</span>
                <p className="text-xl font-black text-zinc-800 font-mono">{stats.avgInterestRate.toFixed(2)}% <span className="text-xs text-zinc-400 font-medium">E.A</span></p>
                <p className="text-[10px] text-zinc-500">Interés sobre capital adeudado actual.</p>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
                <Percent className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Recommended Strategy Visualizer Panel - To Help Organize Payoffs */}
      <Card className="shadow-sm border border-indigo-150 bg-gradient-to-r from-indigo-50/40 via-white to-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-indigo-900 font-bold text-sm tracking-wide flex items-center gap-2">
                <Activity className="size-4 text-indigo-505" />
                SISTEMA INTELIGENTE DE ORDENACIÓN DE PAGOS
              </CardTitle>
              <CardDescription className="text-xs text-indigo-650 mt-1">
                Elige un método y visualiza el orden exacto en el que debes concentrar tus amortizaciones extra para ahorrar dinero.
              </CardDescription>
            </div>
            
            {/* Strategy Selectors Toggle buttons */}
            <div className="flex bg-zinc-100 p-1 rounded-xl self-start sm:self-center border border-zinc-250 shrink-0">
              <button 
                onClick={() => setActiveStrategy('avalanche')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeStrategy === 'avalanche' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-zinc-650 hover:bg-zinc-200'
                }`}
              >
                <Flame className="size-3" /> Método Avalancha
              </button>
              <button 
                onClick={() => setActiveStrategy('snowball')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeStrategy === 'snowball' 
                    ? 'bg-teal-650 bg-teal-600 text-white shadow-sm' 
                    : 'text-zinc-650 hover:bg-zinc-200'
                }`}
              >
                <Snowflake className="size-3" /> Método Bola de Nieve
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs leading-relaxed text-zinc-600">
              {activeStrategy === 'avalanche' ? (
                <span>
                  💡 <strong>Método Avalancha:</strong> Ordena tus deudas de <strong>mayor a menor tasa de interés</strong>. 
                  Minimiza el interés acumulado en el tiempo. Debes pagar el mínimo obligatorio de todas las deudas y todo tu saldo extra inyectarlo en la primera de la lista.
                </span>
              ) : (
                <span>
                  💡 <strong>Método Bola de Nieve (Snowball):</strong> Ordena tus deudas de <strong>menor a mayor saldo restante</strong>. 
                  Te ayuda a obtener victorias psicológicas rápidas liquidando las cuentas pequeñas primero, liberando flujos de caja de forma acelerada.
                </span>
              )}
            </div>

            {/* List ordered priorities */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wide">Secuencia de Enfoque Priorizada</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {prioritizedActiveDebts.map((d, index) => (
                  <div key={d.id} className="relative p-3 bg-white border border-indigo-100 rounded-xl flex items-center gap-2.5 shadow-sm overflow-hidden group">
                    <div className="absolute top-0 right-0 py-0.5 px-2 bg-indigo-50 border-bl border-indigo-100 text-[10px] font-bold text-indigo-700">
                      #{index + 1}
                    </div>
                    
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      activeStrategy === 'avalanche' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {activeStrategy === 'avalanche' ? <Percent className="size-4" /> : <DollarSign className="size-4" />}
                    </div>

                    <div className="space-y-0.5 min-w-0 pr-6">
                      <h4 className="font-extrabold text-zinc-800 text-xs truncate">{d.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono font-medium truncate">
                        {activeStrategy === 'avalanche' ? `${d.interestRate}% Int.` : `$${d.remainingAmount.toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ))}

                {prioritizedActiveDebts.length === 0 && (
                  <div className="col-span-full py-2.5 text-center text-zinc-400 text-xs">
                    Sin deudas activas en el plan de pago. ¡Excelente estado de salud financiera!
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Header and Lists */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-zinc-250 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Building2 className="size-5 text-indigo-500" />
            Control de Acreedores y Registro de Amortizaciones
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Crea hipotecas, tarjetas de crédito, créditos de autos o préstamos personales. Reduce el monto con abonos.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {debts.length > 0 && (
            <Button 
              onClick={() => handleOpenPaymentModal(debts[0]?.id)} 
              variant="outline" 
              className="border-zinc-300 font-semibold text-zinc-700 text-xs gap-1.5 flex-1 sm:flex-none"
            >
              <CircleDollarSign className="size-4 text-emerald-600" /> Registrar Abono
            </Button>
          )}

          <Button 
            onClick={() => {
              setEditingDebtId(null);
              setDebtForm({
                name: '',
                creditor: '',
                totalAmount: '',
                remainingAmount: '',
                interestRate: '12',
                dueDate: '',
                minimumPayment: '',
                status: 'active',
                type: 'general',
                description: ''
              });
              setIsDebtFormOpen(true);
            }} 
            className="bg-zinc-950 text-white hover:bg-zinc-800 font-bold text-xs gap-1 py-4 flex-1 sm:flex-none"
          >
            <Plus className="size-4" /> Nueva Deuda
          </Button>
        </div>
      </div>

      {/* Creation/Edit dialogue drawer */}
      {isDebtFormOpen && (
        <Card className="border-indigo-150 shadow-md bg-zinc-50/10">
          <CardHeader className="pb-3 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                {editingDebtId ? '🛠️ Modificar Registro de Deuda' : '✨ Registrar Nueva Deuda Contractual'}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-1">
                Ingresa los datos del crédito para estructurar plazos y tasas.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500" onClick={() => setIsDebtFormOpen(false)}>
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveDebt} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="debt-name">Nombre descriptivo / Crédito</Label>
                  <Input 
                    id="debt-name" 
                    placeholder="Ej. Tarjeta de Crédito Principal" 
                    value={debtForm.name}
                    onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-creditor">Acreedor / Banco / Persona</Label>
                  <Input 
                    id="debt-creditor" 
                    placeholder="Ej. Banco de Bogotá / Amigo" 
                    value={debtForm.creditor}
                    onChange={(e) => setDebtForm({ ...debtForm, creditor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-total">Monto Original ($)</Label>
                  <Input 
                    id="debt-total" 
                    type="number"
                    step="0.01"
                    placeholder="25,000,000" 
                    value={debtForm.totalAmount}
                    onChange={(e) => setDebtForm({ ...debtForm, totalAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-type">Tipo de Pasivo</Label>
                  <select
                    id="debt-type"
                    className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-zinc-950"
                    value={debtForm.type || 'general'}
                    onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as any })}
                  >
                    <option value="general">🏛️ Préstamo / Hipoteca / General</option>
                    <option value="credit_card">💳 Tarjeta de Crédito</option>
                    <option value="revolving">🔄 Crédito Rotativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap- gap-4">
                <div className="space-y-2">
                  <Label htmlFor="debt-remaining">Saldo Pendiente Actual ($)</Label>
                  <Input 
                    id="debt-remaining" 
                    type="number"
                    step="0.01"
                    placeholder="Dejar vacío si es igual al total" 
                    value={debtForm.remainingAmount}
                    onChange={(e) => setDebtForm({ ...debtForm, remainingAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-rate">TASA DE INTERÉS (% E.A.)</Label>
                  <Input 
                    id="debt-rate" 
                    type="number"
                    step="0.01"
                    placeholder="Ej. 18.5" 
                    value={debtForm.interestRate}
                    onChange={(e) => setDebtForm({ ...debtForm, interestRate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-minimum">Pago Mensual Mínimo ($)</Label>
                  <Input 
                    id="debt-minimum" 
                    type="number"
                    step="0.01"
                    placeholder="Aproximado" 
                    value={debtForm.minimumPayment}
                    onChange={(e) => setDebtForm({ ...debtForm, minimumPayment: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-due">Próxima Fecha de Pago</Label>
                  <Input 
                    id="debt-due" 
                    type="date"
                    value={debtForm.dueDate}
                    onChange={(e) => setDebtForm({ ...debtForm, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="debt-desc">Detalles / Notas opcionales</Label>
                <Input 
                  id="debt-desc" 
                  placeholder="Detalles sobre plazo (36 meses), número de cuenta, etc." 
                  value={debtForm.description}
                  onChange={(e) => setDebtForm({ ...debtForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  {editingDebtId && (
                    <Select 
                      value={debtForm.status} 
                      onValueChange={(v: 'active' | 'paid') => setDebtForm({ ...debtForm, status: v })}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">● En amortización</SelectItem>
                        <SelectItem value="paid">✓ Liquidada (Pagada)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <span className="text-[10px] text-zinc-400">Las deudas liquidadas se excluyen de la estrategia de pagos.</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsDebtFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    Guardar Deuda
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Form Panel Drawer */}
      {isPaymentFormOpen && (
        <Card className="border-emerald-150 shadow-md bg-emerald-50/5">
          <CardHeader className="pb-3 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-2">
                <CircleDollarSign className="size-4 text-emerald-600" />
                Registrar Abono / Amortización de Deuda
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-1">
                Esto descontará fondos de la cuenta seleccionada, los asignará como gasto del mes y reducirá la deuda.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500" onClick={() => setIsPaymentFormOpen(false)}>
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-1">
                  <Label htmlFor="pay-debt">Selecciona la Deuda a Abonar</Label>
                  <Select 
                    value={paymentForm.debtId} 
                    onValueChange={(v) => {
                      const d = debts.find(x => x.id === v);
                      setPaymentForm({ 
                        ...paymentForm, 
                        debtId: v,
                        amount: d ? String(d.minimumPayment || '') : ''
                      });
                    }}
                  >
                    <SelectTrigger id="pay-debt">
                      <SelectValue placeholder="Elige una deuda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {debts.filter(d => d.status === 'active').map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} (${d.remainingAmount.toLocaleString()} pend.)
                        </SelectItem>
                      ))}
                      {debts.filter(d => d.status === 'active').length === 0 && (
                        <SelectItem value="none" disabled>No tienes deudas activas registradas</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-amount">Monto de Abono ($)</Label>
                  <Input 
                    id="pay-amount" 
                    type="number"
                    step="0.01"
                    placeholder="Monto a pagar" 
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-account">Origen (Cuenta de donde sale)</Label>
                  <Select 
                    value={paymentForm.accountId} 
                    onValueChange={(v) => setPaymentForm({ ...paymentForm, accountId: v })}
                  >
                    <SelectTrigger id="pay-account">
                      <SelectValue placeholder="Elige cuenta de retiro..." />
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
                  <Label htmlFor="pay-date">Fecha de Abono</Label>
                  <Input 
                    id="pay-date" 
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  />
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-notes">Notas / Descripción del Abono</Label>
                <Input 
                  id="pay-notes" 
                  placeholder="Ej. Transferencia abono extraordinario capital" 
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentFormOpen(false)}>Cancelar</Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Confirmar Pago y Descontar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reusable Debt Card Renderer to keep DRY */}
      {(() => {
        const creditCardsAndRevolving = debts.filter(d => d.type === 'credit_card' || d.type === 'revolving');
        const generalDebts = debts.filter(d => !d.type || d.type === 'general');

        const renderDebtCard = (d: Debt) => {
          const isCompleted = d.status === 'paid' || d.remainingAmount <= 0;
          const progressRatio = d.totalAmount > 0 ? ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100 : 0;
          const isCritical = !isCompleted && d.dueDate && new Date(d.dueDate) <= new Date();

          return (
            <Card key={d.id} className={`overflow-hidden transition-all ${
              isCompleted 
                ? 'p-0 border-zinc-200/50 opacity-65 bg-zinc-50' 
                : 'hover:shadow-md bg-white border-zinc-250 border-l-4 ' + (d.type === 'credit_card' ? 'border-l-rose-500' : d.type === 'revolving' ? 'border-l-indigo-500' : 'border-l-zinc-700')
            }`}>
              {/* Visual state headers */}
              <div className={`p-4 border-b border-zinc-100 flex justify-between items-start gap-3 ${
                isCompleted ? 'bg-zinc-100/50' : isCritical ? 'bg-red-50/50' : 'bg-zinc-50'
              }`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] font-bold text-zinc-500 bg-white border-zinc-250">
                      🏛️ {d.creditor}
                    </Badge>
                    {d.interestRate > 0 && (
                      <Badge variant="secondary" className="text-[9px] font-bold bg-amber-100 text-amber-800 border-none shrink-0">
                        {d.interestRate}% Int.
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[9px] font-bold border-none uppercase tracking-wider shrink-0 ${
                      d.type === 'credit_card' ? 'bg-rose-50 text-rose-700 font-extrabold' : d.type === 'revolving' ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'bg-zinc-100 text-zinc-700 font-extrabold'
                    }`}>
                      {d.type === 'credit_card' ? '💳 Tarjeta' : d.type === 'revolving' ? '🔄 Rotativo' : '🏛️ General'}
                    </Badge>
                  </div>
                  <h4 className="font-extrabold text-zinc-800 text-base mt-2 truncate leading-snug">
                    {d.name}
                  </h4>
                </div>

                {/* Options */}
                <div className="flex gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-7 hover:bg-zinc-200/55"
                    onClick={() => handleOpenEditDebt(d)}
                  >
                    <Edit3 className="size-3.5 text-zinc-650" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-7 hover:bg-red-50 hover:text-red-500"
                    onClick={() => handleDeleteDebt(d.id, d.name)}
                  >
                    <Trash2 className="size-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4 space-y-3.5">
                {/* Debt Amounts detail */}
                <div className="flex justify-between items-baseline">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-sans">Por Liquidar:</span>
                    <p className="font-black text-rose-500 text-lg font-mono">${d.remainingAmount.toLocaleString()}</p>
                  </div>
                  
                  <div className="space-y-0.5 text-right">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-sans">Histórico prestado:</span>
                    <p className="font-semibold text-zinc-500 text-sm font-mono">${d.totalAmount.toLocaleString()}</p>
                  </div>
                </div>

                {/* Micro amortizations progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold">
                    <span>Capital devuelto</span>
                    <span className="font-mono text-emerald-600">{progressRatio.toFixed(0)}%</span>
                  </div>
                  <Progress value={progressRatio} className={`h-1.5 ${isCompleted ? 'bg-zinc-200' : 'bg-zinc-200'}`} />
                </div>

                {/* Due state meta-details */}
                <div className="flex flex-col gap-1.5 text-[11px] border-t border-dashed border-zinc-250 pt-2.5">
                  {d.dueDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Próximo pago:</span>
                      <span className={`font-semibold ${isCompleted ? 'text-zinc-500' : isCritical ? 'text-rose-500 font-bold' : 'text-zinc-700'}`}>
                        📅 {d.dueDate ? format(parseISO(d.dueDate), 'dd/MM/yyyy') : 'Sin fecha'}
                      </span>
                    </div>
                  )}
                  {d.minimumPayment > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Pago Mínimo Sugerido:</span>
                      <strong className="text-zinc-700 font-mono">${d.minimumPayment.toLocaleString()}</strong>
                    </div>
                  )}
                  {d.description && (
                    <p className="text-[10px] text-zinc-400 italic line-clamp-1 mt-1 font-normal">
                      "{d.description}"
                    </p>
                  )}
                </div>

                {/* Payment controls */}
                <div className="pt-2">
                  {isCompleted ? (
                    <div className="flex items-center justify-center gap-1 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold leading-none select-none">
                      <CheckCircle2 className="size-4" /> Liquidada con éxito
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleOpenPaymentModal(d.id)}
                      size="sm" 
                      className="w-full bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                    >
                      ⚡ Abona a esta Deuda
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        };

        return (
          <div className="space-y-8">
            {/* Tarjetas de Crédito y Créditos Rotativos Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-200">
                <span className="p-1 rounded bg-rose-50 text-rose-600">
                  <CreditCard className="size-4" />
                </span>
                <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-widest block font-sans">
                  💳 Tarjetas de Crédito y Créditos Rotativos ({creditCardsAndRevolving.filter(d => d.status === 'active').length})
                </span>
              </div>
              
              {creditCardsAndRevolving.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {creditCardsAndRevolving.map(renderDebtCard)}
                </div>
              ) : (
                <div className="text-center py-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-400">
                  No tienes registradas tarjetas de crédito ni deudas rotativas activas.
                </div>
              )}
            </div>

            {/* Préstamos y Obligaciones Generales Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-200">
                <span className="p-1 rounded bg-zinc-100 text-zinc-600">
                  <Wallet className="size-4" />
                </span>
                <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-widest block font-sans">
                  🏛️ Préstamos y Obligaciones Generales ({generalDebts.filter(d => d.status === 'active').length})
                </span>
              </div>

              {generalDebts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generalDebts.map(renderDebtCard)}
                </div>
              ) : (
                <div className="text-center py-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-400">
                  No tienes registrados otros préstamos u obligaciones generales activas.
                </div>
              )}
            </div>

            {debts.length === 0 && (
              <div className="col-span-full py-16 text-center rounded-xl border-2 border-dashed border-zinc-200 bg-white">
                <AlertCircle className="mx-auto mb-2.5 size-11 text-zinc-300" />
                <h5 className="font-extrabold text-zinc-700 text-sm">No has programado ninguna deuda</h5>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  ¡Esto es una gran noticia! Si tienes préstamos o saldos pendientes, agrégalos para estructurar un plan de bola de nieve inteligente.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Historical Payments Registry Log Subtable */}
      {payments.length > 0 && (
        <Card className="shadow-sm border border-zinc-250 bg-white">
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                Historial de Control de Abonos y Amortizaciones ({payments.length})
              </CardTitle>
              <CardDescription className="text-[10px] text-zinc-500 mt-0.5">
                Bitácora de todos los abonos extraordinarios o mínimos cargados.
              </CardDescription>
            </div>
            <FileText className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200 uppercase text-[9px]">
                  <th className="p-3">Deuda Destino</th>
                  <th className="p-3">Monto de Pago</th>
                  <th className="p-3">Fecha de Abono</th>
                  <th className="p-3">Origen de Retiro</th>
                  <th className="p-3">Notas</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150">
                {payments.map(pay => {
                  const correlatedDebt = debts.find(d => d.id === pay.debtId);
                  const sourceAccount = accounts.find(a => a.id === pay.accountId);

                  return (
                    <tr key={pay.id} className="hover:bg-zinc-50/50">
                      <td className="p-3 font-bold text-zinc-800">
                        {correlatedDebt ? correlatedDebt.name : 'Deuda Desconocida/Eliminada'}
                        <span className="block text-[9px] text-zinc-400 font-medium">Acreedor: {correlatedDebt?.creditor || '---'}</span>
                      </td>
                      <td className="p-3 font-semibold text-emerald-600 font-mono">
                        + ${pay.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-zinc-500 font-mono">
                        {pay.date ? format(parseISO(pay.date), 'dd MMM yyyy', { locale: es }) : '---'}
                      </td>
                      <td className="p-3 text-zinc-600">
                        <span className="font-semibold">{sourceAccount?.name || '---'}</span>
                      </td>
                      <td className="p-3 text-zinc-550 max-w-xs truncate italic">
                        {pay.notes || '---'}
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="xs"
                          onClick={() => handleRevertPayment(pay)}
                          className="h-7 text-[10px] text-zinc-600 hover:text-red-600 hover:bg-zinc-100 p-2 rounded-lg font-bold"
                        >
                          Anular abono
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// Simple fallback badge alert icon from Lucide 
function BadgeAlert({ className, ...props }: React.ComponentProps<typeof AlertCircle>) {
  return <AlertCircle className={className} {...props} />;
}
