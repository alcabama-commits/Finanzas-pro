import React, { useState, useEffect, useMemo } from 'react';
import { Receivable, ReceivablePayment, Account, Category } from '@/src/types';
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
  ArrowUpRight,
  Search,
  X,
  Sparkles,
  RefreshCw,
  Wallet,
  Coins,
  PiggyBank
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function ReceivablesView() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<ReceivablePayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI States
  const [activeStrategy, setActiveStrategy] = useState<'urgency' | 'largest' | 'fast_cash'>('urgency');
  const [activeTab, setActiveTab] = useState<'pending' | 'collected' | 'history'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isReceivableFormOpen, setIsReceivableFormOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>('');

  // Editing state
  const [editingReceivableId, setEditingReceivableId] = useState<string | null>(null);

  // Receivable Form Fields
  const [receivableForm, setReceivableForm] = useState({
    name: '',
    debtor: '',
    totalAmount: '',
    remainingAmount: '',
    interestRate: '0',
    dueDate: '',
    minimumPayment: '',
    status: 'active' as 'active' | 'collected',
    type: 'loan' as 'loan' | 'work',
    invoiceSubmitted: false,
    description: ''
  });

  // Payment Form Fields
  const [paymentForm, setPaymentForm] = useState({
    receivableId: '',
    amount: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Load subscriptions
  useEffect(() => {
    const unsubReceivables = dbService.subscribeToCollection('receivables', setReceivables);
    const unsubPayments = dbService.subscribeToCollection('receivable_payments', setPayments);
    const unsubAccounts = dbService.subscribeToCollection('accounts', setAccounts);
    const unsubCategories = dbService.subscribeToCollection('categories', setCategories);

    return () => {
      unsubReceivables();
      unsubPayments();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  const incomeCategories = useMemo(() => {
    return categories.filter(c => c.type === 'income');
  }, [categories]);

  // Overall statistics for Receivables
  const stats = useMemo(() => {
    const activeList = receivables.filter(r => r.status === 'active');
    
    const totalOriginal = receivables.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalRemaining = receivables.reduce((sum, r) => sum + (r.remainingAmount || 0), 0);
    const totalCollected = Math.max(0, totalOriginal - totalRemaining);
    
    const recoveryPercentage = totalOriginal > 0 ? (totalCollected / totalOriginal) * 100 : 0;
    const totalSuggestedCollect = activeList.reduce((sum, r) => sum + (r.minimumPayment || 0), 0);
    const numCollected = receivables.filter(r => r.status === 'collected').length;

    // Work-related stats for collection invoices (cuentas de cobro)
    const pendingInvoices = activeList.filter(r => r.type === 'work' && !r.invoiceSubmitted);
    const pendingInvoicesCount = pendingInvoices.length;
    const pendingInvoicesTotal = pendingInvoices.reduce((sum, r) => sum + (r.remainingAmount || 0), 0);

    // Weighted average interest rate of active receivables
    const activeRemaining = activeList.reduce((sum, r) => sum + (r.remainingAmount || 0), 0);
    let weightedIntRateSum = 0;
    if (activeRemaining > 0) {
      activeList.forEach(r => {
        weightedIntRateSum += (r.interestRate || 0) * (r.remainingAmount || 0);
      });
    }
    const avgInterestRate = activeRemaining > 0 ? (weightedIntRateSum / activeRemaining) : 0;

    // Count of unique debtors
    const uniqueDebtors = new Set(activeList.map(r => r.debtor.trim().toLowerCase())).size;

    return {
      totalOriginal,
      totalRemaining,
      totalCollected,
      recoveryPercentage,
      totalSuggestedCollect,
      avgInterestRate,
      activeCount: activeList.length,
      collectedCount: numCollected,
      uniqueDebtors,
      pendingInvoicesCount,
      pendingInvoicesTotal
    };
  }, [receivables]);

  // Sorting & Filtering active/collected receivables list
  const filteredAndSortedReceivables = useMemo(() => {
    // 1. Filter by status
    const list = receivables.filter(r => {
      if (activeTab === 'pending') return r.status === 'active';
      if (activeTab === 'collected') return r.status === 'collected';
      return r.status === 'active'; // Fallback
    });

    // 2. Filter by search term
    const matched = list.filter(r => {
      const term = searchTerm.toLowerCase();
      return r.name.toLowerCase().includes(term) || r.debtor.toLowerCase().includes(term) || (r.description && r.description.toLowerCase().includes(term));
    });

    // 3. Sort by chosen strategy
    if (activeTab === 'pending') {
      if (activeStrategy === 'urgency') {
        // Due Date (closest first)
        return [...matched].sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return dateA - dateB;
        });
      } else if (activeStrategy === 'largest') {
        // Largest Remaining Amount (highest first)
        return [...matched].sort((a, b) => b.remainingAmount - a.remainingAmount);
      } else if (activeStrategy === 'fast_cash') {
        // Smallest Remaining Amount (lowest first)
        return [...matched].sort((a, b) => a.remainingAmount - b.remainingAmount);
      }
    }

    // Default sorting for collected (by date created or updated, or Name)
    return [...matched].sort((a, b) => a.name.localeCompare(b.name));
  }, [receivables, activeTab, searchTerm, activeStrategy]);

  // Open helper for edit
  const handleOpenEditReceivable = (r: Receivable) => {
    setEditingReceivableId(r.id);
    setReceivableForm({
      name: r.name,
      debtor: r.debtor,
      totalAmount: String(r.totalAmount),
      remainingAmount: String(r.remainingAmount),
      interestRate: String(r.interestRate || 0),
      dueDate: r.dueDate || '',
      minimumPayment: String(r.minimumPayment || 0),
      status: r.status,
      type: r.type || 'loan',
      invoiceSubmitted: r.invoiceSubmitted ?? false,
      description: r.description || ''
    });
    setIsReceivableFormOpen(true);
  };

  // Create / Update Receivable
  const handleSaveReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, debtor, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate, type, invoiceSubmitted } = receivableForm;

    if (!name.trim() || !debtor.trim() || !totalAmount) {
      toast.error('Por favor, completa los campos obligatorios: Concepto, Deudor/Cliente y Total.');
      return;
    }

    const principal = parseFloat(totalAmount);
    let remaining = remainingAmount ? parseFloat(remainingAmount) : principal;

    if (isNaN(principal) || principal <= 0) {
      toast.error('El valor original debe ser un monto positivo válido.');
      return;
    }

    if (remaining > principal) {
      toast.error('El saldo pendiente no puede ser superior al monto original.');
      return;
    }

    const rate = parseFloat(interestRate) || 0;
    const minPay = parseFloat(minimumPayment) || 0;
    const statusVal = remaining <= 0 ? 'collected' : receivableForm.status;

    const finalData = {
      name: name.trim(),
      debtor: debtor.trim(),
      totalAmount: principal,
      remainingAmount: remaining <= 0 ? 0 : remaining,
      interestRate: rate,
      minimumPayment: minPay,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      status: statusVal,
      type: type || 'loan',
      invoiceSubmitted: type === 'work' ? (invoiceSubmitted ?? false) : false,
      description: receivableForm.description.trim()
    };

    try {
      if (editingReceivableId) {
        await dbService.updateItem('receivables', editingReceivableId, finalData);
        toast.success('🎉 Cuenta por cobrar actualizada correctamente.');
      } else {
        await dbService.addItem('receivables', finalData);
        toast.success('📈 Nueva cuenta registrada de manera exitosa.');
      }
      setIsReceivableFormOpen(false);
      setEditingReceivableId(null);
      resetReceivableForm();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar la cuenta por cobrar en la base de datos.');
    }
  };

  const resetReceivableForm = () => {
    setReceivableForm({
      name: '',
      debtor: '',
      totalAmount: '',
      remainingAmount: '',
      interestRate: '0',
      dueDate: new Date().toISOString().split('T')[0],
      minimumPayment: '',
      status: 'active',
      type: 'loan',
      invoiceSubmitted: false,
      description: ''
    });
  };

  // Direct option to mark collection account as passed
  const handleMarkInvoiceSubmitted = async (receivableId: string) => {
    try {
      await dbService.updateItem('receivables', receivableId, {
        invoiceSubmitted: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('🎉 ¡Perfecto! Registraste que ya pasaste la cuenta de cobro. ¡Que el cliente pague rápido!');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo actualizar el estado de la cuenta de cobro.');
    }
  };

  // Delete Receivable
  const handleDeleteReceivable = async (id: string) => {
    if (!window.confirm('¿Confirmas que deseas eliminar esta cuenta por cobrar de los registros? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await dbService.deleteItem('receivables', id);
      toast.success('Registro de cuenta por cobrar borrado exitosamente.');
    } catch (err) {
      console.error(err);
      toast.error('Fallo al limpiar el registro de cobro.');
    }
  };

  // Open Payment Registration Panel directly
  const handleOpenAddPayment = (receivableId: string) => {
    const matched = receivables.find(r => r.id === receivableId);
    if (!matched) return;
    
    setSelectedReceivableId(receivableId);
    setPaymentForm({
      receivableId,
      amount: String(matched.minimumPayment || matched.remainingAmount),
      accountId: accounts[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      notes: `Abono de ${matched.debtor} a la cuenta por cobrar: ${matched.name}`
    });
    setIsPaymentFormOpen(true);
  };

  // Save the custom payment (abono recibido) & sync with balance/transaction lists
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { receivableId, amount, accountId, date, notes } = paymentForm;

    if (!receivableId) {
      toast.error('Debes seleccionar una cuenta por cobrar destino.');
      return;
    }

    if (!accountId) {
      toast.error('Debes seleccionar una cuenta receptora para depositar los fondos.');
      return;
    }

    const payVal = parseFloat(amount);
    if (isNaN(payVal) || payVal <= 0) {
      toast.error('El monto a abonar debe ser un valor de capital real superior a cero.');
      return;
    }

    const targetReceivable = receivables.find(r => r.id === receivableId);
    if (!targetReceivable) {
      toast.error('La cuenta por cobrar no existe.');
      return;
    }

    const targetAccount = accounts.find(a => a.id === accountId);
    if (!targetAccount) {
      toast.error('La cuenta de destino del abono ya no existe.');
      return;
    }

    if (payVal > targetReceivable.remainingAmount + 0.01) {
      if (!window.confirm(`El importe del abono ($${payVal.toLocaleString()}) es mayor que el saldo pendiente ($${targetReceivable.remainingAmount.toLocaleString()}). ¿Deseas aplicar el excedente y marcarla como cobrada por completo?`)) {
        return;
      }
    }

    try {
      // 1. Calculate new remaining amount for client
      const newRemaining = Math.max(0, targetReceivable.remainingAmount - payVal);
      const newStatus = newRemaining <= 0 ? 'collected' : targetReceivable.status;

      // 2. Add ReceivablePayment record
      const paymentPayload = {
        receivableId,
        amount: payVal,
        date: new Date(date).toISOString(),
        accountId,
        notes: notes.trim()
      };
      await dbService.addItem('receivable_payments', paymentPayload);

      // 3. Update Receivable remaining fields
      await dbService.updateItem('receivables', receivableId, {
        remainingAmount: newRemaining,
        status: newStatus
      });

      // 4. Look up or create "Ingresos por Cobros" or generic income category
      let categoryId = incomeCategories[0]?.id || '';
      if (!categoryId && categories.length > 0) {
        // Fallback to any category
        categoryId = categories[0].id;
      }

      // 5. Add Transaction record (which also serves the general UI)
      await dbService.addItem('transactions', {
        amount: payVal,
        type: 'income',
        categoryId: categoryId,
        accountId: accountId,
        date: new Date(date).toISOString(),
        description: `Cobro recibido de ${targetReceivable.debtor}: ${targetReceivable.name}`,
        isEventual: false
      });

      // 6. Deposit to target account balance
      await dbService.updateItem('accounts', accountId, {
        balance: (targetAccount.balance || 0) + payVal
      });

      toast.success(`💰 ¡Excelente cobro! Recibidos $${payVal.toLocaleString()} depositados en la cuenta "${targetAccount.name}".`);
      setIsPaymentFormOpen(false);
      setSelectedReceivableId('');
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al contabilizar el cobro recibido.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 animate-fade-in sm:px-2 pb-12">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <HandCoins className="size-6 shrink-0" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight sm:text-3xl">Cuentas por Cobrar</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Control de cobros personales, préstamos otorgados y honorarios por trabajos finalizados. Monitorea tus cuentas de cobro pendientes y recibe el dinero en tus cuentas activas.
          </p>
        </div>
        
        <Button 
          onClick={() => {
            resetReceivableForm();
            setIsReceivableFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 self-start md:self-center shadow-md rounded-xl flex items-center gap-1.5 transition-all duration-200 outline-none"
        >
          <Plus className="size-4 shrink-0" /> Registrar Cuenta por Cobrar / Trabajo
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-emerald-100 bg-emerald-50/20 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-10 bg-emerald-700 size-24 rounded-full" />
          <CardHeader className="pb-2">
            <span className="text-xs text-zinc-500 font-bold tracking-wide uppercase">Total por Recuperar</span>
            <CardTitle className="text-2xl font-black text-emerald-700 font-mono tracking-tight mt-1">
              ${stats.totalRemaining.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-xs text-zinc-600">
              <span>Original: ${stats.totalOriginal.toLocaleString()}</span>
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-none font-bold">
                {stats.activeCount} pendientes
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 bg-zinc-700 size-24 rounded-full" />
          <CardHeader className="pb-2">
            <span className="text-xs text-zinc-500 font-bold tracking-wide uppercase">Recuperado a la Fecha</span>
            <CardTitle className="text-2xl font-black text-zinc-900 font-mono tracking-tight mt-1">
              ${stats.totalCollected.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <span>Efectividad de recuperación:</span>
                <span className="font-bold text-emerald-600">{stats.recoveryPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={stats.recoveryPercentage} className="h-1.5 bg-zinc-100 [&>div]:bg-emerald-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <span className="text-xs text-zinc-500 font-bold tracking-wide uppercase">Cuota Mensual Sugerida</span>
            <CardTitle className="text-2xl font-black text-zinc-900 font-mono tracking-tight mt-1">
              ${stats.totalSuggestedCollect.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-zinc-600">Proyección de flujo de caja mensual</span>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <span className="text-xs text-zinc-500 font-bold tracking-wide uppercase">Detalles Generales</span>
            <CardTitle className="text-2xl font-black text-zinc-900 font-mono tracking-tight mt-1">
              {stats.uniqueDebtors} personas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-xs text-zinc-600 mt-1">
              <span>Tasa ponderada: {stats.avgInterestRate.toFixed(1)}%</span>
              <span className="font-bold text-zinc-500">+{stats.collectedCount} cobradas</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Playful & Bothering Invoice Alert Banner */}
      {activeTab === 'pending' && stats.pendingInvoicesCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-rose-100 text-rose-800 rounded-xl mt-0.5 sm:mt-0 shrink-0">
              <AlertCircle className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-rose-950 font-black text-xs tracking-wide uppercase flex items-center gap-1">
                ⚠️ ¡Llamada Atroz de Cobranza!
              </h3>
              <p className="text-xs text-rose-800 leading-normal font-bold">
                Tienes <strong className="text-rose-950 font-black text-xs">{stats.pendingInvoicesCount} trabajo(s)</strong> con saldo por recibir de <strong className="text-rose-950 font-black text-xs">${stats.pendingInvoicesTotal.toLocaleString()}</strong>, pero <span className="underline decoration-pink-500 font-extrabold">NO has enviado la Cuenta de Cobro</span>. ¡¿Cómo te van a pagar si no pasas el cobro?! No te duermas.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => {
              setSearchTerm('');
              toast.info("💡 Haz clic en 'Ya la pasé' en las tarjetas rojas marcadas abajo para silenciar esta alerta.");
            }}
            variant="outline" 
            className="border-rose-300 text-rose-950 hover:bg-rose-100 font-extrabold text-xs shrink-0 self-start sm:self-center h-8 px-3 rounded-lg bg-white shadow-xs"
          >
            ¿Cómo silenciar esto?
          </Button>
        </div>
      )}

      {/* Interactive Options Area */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex bg-zinc-100 p-1 rounded-xl w-full md:w-auto self-start">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`flex-grow md:flex-grow-0 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${activeTab === 'pending' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Pendientes ({stats.activeCount})
          </button>
          <button 
            onClick={() => setActiveTab('collected')}
            className={`flex-grow md:flex-grow-0 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${activeTab === 'collected' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Saldadas ({stats.collectedCount})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-grow md:flex-grow-0 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${activeTab === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Abonos Recibidos
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3 w-full md:w-80">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
            <Input 
              placeholder="Buscar por concepto o deudor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-zinc-250 focus-visible:ring-emerald-500 placeholder:text-zinc-400 text-sm font-medium"
            />
          </div>
          {searchTerm && (
            <Button size="icon" variant="ghost" onClick={() => setSearchTerm('')} className="size-10 rounded-xl">
              <X className="size-4" />
            </Button>
          )}
        </div>

      </div>

      {/* Strategy selector only for pending tab */}
      {activeTab === 'pending' && filteredAndSortedReceivables.length > 1 && (
        <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-teal-950 font-black text-sm tracking-wide flex items-center gap-1.5 uppercase">
              <Sparkles className="size-4 text-teal-600" /> Optimización de Flujo de Cobro
            </h3>
            <p className="text-xs text-zinc-600">
              Planea tus acciones de cobranza de manera estructurada para mitigar riesgos o maximizar liquidez instantánea.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => setActiveStrategy('urgency')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 shadow-sm transition-all ${activeStrategy === 'urgency' ? 'bg-teal-700 text-white border-teal-800 font-extrabold' : 'bg-white text-zinc-700 border-zinc-250 hover:bg-zinc-50'}`}
            >
              <Clock className="size-3.5" /> Próximo Vto. (Urgencia)
            </button>
            <button 
              onClick={() => setActiveStrategy('largest')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 shadow-sm transition-all ${activeStrategy === 'largest' ? 'bg-teal-700 text-white border-teal-800 font-extrabold' : 'bg-white text-zinc-700 border-zinc-250 hover:bg-zinc-50'}`}
            >
              <DollarSign className="size-3.5" /> Mayor Saldo Pendiente
            </button>
            <button 
              onClick={() => setActiveStrategy('fast_cash')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 shadow-sm transition-all ${activeStrategy === 'fast_cash' ? 'bg-teal-700 text-white border-teal-800 font-extrabold' : 'bg-white text-zinc-700 border-zinc-250 hover:bg-zinc-50'}`}
            >
              <Coins className="size-3.5" /> Cobro Rápido (Liquidez)
            </button>
          </div>
        </div>
      )}

      {/* Main Tab views */}
      {activeTab !== 'history' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSortedReceivables.length > 0 ? (
            filteredAndSortedReceivables.map((r) => {
              const collected = Math.max(0, r.totalAmount - r.remainingAmount);
              const pct = r.totalAmount > 0 ? (collected / r.totalAmount) * 100 : 0;
              const formattedDate = r.dueDate ? format(parseISO(r.dueDate), 'dd dddd MMM, yyyy', { locale: es }) : 'No definida';
              const isWorkWithoutInvoice = r.type === 'work' && !r.invoiceSubmitted && r.status === 'active';

              return (
                <Card 
                  key={r.id} 
                  className={`border flex flex-col justify-between hover:border-zinc-350 transition-all duration-200 overflow-hidden shadow-sm hover:shadow ${
                    isWorkWithoutInvoice 
                      ? 'border-red-300 bg-red-50/5 ring-2 ring-red-100 animate-pulse-subtle' 
                      : r.status === 'collected' 
                        ? 'border-zinc-200 bg-zinc-50/50' 
                        : 'border-zinc-200 bg-white'
                  }`}
                >
                  <CardHeader className={`pb-3 border-b border-zinc-100/60 ${isWorkWithoutInvoice ? 'bg-red-50/20' : 'bg-zinc-50/20'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <Badge variant="outline" className={`text-[10px] font-black border-none uppercase tracking-wide ${r.status === 'collected' ? 'bg-zinc-200 text-zinc-700' : 'bg-emerald-50 text-emerald-800'}`}>
                            {r.status === 'collected' ? '✓ Cobrada' : '• Pendiente'}
                          </Badge>
                          
                          {/* Type indicator badge */}
                          <Badge variant="outline" className={`text-[10px] font-bold border-none uppercase tracking-wide ${r.type === 'work' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-900'}`}>
                            {r.type === 'work' ? '💼 Trabajo Hecho' : '💵 Préstamo'}
                          </Badge>
                        </div>
                        
                        <h3 className="font-extrabold text-zinc-900 text-base leading-tight truncate mt-1">{r.name}</h3>
                        <p className="text-zinc-500 font-medium text-xs">
                          {r.type === 'work' ? 'Cliente' : 'Deudor'}: <span className="font-bold text-zinc-800">{r.debtor}</span>
                        </p>
                      </div>

                      {r.interestRate && r.interestRate > 0 ? (
                        <div className="p-1 px-2 border border-sky-300 text-sky-800 rounded-lg text-[10px] font-bold flex items-center gap-0.5 bg-sky-50">
                          <Percent className="size-2.5 shrink-0" /> {r.interestRate}% Int.
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4 pt-4">
                    
                    {/* Invoice status alert inside card to bug the user */}
                    {r.type === 'work' && (
                      <div className={`p-2.5 rounded-xl border text-xs font-semibold ${
                        r.invoiceSubmitted 
                          ? 'bg-emerald-50/60 border-emerald-100 text-emerald-800' 
                          : 'bg-red-50 border-red-150 text-red-900'
                      }`}>
                        {r.invoiceSubmitted ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <span>Cuenta de Cobro: <strong>Pasada al cliente</strong></span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="size-4.5 text-red-650 shrink-0 mt-0.5 animate-bounce" />
                              <span>Cuenta de Cobro: <strong className="text-red-750 uppercase">🚨 PENDIENTE DE PASAR</strong></span>
                            </div>
                            {r.status === 'active' && (
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkInvoiceSubmitted(r.id);
                                }}
                                size="sm" 
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] h-7 rounded-lg tracking-wide transition-all uppercase"
                              >
                                ✅ ¡Ya la pasé, dejen de molestar!
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Amount Metrics */}
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-dashed border-zinc-200">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block tracking-wide">Saldo Pendiente</span>
                        <span className="text-lg font-black text-zinc-900 font-mono">
                          ${r.remainingAmount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block tracking-wide">
                          {r.type === 'work' ? 'Monto Trabajo' : 'Valor Préstamo'}
                        </span>
                        <span className="text-base font-extrabold text-zinc-550 font-mono block">
                          ${r.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress with percentages */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-600 font-bold">
                        <span>Recuperado: ${collected.toLocaleString()}</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-2 bg-zinc-100 [&>div]:bg-emerald-500" />
                    </div>

                    {/* Due details & minimum suggestion */}
                    <div className="space-y-2 text-xs bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                      <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
                        <Calendar className="size-3.5 text-zinc-400 shrink-0" />
                        <span>Fecha límite: <strong className="text-zinc-800 capitalize">{formattedDate}</strong></span>
                      </div>
                      {r.minimumPayment && r.minimumPayment > 0 ? (
                        <div className="flex items-center gap-1.5 text-zinc-650 font-medium">
                          <CircleDollarSign className="size-3.5 text-zinc-400 shrink-0" />
                          <span>Abono sugerido: <strong className="text-zinc-800 font-mono">${r.minimumPayment.toLocaleString()}</strong></span>
                        </div>
                      ) : null}
                      {r.description && (
                        <div className="text-[11px] text-zinc-550 border-t border-zinc-200 pt-1.5 mt-1 truncate">
                          💡 {r.description}
                        </div>
                      )}
                    </div>

                  </CardContent>

                  <CardFooter className="pb-4 pt-1 flex justify-between gap-2 border-t border-zinc-100 mt-2 bg-zinc-50/10">
                    <div className="flex gap-1">
                      <Button 
                        onClick={() => handleOpenEditReceivable(r)}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
                        title="Editar parámetros"
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button 
                        onClick={() => handleDeleteReceivable(r.id)}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50"
                        title="Eliminar de registros"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {r.status === 'active' && (
                      <Button 
                        onClick={() => handleOpenAddPayment(r.id)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 px-3 rounded-xl flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Coins className="size-3.5 shrink-0" /> Registrar Abono Recibido
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-zinc-200 bg-zinc-50/50 rounded-3xl p-6">
              <div className="p-3 bg-zinc-100 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto text-zinc-400">
                <Bookmark className="size-6" />
              </div>
              <h3 className="font-extrabold text-zinc-900 mt-4 text-base">Ninguna cuenta por cobrar encontrada</h3>
              <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
                {searchTerm ? 'Ningún registro coincide con los criterios de búsqueda elegidos.' : 'No cuentas con préstamos ni cuentas por cobrar registradas en este momento. Agrega uno nuevo para iniciar.'}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => setIsReceivableFormOpen(true)}
                  variant="outline" 
                  className="mt-4 border-zinc-300 font-bold text-xs h-9"
                >
                  <Plus className="mr-1.5 size-3.5" /> Registrar primera cuenta
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* History of received abonos list view */
        <Card className="border-zinc-200 overflow-hidden shadow-sm">
          <CardHeader className="pb-3 border-b border-zinc-100 bg-zinc-50/20">
            <CardTitle className="text-sm font-black text-zinc-950 uppercase tracking-wide flex items-center gap-2">
              <CircleDollarSign className="size-4 text-emerald-600" /> Registro Diario de Abonos Recaudados
            </CardTitle>
            <CardDescription className="text-xs">
              Historial detallado de todas las sumas de dinero recibidas por concepto de cobranza de carteras o préstamos personales.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-xs">
                      <th className="p-3.5 pl-4">Concepto / Cuenta por cobrar</th>
                      <th className="p-3.5">Deudor</th>
                      <th className="p-3.5">Monto Recuperado</th>
                      <th className="p-3.5">Buzón Destino</th>
                      <th className="p-3.5">Fecha</th>
                      <th className="p-3.5 pr-4">Notas de abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const associatedReceivable = receivables.find(r => r.id === p.receivableId);
                      const associatedAccount = accounts.find(a => a.id === p.accountId);
                      return (
                        <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 text-zinc-700">
                          <td className="p-3.5 pl-4 font-extrabold text-zinc-900">
                            {associatedReceivable?.name || 'Cuenta eliminada'}
                          </td>
                          <td className="p-3.5 font-bold text-zinc-800">
                            {associatedReceivable?.debtor || '---'}
                          </td>
                          <td className="p-3.5 font-mono font-black text-emerald-600 text-sm">
                            + ${p.amount.toLocaleString()}
                          </td>
                          <td className="p-3.5">
                            <Badge variant="outline" className="border-zinc-250 bg-white font-medium text-zinc-700">
                              <Wallet className="size-3 mr-1 text-zinc-400" /> {associatedAccount?.name || 'Cuenta eliminada'}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-xs text-zinc-500 font-medium font-mono">
                            {p.date ? format(parseISO(p.date), 'dd/MM/yyyy HH:mm') : '---'}
                          </td>
                          <td className="p-3.5 pr-4 text-xs italic text-zinc-500 max-w-xs truncate" title={p.notes}>
                            {p.notes || '(Sin especificación)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 text-xs">
                Todavía no has registrado ningún abono parcial o total sobre las carteras pendientes.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* dialog Receivable Form */}
      {isReceivableFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-lg shadow-xl border-zinc-200 animate-slide-up bg-white">
            <CardHeader className="relative pb-4 border-b border-zinc-100">
              <CardTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                <HandCoins className="size-5 text-emerald-600" />
                {editingReceivableId ? 'Modificar Parámetros de Cartera' : 'Registrar Cuenta por Cobrar / Trabajo'}
              </CardTitle>
              <CardDescription className="text-xs">
                Ingresa los datos para realizar trazabilidad al capital prestado o a los honorarios de un trabajo realizado.
              </CardDescription>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setIsReceivableFormOpen(false);
                  setEditingReceivableId(null);
                }}
                className="absolute right-4 top-4 size-8 rounded-lg"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleSaveReceivable} className="space-y-4 p-5">
              
              {/* Type & Invoice status select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-type" className="text-xs font-black text-zinc-700">Tipo de Cuenta</Label>
                  <Select 
                    value={receivableForm.type} 
                    onValueChange={(v) => {
                      const selectedType = v as 'loan' | 'work';
                      setReceivableForm({ 
                        ...receivableForm, 
                        type: selectedType,
                        interestRate: selectedType === 'work' ? '0' : receivableForm.interestRate
                      });
                    }}
                  >
                    <SelectTrigger id="rec-type" className="h-9 font-bold text-xs bg-white">
                      <SelectValue placeholder="Selecciona tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">💵 Préstamo de Dinero</SelectItem>
                      <SelectItem value="work">💼 Trabajo Hecho / Servicio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  {receivableForm.type === 'work' ? (
                    <>
                      <Label htmlFor="rec-invoice" className="text-xs font-black text-zinc-700">¿Pasaste la Cuenta de Cobro? *</Label>
                      <Select 
                        value={receivableForm.invoiceSubmitted ? 'yes' : 'no'} 
                        onValueChange={(v) => setReceivableForm({ ...receivableForm, invoiceSubmitted: v === 'yes' })}
                      >
                        <SelectTrigger id="rec-invoice" className="h-9 font-bold text-xs bg-white border-zinc-250">
                          <SelectValue placeholder="¿Documento enviado?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">✅ Sí, ya la pasé</SelectItem>
                          <SelectItem value="no">🚨 No, aún no la he pasado</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-550 h-full flex items-center pt-2">
                       Para préstamos personales puedes cobrar un interés corriente si lo deseas.
                    </div>
                  )}
                </div>
              </div>

              {/* Alert inside form to pester if completed work but no invoice submitted */}
              {receivableForm.type === 'work' && !receivableForm.invoiceSubmitted && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-pulse">
                  <AlertCircle className="size-4.5 text-red-650 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-red-950">⚠️ ¡DEJA DE DORMIRTE EN LOS LAURELES!</h4>
                    <p className="text-[11px] text-red-800 leading-relaxed font-bold">
                      Si no pasas la cuenta de cobro, ¿cómo pretendes cobrar y cobrar rápido? ¡Llama, redacta y envíale la cuenta de cobro al cliente hoy mismo sin falta!
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-name" className="text-xs font-black text-zinc-700">Concepto del Cobro / Trabajo *</Label>
                  <Input 
                    id="rec-name"
                    placeholder="Ej. Rediseño Web, Préstamo Carro, etc."
                    required
                    value={receivableForm.name}
                    onChange={(e) => setReceivableForm({ ...receivableForm, name: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rec-debtor" className="text-xs font-black text-zinc-700">Cliente / Deudor *</Label>
                  <Input 
                    id="rec-debtor"
                    placeholder="Ej. Juan Pérez, Empresa S.A.S."
                    required
                    value={receivableForm.debtor}
                    onChange={(e) => setReceivableForm({ ...receivableForm, debtor: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-total" className="text-xs font-black text-zinc-700">Monto Total del Trabajo o Préstamo ($) *</Label>
                  <Input 
                    id="rec-total"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1,500,000"
                    required
                    value={receivableForm.totalAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReceivableForm({ 
                        ...receivableForm, 
                        totalAmount: val,
                        remainingAmount: editingReceivableId ? receivableForm.remainingAmount : val
                      });
                    }}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rec-remaining" className="text-xs font-black text-zinc-700">Saldo Pendiente Actual ($)</Label>
                  <Input 
                    id="rec-remaining"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Dejar vacío si no han abonado nada"
                    value={receivableForm.remainingAmount}
                    onChange={(e) => setReceivableForm({ ...receivableForm, remainingAmount: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-interest" className="text-xs font-black text-zinc-700">Tasa de Interés (%)</Label>
                  <Input 
                    id="rec-interest"
                    type="number"
                    step="0.1"
                    disabled={receivableForm.type === 'work'}
                    placeholder={receivableForm.type === 'work' ? 'N/A' : '0'}
                    value={receivableForm.interestRate}
                    onChange={(e) => setReceivableForm({ ...receivableForm, interestRate: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rec-min" className="text-xs font-black text-zinc-700">Abono Sugerido ($)</Label>
                  <Input 
                    id="rec-min"
                    type="number"
                    step="0.01"
                    placeholder="Opcional"
                    value={receivableForm.minimumPayment}
                    onChange={(e) => setReceivableForm({ ...receivableForm, minimumPayment: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-semibold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rec-due" className="text-xs font-black text-zinc-700">Fecha Estimada Cobro *</Label>
                  <Input 
                    id="rec-due"
                    type="date"
                    required
                    value={receivableForm.dueDate}
                    onChange={(e) => setReceivableForm({ ...receivableForm, dueDate: e.target.value })}
                    className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-semibold font-mono"
                  />
                </div>
              </div>

              {editingReceivableId && (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-status" className="text-xs font-black text-zinc-700">Estado de Cartera</Label>
                  <Select 
                    value={receivableForm.status} 
                    onValueChange={(v) => setReceivableForm({ ...receivableForm, status: v as 'active' | 'collected' })}
                  >
                    <SelectTrigger id="rec-status" className="h-10 font-bold text-sm">
                      <SelectValue placeholder="Selecciona estado..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo (Pendiente de cobro)</SelectItem>
                      <SelectItem value="collected">Concluido / Saldado por completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="rec-desc" className="text-xs font-black text-zinc-700">Notas de descripción</Label>
                <Input 
                  id="rec-desc"
                  placeholder="Ej. Avance del 50%, condiciones acordadas para el pago, etc."
                  value={receivableForm.description}
                  onChange={(e) => setReceivableForm({ ...receivableForm, description: e.target.value })}
                  className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-medium"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-zinc-150">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsReceivableFormOpen(false);
                    setEditingReceivableId(null);
                  }}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold h-10 border-zinc-250 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-10 px-5 text-xs shadow-md rounded-xl"
                >
                  {editingReceivableId ? 'Guardar Cambios' : 'Registrar Cuenta por Cobrar'}
                </Button>
              </div>

            </form>
          </Card>
        </div>
      )}

      {/* dialog Payment/Abono Form */}
      {isPaymentFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md shadow-xl border-zinc-200 animate-slide-up bg-white">
            <CardHeader className="relative pb-4 border-b border-zinc-100">
              <CardTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                <Coins className="size-5 text-emerald-600" />
                Control y Registro de Abono Recibido
              </CardTitle>
              <CardDescription className="text-xs">
                Registra un abono a cuenta por cobrar. Esto descontará el saldo pendiente y depositará la cantidad de dinero real en tu cuenta elegida.
              </CardDescription>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setIsPaymentFormOpen(false);
                  setSelectedReceivableId('');
                }}
                className="absolute right-4 top-4 size-8 rounded-lg"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleSavePayment} className="space-y-4 p-5">
              
              <div className="space-y-1.5">
                <Label htmlFor="pay-rec" className="text-xs font-black text-zinc-700">Cuenta de Cobro Origen</Label>
                <Select 
                  value={paymentForm.receivableId} 
                  onValueChange={(v) => {
                    const matched = receivables.find(r => r.id === v);
                    if (matched) {
                      setPaymentForm({
                        ...paymentForm,
                        receivableId: v,
                        amount: String(matched.minimumPayment || matched.remainingAmount),
                        notes: `Abono de ${matched.debtor} a la cuenta por cobrar: ${matched.name}`
                      });
                    }
                  }}
                  disabled={!!selectedReceivableId}
                >
                  <SelectTrigger id="pay-rec" className="h-10 font-bold text-sm">
                    <SelectValue placeholder="Elige cobro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {receivables.filter(r => r.status === 'active').map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} (Por: {r.debtor}) - Saldo: ${r.remainingAmount.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-amount" className="text-xs font-black text-zinc-700 font-sans">Monto del Abono Recibido ($) *</Label>
                <Input 
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="Ej. 150,000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-bold font-mono text-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-account" className="text-xs font-black text-zinc-700">Cuenta para Depósito *</Label>
                  <Select 
                    value={paymentForm.accountId} 
                    onValueChange={(v) => setPaymentForm({ ...paymentForm, accountId: v })}
                    required
                  >
                    <SelectTrigger id="pay-account" className="h-10 font-bold text-xs">
                      <SelectValue placeholder="Selecciona cuenta receptora..." />
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

                <div className="space-y-1.5">
                  <Label htmlFor="pay-date" className="text-xs font-black text-zinc-700">Fecha del Abono</Label>
                  <Input 
                    id="pay-date"
                    type="date"
                    required
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="h-10 text-xs focus-visible:ring-emerald-500 border-zinc-250 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-notes" className="text-xs font-black text-zinc-700">Notas o comentarios del recaudador</Label>
                <Input 
                  id="pay-notes"
                  placeholder="Ej. Transferencia Bancaria, Pago en efectivo"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="h-10 text-sm focus-visible:ring-emerald-500 border-zinc-250 font-medium"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-zinc-150">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsPaymentFormOpen(false);
                    setSelectedReceivableId('');
                  }}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold h-10 border-zinc-250 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-10 px-5 text-xs shadow-md rounded-xl flex items-center gap-1"
                >
                  <Coins className="size-3.5" /> Confirmar e Ingresar Capital
                </Button>
              </div>

            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
