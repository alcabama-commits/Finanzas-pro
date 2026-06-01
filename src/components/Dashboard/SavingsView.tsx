import React, { useState, useEffect, useMemo } from 'react';
import { SavingFund, Account, Category } from '@/src/types';
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
  PiggyBank, 
  Plus, 
  Minus, 
  Percent, 
  Calendar, 
  TrendingUp, 
  Trash2, 
  Edit3, 
  Coins, 
  ArrowRightLeft, 
  Target, 
  BadgeAlert, 
  ChevronRight,
  Info,
  X
} from 'lucide-react';

export function SavingsView() {
  const [funds, setFunds] = useState<SavingFund[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Modals state
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Selected fund for quick actions
  const [selectedFund, setSelectedFund] = useState<SavingFund | null>(null);

  // Goal Form state
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
    color: '#10b981',
    targetDate: '',
    description: '',
    accountId: ''
  });
  const [editingFundId, setEditingFundId] = useState<string | null>(null);

  // Transfer Form state
  const [transferForm, setTransferForm] = useState({
    fundId: '',
    accountId: '',
    amount: '',
    description: ''
  });

  // Load subscriptions to Collections
  useEffect(() => {
    const unsubFunds = dbService.subscribeToCollection('saving_funds', setFunds);
    const unsubAccounts = dbService.subscribeToCollection('accounts', setAccounts);
    const unsubCategories = dbService.subscribeToCollection('categories', setCategories);

    return () => {
      unsubFunds();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const totalSaved = funds.reduce((sum, f) => sum + (f.currentAmount || 0), 0);
    const totalTarget = funds.reduce((sum, f) => sum + (f.targetAmount || 0), 0);
    const progress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    const completedGoals = funds.filter(f => (f.currentAmount || 0) >= (f.targetAmount || 0)).length;
    const activeGoals = funds.length;

    return { totalSaved, totalTarget, progress, completedGoals, activeGoals };
  }, [funds]);

  // Handle open modal for new goal
  const handleOpenNewGoal = () => {
    setEditingFundId(null);
    setGoalForm({
      name: '',
      targetAmount: '',
      currentAmount: '0',
      color: '#10b981',
      targetDate: '',
      description: '',
      accountId: accounts[0]?.id || ''
    });
    setIsNewGoalOpen(true);
  };

  // Handle open edit goal
  const handleOpenEditGoal = (fund: SavingFund) => {
    setEditingFundId(fund.id);
    setGoalForm({
      name: fund.name,
      targetAmount: String(fund.targetAmount),
      currentAmount: String(fund.currentAmount || 0),
      color: fund.color || '#10b981',
      targetDate: fund.targetDate || '',
      description: fund.description || '',
      accountId: fund.accountId || ''
    });
    setIsNewGoalOpen(true);
  };

  // Save/Create savings goal
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.name.trim() || !goalForm.targetAmount) {
      toast.error('Nombre y monto objetivo son obligatorios');
      return;
    }

    const fundData = {
      name: goalForm.name.trim(),
      targetAmount: parseFloat(goalForm.targetAmount) || 0,
      currentAmount: parseFloat(goalForm.currentAmount) || 0,
      color: goalForm.color,
      targetDate: goalForm.targetDate,
      description: goalForm.description.trim(),
      accountId: goalForm.accountId || undefined
    };

    try {
      if (editingFundId) {
        await dbService.updateItem('saving_funds', editingFundId, fundData);
        toast.success(`Fondo "${fundData.name}" actualizado con éxito`);
      } else {
        await dbService.addItem('saving_funds', fundData);
        toast.success(`Fondo de ahorro "${fundData.name}" creado. ¡Hora de juntar monedas!`);
      }
      setIsNewGoalOpen(false);
    } catch (err) {
      toast.error('Error al guardar el fondo de ahorro');
    }
  };

  // Delete saving fund goal
  const handleDeleteGoal = async (fund: SavingFund) => {
    if (fund.currentAmount > 0) {
      if (!window.confirm(`Este fondo contiene $${fund.currentAmount.toLocaleString()} ahorrados. Si lo eliminas, estos registros se perderán. ¿Deseas proceder?`)) {
        return;
      }
    } else {
      if (!window.confirm(`¿Estás seguro de que deseas eliminar el fondo "${fund.name}"?`)) return;
    }

    try {
      await dbService.deleteItem('saving_funds', fund.id);
      toast.success('Fondo de ahorro retirado');
    } catch (e) {
      toast.error('Error al eliminar el fondo');
    }
  };

  // Open transfer modal (Aportar / Retirar)
  const handleOpenTransfer = (type: 'deposit' | 'withdraw', fund?: SavingFund) => {
    setTransferType(type);
    setTransferForm({
      fundId: fund ? fund.id : (funds[0]?.id || ''),
      accountId: fund?.accountId || accounts[0]?.id || '',
      amount: '',
      description: ''
    });
    setIsTransferOpen(true);
  };

  // Execute Deposit / Withdrawal transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Digita un monto mayor a cero');
      return;
    }

    const fund = funds.find(f => f.id === transferForm.fundId);
    const account = accounts.find(a => a.id === transferForm.accountId);

    if (!fund) {
      toast.error('Selecciona un fondo para ahorrar');
      return;
    }
    if (!account) {
      toast.error('Selecciona una cuenta de origen/destino');
      return;
    }

    // Business checks
    if (transferType === 'deposit') {
      if (account.balance < amount) {
        toast.error(`Fondos insuficientes en la cuenta "${account.name}". Saldo disponible: $${account.balance.toLocaleString()}`);
        return;
      }
    } else {
      if (fund.currentAmount < amount) {
        toast.error(`No hay suficiente dinero acumulado en el fondo "${fund.name}". Ahorro disponible: $${fund.currentAmount.toLocaleString()}`);
        return;
      }
    }

    try {
      // 1. Calculate new values
      const newFundAmount = transferType === 'deposit' 
        ? fund.currentAmount + amount 
        : fund.currentAmount - amount;
      
      const newAccountBalance = transferType === 'deposit'
        ? account.balance - amount
        : account.balance + amount;

      // 2. Perform updates
      await dbService.updateItem('saving_funds', fund.id, { currentAmount: newFundAmount });
      await dbService.updateItem('accounts', account.id, { balance: newAccountBalance });

      // 3. Register a real Ledger Ledger Transaction to balance books
      // Let's find an 'Ahorro' / 'Transferencia' category or find an expense category
      let savingCategory = categories.find(c => c.name.toLowerCase() === 'ahorro' || c.name.toLowerCase() === 'ahorros');
      if (!savingCategory) {
        const catId = await dbService.addItem('categories', {
          name: 'Ahorro',
          type: 'expense',
          color: '#fbbf24',
          icon: 'piggy-bank'
        });
        savingCategory = { id: catId, name: 'Ahorro', type: 'expense', color: '#fbbf24', icon: 'piggy-bank' };
      }

      // Record transaction
      await dbService.addItem('transactions', {
        amount: amount,
        type: transferType === 'deposit' ? 'expense' : 'income', // Deposit counts as a ledger expense from wallet. Withdrawal is ledger income to wallet
        categoryId: savingCategory.id,
        accountId: account.id,
        date: new Date().toISOString().split('T')[0],
        description: transferForm.description.trim() || (transferType === 'deposit' 
          ? `Aportación a fondo de ahorro "${fund.name}"`
          : `Retiro de fondos desde "${fund.name}"`
        ),
        isEventual: true // It is an occasional transaction!
      });

      toast.success(transferType === 'deposit'
        ? `¡Estupendo! Se aportaron $${amount.toLocaleString()} al fondo "${fund.name}".`
        : `Se retiraron $${amount.toLocaleString()} del fondo "${fund.name}" y se regresaron a "${account.name}".`
      );

      setIsTransferOpen(false);
    } catch (e) {
      toast.error('Error al efectuar el movimiento financiero');
    }
  };

  const colors = [
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#18181b', // Zinc
  ];

  return (
    <div className="space-y-8 animate-fade-in" id="savings-view-root">
      {/* KPIs Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Ahorro Total Acumulado</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Coins className="size-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                ${stats.totalSaved.toLocaleString()}
              </h3>
              <p className="text-zinc-400 text-[10px] mt-1 font-medium">Suma resguardada en proyectos de ahorro</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Metas y Fondos</span>
              <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
                <Target className="size-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                {stats.completedGoals} / {stats.activeGoals}
              </h3>
              <span className="text-xs text-zinc-400 font-bold uppercase">metas logradas</span>
            </div>
            <p className="text-zinc-400 text-[10px] mt-1.5 font-medium">Fondos activos completados al 100%</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Progreso Global</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Percent className="size-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                  {stats.progress.toFixed(0)}%
                </h3>
                <span className="text-[10px] text-zinc-400 font-extrabold">Objetivo: ${stats.totalTarget.toLocaleString()}</span>
              </div>
              <Progress value={stats.progress} className="h-2 bg-zinc-100" indicatorClassName="bg-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel Content */}
      <Card className="border-none shadow-lg bg-white overflow-hidden">
        <CardHeader className="border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between py-6 gap-4">
          <div>
            <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <PiggyBank className="text-emerald-500 size-5" />
              Metas de Ahorro y Fondos de Emergencia
            </CardTitle>
            <CardDescription className="text-xs">
              Resguarda dinero con propósito. Mueve saldo de tus cuentas reales para cumplir sueños, prepararte para impuestos anuales u organizar tu colchón de imprevistos.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs border-zinc-200 font-bold hover:bg-zinc-50 shrink-0"
              onClick={() => handleOpenTransfer('withdraw')}
              disabled={funds.length === 0}
            >
              <Minus className="mr-1.5 size-3.5" />
              Retirar de Fondo
            </Button>
            <Button 
              size="sm" 
              className="text-xs bg-emerald-600 hover:bg-emerald-700 font-bold text-white shrink-0 shadow-sm"
              onClick={() => handleOpenTransfer('deposit')}
              disabled={funds.length === 0}
            >
              <Plus className="mr-1.5 size-3.5" />
              Aportar Fondos
            </Button>
            <Button 
              size="sm" 
              className="text-xs bg-zinc-900 hover:bg-zinc-850 font-bold text-white shrink-0 shadow-sm"
              onClick={handleOpenNewGoal}
            >
              <Target className="mr-1.5 size-3.5" />
              Crear Meta
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {funds.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto flex flex-col items-center justify-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full">
                <PiggyBank className="size-10" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-800 text-sm">Aún no creas fondos de ahorro</h4>
                <p className="text-xs text-zinc-500 text-balance leading-relaxed">
                  ¿Preparándote para el impuesto de renta? ¿Ropa de fin de año? ¿Un viaje? Crea un fondo de ahorro ahora y planifica con anticipación para amortiguar egresos pesados.
                </p>
              </div>
              <Button 
                onClick={handleOpenNewGoal} 
                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-4 rounded-xl"
              >
                Crear Mi Primer Fondo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {funds.map(fund => {
                const isCompleted = fund.currentAmount >= fund.targetAmount;
                const ratio = fund.targetAmount > 0 ? (fund.currentAmount / fund.targetAmount) * 100 : 0;
                
                // Estimate remaining
                const remaining = Math.max(0, fund.targetAmount - fund.currentAmount);

                return (
                  <Card 
                    key={fund.id}
                    className="border border-zinc-150 shadow-sm hover:shadow-md transition-all rounded-2xl relative overflow-hidden group hover:-translate-y-0.5"
                  >
                    {/* Top Accent Color Bar */}
                    <div className="h-2 w-full" style={{ backgroundColor: fund.color || '#10b981' }} />
                    
                    <CardContent className="p-5 space-y-4">
                      {/* Name and actions */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-zinc-900 tracking-tight flex items-center gap-1.5 break-all leading-tight">
                            {fund.name}
                            {isCompleted && (
                              <Badge className="bg-emerald-50 text-emerald-700 text-[9px] hover:bg-emerald-50 font-black flex items-center gap-0.5 px-1 rounded border border-emerald-200">
                                COMPLETO
                              </Badge>
                            )}
                          </h4>
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-[10px] text-zinc-400 font-medium font-sans">
                              {fund.targetDate ? `Límite: ${new Date(fund.targetDate).toLocaleDateString('es-ES', { month: 'short', year: 'numeric', day: 'numeric' })}` : 'Sin límite temporal'}
                            </span>
                            {fund.accountId && (() => {
                              const associatedAccount = accounts.find(a => a.id === fund.accountId);
                              return associatedAccount ? (
                                <span className="text-[11px] text-zinc-650 font-semibold inline-flex items-center gap-1.5 mt-0.5">
                                  🏦 Resguardado en: <span className="text-zinc-900 font-bold underline decoration-emerald-500/40 decoration-2">{associatedAccount.name}</span>
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity animate-fade-in">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-7 text-zinc-400 hover:text-zinc-800 rounded-full"
                            onClick={() => handleOpenEditGoal(fund)}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-7 text-zinc-400 hover:text-rose-600 rounded-full"
                            onClick={() => handleDeleteGoal(fund)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Description */}
                      {fund.description && (
                        <p className="text-zinc-500 text-[11px] leading-relaxed line-clamp-2">
                          {fund.description}
                        </p>
                      )}

                      {/* Money Breakdown */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-zinc-400 uppercase font-black tracking-wider block">Acumulado</span>
                          <strong className="text-sm font-black text-zinc-900 font-mono block">
                            ${fund.currentAmount.toLocaleString()}
                          </strong>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[9px] text-zinc-400 uppercase font-black tracking-wider block">Objetivo</span>
                          <strong className="text-sm font-bold text-zinc-500 font-mono block">
                            ${fund.targetAmount.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1 pt-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-zinc-400">Progreso de la meta</span>
                          <span className="font-bold text-zinc-800">{ratio.toFixed(0)}%</span>
                        </div>
                        <Progress 
                          value={Math.min(100, ratio)} 
                          className="h-1.5 bg-zinc-50 rounded-full" 
                          style={{ '--progress-color': fund.color || '#10b981' } as any}
                          indicatorClassName="bg-[var(--progress-color)] transition-all"
                        />
                      </div>

                      {/* Days or remaining sum info */}
                      {!isCompleted ? (
                        <p className="text-[10px] text-zinc-500 leading-tight">
                          Faltan <span className="font-extrabold text-zinc-800">${remaining.toLocaleString()}</span> para alcanzar tu meta.
                        </p>
                      ) : (
                        <p className="text-[10px] text-emerald-600 leading-tight font-semibold flex items-center gap-1">
                          🎉 ¡Enhorabuena! Has financiado este fondo por completo.
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="p-3 bg-zinc-50 border-t flex gap-2 justify-end rounded-b-2xl">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px] h-7 px-2 font-bold hover:bg-zinc-100 rounded-md gap-1"
                        onClick={() => handleOpenTransfer('withdraw', fund)}
                        disabled={fund.currentAmount <= 0}
                      >
                        <Minus className="size-3" /> Retirar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px] h-7 px-2 font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md gap-1"
                        onClick={() => handleOpenTransfer('deposit', fund)}
                      >
                        <Plus className="size-3" /> Aportar
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: CREATE / EDIT SAVINGS GOAL */}
      {isNewGoalOpen && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md border-none shadow-2xl bg-white relative">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700"
              onClick={() => setIsNewGoalOpen(false)}
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-zinc-900">
                {editingFundId ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro / Fondo'}
              </CardTitle>
              <CardDescription className="text-xs">
                Establece un propósito financiero. Los ahorros se incrementan transfiriendo dinero desde tus cuentas activas.
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSaveGoal}>
              <CardContent className="space-y-4 max-h-[460px] overflow-y-auto">
                <div className="space-y-1">
                  <Label htmlFor="goal-name">Nombre del Fondo</Label>
                  <Input 
                    id="goal-name"
                    placeholder="Ej. Impuestos del Auto, Ropa de Invierno..."
                    value={goalForm.name}
                    onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="goal-target">Monto Objetivo ($)</Label>
                    <Input 
                      id="goal-target"
                      type="number"
                      step="any"
                      placeholder="Monto meta"
                      value={goalForm.targetAmount}
                      onChange={e => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="goal-current">Aporte Inicial ($)</Label>
                    <Input 
                      id="goal-current"
                      type="number"
                      step="any"
                      placeholder="Saldo actual"
                      value={goalForm.currentAmount}
                      onChange={e => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                      disabled={Boolean(editingFundId)} // Keep immutable inside edit mode for integrity
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="goal-account">¿Dónde está este dinero ahorrado? (Cuenta de Resguardo)</Label>
                    <Select 
                      value={goalForm.accountId} 
                      onValueChange={(val) => setGoalForm({ ...goalForm, accountId: val })}
                    >
                      <SelectTrigger id="goal-account" className="h-9.5 text-xs rounded-lg bg-white border-zinc-200">
                        <SelectValue placeholder="Elegir cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            <span>{acc.name} (${acc.balance.toLocaleString()})</span>
                          </SelectItem>
                        ))}
                        {accounts.length === 0 && (
                          <SelectItem value="_no_accounts" disabled>No hay cuentas disponibles</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="goal-date">Fecha Límite / Objetivo (Opcional)</Label>
                    <Input 
                      id="goal-date"
                      type="date"
                      className="h-9.5 text-xs rounded-lg bg-white border-zinc-200"
                      value={goalForm.targetDate}
                      onChange={e => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Color del Proyecto</Label>
                  <div className="flex gap-2.5 flex-wrap">
                    {colors.map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setGoalForm({ ...goalForm, color })}
                        className={`size-7 rounded-full border transition-all ${
                          goalForm.color === color 
                            ? 'border-zinc-900 scale-110 shadow-sm ring-2 ring-zinc-200' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="goal-desc">Descripción (Opcional)</Label>
                  <Input 
                    id="goal-desc"
                    placeholder="Escribe detalles o notas sobre este fondo..."
                    value={goalForm.description}
                    onChange={e => setGoalForm({ ...goalForm, description: e.target.value })}
                  />
                </div>
              </CardContent>

              <CardFooter className="py-4 bg-zinc-50 border-t flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewGoalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-zinc-900 hover:bg-zinc-850 text-white"
                >
                  {editingFundId ? 'Guardar Cambios' : 'Crear Meta'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: TRANSFER FUNDS (APORTAR / RETIRAR) */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md border-none shadow-2xl bg-white relative">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700"
              onClick={() => setIsTransferOpen(false)}
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-1.5">
                <ArrowRightLeft className="text-emerald-500 size-5" />
                {transferType === 'deposit' ? 'Aportar Dinero a Fondo' : 'Retirar Dinero de Fondo'}
              </CardTitle>
              <CardDescription className="text-xs">
                Mueve capital de forma transparente. Las transacciones se generarán en tu historial de gastos/ingresos bajo la categoría de de Ahorro para cuadrar tus cuentas de forma rigurosa.
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleExecuteTransfer}>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="transfer-fund">Seleccionar Fondo</Label>
                  <Select 
                    value={transferForm.fundId} 
                    onValueChange={(val) => setTransferForm({ ...transferForm, fundId: val })}
                  >
                    <SelectTrigger id="transfer-fund">
                      <SelectValue placeholder="Elegir fondo" />
                    </SelectTrigger>
                    <SelectContent>
                      {funds.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                            <span>{f.name} (Saldo: ${f.currentAmount.toLocaleString()})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="transfer-acc">
                    {transferType === 'deposit' ? 'Cuenta de Origen (Se descontará)' : 'Cuenta de Destino (Se sumará)'}
                  </Label>
                  <Select 
                    value={transferForm.accountId} 
                    onValueChange={(val) => setTransferForm({ ...transferForm, accountId: val })}
                  >
                    <SelectTrigger id="transfer-acc">
                      <SelectValue placeholder="Elegir cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <span>{acc.name} (Saldo disponible: ${acc.balance.toLocaleString()})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="transfer-amount">Monto a mover ($)</Label>
                  <Input 
                    id="transfer-amount"
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={transferForm.amount}
                    onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="transfer-desc">Concepto opcional de transacción</Label>
                  <Input 
                    id="transfer-desc"
                    placeholder={transferType === 'deposit' ? 'Ej. Ahorro de propina, Alquiler' : 'Ej. Compra de abrigo'}
                    value={transferForm.description}
                    onChange={e => setTransferForm({ ...transferForm, description: e.target.value })}
                  />
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex gap-2 items-start text-[11px] text-zinc-650 leading-relaxed">
                  <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {transferType === 'deposit' 
                      ? 'Este movimiento debitará de tu cuenta y lo sumará a tus ahorros. En el ledger figurará como egreso de Ahorro para no interferir con tu flujo neto.'
                      : 'Este movimiento sumará fondos a tu billetera activa disminuyendo tu meta. Figurará como un ingreso de Ahorro.'
                    }
                  </p>
                </div>
              </CardContent>

              <CardFooter className="py-4 bg-zinc-50 border-t flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsTransferOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className={transferType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
                >
                  {transferType === 'deposit' ? 'Confirmar Aporte' : 'Confirmar Retiro'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
