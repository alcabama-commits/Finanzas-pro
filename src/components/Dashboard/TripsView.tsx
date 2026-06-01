import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plane, 
  MapPin, 
  Compass, 
  Palmtree, 
  Hotel, 
  Receipt,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Store,
  PiggyBank,
  ArrowRight,
  Plus,
  Trash2,
  CalendarDays,
  X,
  Luggage,
  CalendarCheck,
  Check
} from 'lucide-react';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { Transaction, Account, Category, UserSettings, SavingFund, Debt } from '@/src/types';

interface TripsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  settings?: UserSettings | null;
}

interface TravelPreset {
  id: string;
  name: string;
  label: string;
  defaultDescription: string;
}

export function TripsView({ transactions, accounts, categories, settings }: TripsViewProps) {
  // Query catalogs colaborativos
  const [catalogStores, setCatalogStores] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  useEffect(() => {
    const unsubS = dbService.subscribeToCollection('catalog_stores', setCatalogStores);
    const unsubP = dbService.subscribeToCollection('catalog', setCatalogProducts);
    return () => {
      unsubS();
      unsubP();
    };
  }, []);

  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountSplits, setAccountSplits] = useState<Record<string, string>>({});
  const [destinationTag, setDestinationTag] = useState('');
  const [isEventual, setIsEventual] = useState(true);

  // Linkings to store/stock
  const [tempFilterStoreType, setTempFilterStoreType] = useState('all');
  const [selectedLinkedStoreId, setSelectedLinkedStoreId] = useState('');
  const [selectedLinkedProductId, setSelectedLinkedProductId] = useState('');
  const [decreaseStockQty, setDecreaseStockQty] = useState('0');

  // Saving goals / funds integration
  const [savingFunds, setSavingFunds] = useState<SavingFund[]>([]);
  const [linkedSavingFundId, setLinkedSavingFundId] = useState('');
  const [fundDeductionInput, setFundDeductionInput] = useState('');

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payWithDebt, setPayWithDebt] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

  // Subscribe to debts list
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('debts', setDebts);
    return () => unsub();
  }, []);

  // Load Saving Funds
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('saving_funds', setSavingFunds);
    return () => unsub();
  }, []);

  // Set default account on load
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([accounts[0].id]);
    }
  }, [accounts, selectedAccountIds]);

  // Pre-select physical account if matching fund selected
  useEffect(() => {
    if (linkedSavingFundId) {
      const fund = savingFunds.find(f => f.id === linkedSavingFundId);
      if (fund && fund.accountId) {
        const accExists = accounts.some(a => a.id === fund.accountId);
        if (accExists) {
          setSelectedAccountIds([fund.accountId]);
        }
      }
    }
  }, [linkedSavingFundId, savingFunds, accounts]);

  // Sync fund deduction inputs
  const numericAmount = parseFloat(amount) || 0;
  
  useEffect(() => {
    if (linkedSavingFundId) {
      const fund = savingFunds.find(f => f.id === linkedSavingFundId);
      if (fund) {
        const defaultDeduction = Math.min(numericAmount, fund.currentAmount);
        setFundDeductionInput(String(defaultDeduction));
      }
    } else {
      setFundDeductionInput('');
    }
  }, [linkedSavingFundId, numericAmount, savingFunds]);

  const accountDeductionAmount = useMemo(() => {
    if (!linkedSavingFundId) return numericAmount;
    const fDed = parseFloat(fundDeductionInput) || 0;
    return Math.max(0, numericAmount - fDed);
  }, [linkedSavingFundId, fundDeductionInput, numericAmount]);

  // Auto split calculation for multi accounts
  useEffect(() => {
    const M = selectedAccountIds.length;
    if (M <= 1) {
      setAccountSplits({});
      return;
    }

    const total = accountDeductionAmount;
    if (total <= 0) {
      const emptySplits: Record<string, string> = {};
      selectedAccountIds.forEach(id => {
        emptySplits[id] = '';
      });
      setAccountSplits(emptySplits);
      return;
    }

    const baseVal = Math.floor(total / M);
    const remainder = total - (baseVal * M);
    const newSplits: Record<string, string> = {};
    selectedAccountIds.forEach((id, idx) => {
      newSplits[id] = String(baseVal + (idx < remainder ? 1 : 0));
    });
    setAccountSplits(newSplits);
  }, [accountDeductionAmount, selectedAccountIds]);

  const currentSplitsSum = useMemo(() => {
    if (selectedAccountIds.length <= 1) return accountDeductionAmount;
    return selectedAccountIds.reduce((sum, id) => {
      return sum + (parseFloat(accountSplits[id]) || 0);
    }, 0);
  }, [selectedAccountIds, accountSplits, accountDeductionAmount]);

  const isSplitValid = useMemo(() => {
    if (selectedAccountIds.length <= 1) return true;
    return Math.abs(currentSplitsSum - accountDeductionAmount) < 0.01;
  }, [selectedAccountIds, currentSplitsSum, accountDeductionAmount]);

  // Filter stores which are for Travel (or all for flexibility)
  const filteredStoresForPayment = useMemo(() => {
    if (tempFilterStoreType === 'all') return catalogStores;
    return catalogStores.filter(s => s.type === tempFilterStoreType);
  }, [catalogStores, tempFilterStoreType]);

  const productsForSelectedStore = useMemo(() => {
    if (!selectedLinkedStoreId) return [];
    const storeObj = catalogStores.find(s => s.id === selectedLinkedStoreId);
    if (!storeObj) return [];
    return catalogProducts.filter(p => p.store && p.store.toLowerCase() === storeObj.name.toLowerCase());
  }, [catalogProducts, selectedLinkedStoreId, catalogStores]);

  const selectedProductObj = useMemo(() => {
    return catalogProducts.find(p => p.id === selectedLinkedProductId);
  }, [catalogProducts, selectedLinkedProductId]);

  // Parsing previous destinations in transaction history for instant suggestions!
  const previousDestinations = useMemo(() => {
    const destSet = new Set<string>();
    transactions.forEach(t => {
      const match = t.description.match(/^\[([^\]]+)\]/);
      if (match) {
        destSet.add(match[1]);
      }
    });
    return Array.from(destSet);
  }, [transactions]);

  // Find or determine a clean placeholder category or Travel category
  const travelCategory = useMemo(() => {
    const found = categories.find(c => 
      c.name.toLowerCase().includes('viaje') || 
      c.name.toLowerCase().includes('turismo') || 
      c.name.toLowerCase().includes('hotel') ||
      c.name.toLowerCase().includes('transporte')
    );
    return found || categories[0] || null;
  }, [categories]);

  // Quick Presets
  const travelPresets: TravelPreset[] = [
    { id: 'flights', name: '🛫 Pasajes', label: 'Pasajes / Vuelos', defaultDescription: 'Compra de Boletos / Ticketes' },
    { id: 'hotels', name: '🏨 Hospedaje', label: 'Hospedaje / Hotel', defaultDescription: 'Reserva de Estadía' },
    { id: 'dining', name: '🍽️ Viáticos', label: 'Comida / Restaurantes', defaultDescription: 'Consumos de Alimentación' },
    { id: 'tours', name: '🎟️ Actividades', label: 'Tours / Entradas', defaultDescription: 'Paseos y Entradas turísticas' },
    { id: 'shopping', name: '🛍️ Souvenirs', label: 'Compras / Regalos', defaultDescription: 'Souvenirs y Compras en el viaje' }
  ];

  const handleAccountClick = (e: React.MouseEvent, accId: string) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedAccountIds.includes(accId)) {
        if (selectedAccountIds.length > 1) {
          setSelectedAccountIds(selectedAccountIds.filter(id => id !== accId));
        }
      } else {
        setSelectedAccountIds([...selectedAccountIds, accId]);
      }
    } else {
      setSelectedAccountIds([accId]);
    }
  };

  const handleApplyPreset = (preset: TravelPreset) => {
    setActivePreset(preset.id);
    const destPrefix = destinationTag.trim() ? `[${destinationTag.toUpperCase().trim()}] ` : '';
    setDescription(`${destPrefix}${preset.defaultDescription}`);
  };

  const handleSubmitTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payWithDebt) {
      if (!selectedDebtId) {
        toast.error('Selecciona una tarjeta o crédito rotativo para diferir este gasto de viaje.');
        return;
      }
    } else {
      if (selectedAccountIds.length === 0) {
        toast.error('Selecciona al menos una cuenta de origen.');
        return;
      }
      if (selectedAccountIds.length > 1 && !isSplitValid) {
        toast.error('La suma de los montos distribuidos debe coincidir con el monto de la cuenta.');
        return;
      }
    }

    if (numericAmount <= 0) {
      toast.error('Ingresa un monto de pago válido superior a 0.');
      return;
    }
    if (!travelCategory) {
      toast.error('Debes tener al menos una categoría de egresos configurada.');
      return;
    }

    setIsSaving(true);
    try {
      // Add Destination Tag to description
      const prefix = destinationTag.trim() ? `[${destinationTag.toUpperCase().trim()}] ` : '[VIAJE] ';
      const baseDesc = description.trim() || 'Gasto de Viaje';
      const fullDesc = `${prefix}${baseDesc}`;

      // Special Flow: Pay with Debt
      if (payWithDebt) {
        const debtObj = debts.find(d => d.id === selectedDebtId);
        if (!debtObj) throw new Error('Deuda seleccionada no encontrada');

        // 1. Create Transaction
        await dbService.addItem('transactions', {
          amount: numericAmount,
          type: 'expense',
          categoryId: travelCategory.id,
          accountId: '',
          date: new Date(date).toISOString(),
          description: `${fullDesc} (Cargado a Deuda: ${debtObj.name})`,
          isEventual: isEventual,
          subcategory: 'Viajes',
          createdAt: new Date().toISOString(),
          paidWithDebt: true,
          debtId: selectedDebtId
        });

        // 2. Increase Debt balance
        const currentRemaining = Number(debtObj.remainingAmount) || 0;
        await dbService.updateItem('debts', debtObj.id, {
          remainingAmount: currentRemaining + numericAmount
        });

        toast.warning('⚠️ ¡Gasto de viaje con deuda registrado! Esto aumenta tu pasivo y te aleja de tu libertad financiera.');
        
        // Reset states
        setAmount('');
        setDescription('');
        setPayWithDebt(false);
        setSelectedDebtId('');
        setIsSaving(false);
        return;
      }

      const finalFundDeduction = linkedSavingFundId ? (parseFloat(fundDeductionInput) || 0) : 0;
      const finalAccountDeduction = Math.max(0, numericAmount - finalFundDeduction);

      const targetFund = linkedSavingFundId ? savingFunds.find(f => f.id === linkedSavingFundId) : null;
      const finalDescription = targetFund 
        ? `${fullDesc} (Fondo: $${finalFundDeduction.toLocaleString()}, Cuenta: $${finalAccountDeduction.toLocaleString()} de ${targetFund.name})` 
        : fullDesc;

      // Single Account
      if (selectedAccountIds.length === 1) {
        const targetAccId = selectedAccountIds[0];
        const targetAccount = accounts.find(a => a.id === targetAccId);
        if (!targetAccount) throw new Error('Cuenta origen no encontrada');

        await dbService.addItem('transactions', {
          amount: finalAccountDeduction,
          type: 'expense',
          categoryId: travelCategory.id,
          accountId: targetAccId,
          date: new Date(date).toISOString(),
          description: finalDescription,
          isEventual: isEventual,
          subcategory: 'Viajes',
          createdAt: new Date().toISOString()
        });

        const currentBalance = Number(targetAccount.balance) || 0;
        await dbService.updateItem('accounts', targetAccount.id, {
          balance: currentBalance - finalAccountDeduction
        });
      } else {
        // Multi Accounts Split
        for (const targetAccId of selectedAccountIds) {
          const splitVal = parseFloat(accountSplits[targetAccId]) || 0;
          if (splitVal <= 0) continue;

          const targetAccount = accounts.find(a => a.id === targetAccId);
          if (!targetAccount) throw new Error(`Cuenta origen ${targetAccId} no encontrada`);

          const multiDescription = targetFund
            ? `${fullDesc} (Split ${targetAccount.name}) (Fondo: $${finalFundDeduction.toLocaleString()}, Cuenta: $${splitVal.toLocaleString()} de ${targetFund.name})`
            : `${fullDesc} (Split ${targetAccount.name})`;

          await dbService.addItem('transactions', {
            amount: splitVal,
            type: 'expense',
            categoryId: travelCategory.id,
            accountId: targetAccId,
            date: new Date(date).toISOString(),
            description: multiDescription,
            isEventual: isEventual,
            subcategory: 'Viajes',
            createdAt: new Date().toISOString()
          });

          const currentBalance = Number(targetAccount.balance) || 0;
          await dbService.updateItem('accounts', targetAccount.id, {
            balance: currentBalance - splitVal
          });
        }
      }

      // Deduct saving fund
      if (targetFund && finalFundDeduction > 0) {
        const currentFundAmount = Number(targetFund.currentAmount) || 0;
        const newFundAmount = Math.max(0, currentFundAmount - finalFundDeduction);
        await dbService.updateItem('saving_funds', targetFund.id, {
          currentAmount: newFundAmount,
          updatedAt: new Date().toISOString()
        });
        toast.success(`🎯 Se debitaron $${finalFundDeduction.toLocaleString('es-ES')} de tu fondo de ahorro "${targetFund.name}".`);
      }

      // Update product stocks inside catalog
      if (selectedLinkedProductId) {
        const prod = catalogProducts.find(p => p.id === selectedLinkedProductId);
        const qtyToDecrease = parseInt(decreaseStockQty) || 0;
        if (prod && qtyToDecrease > 0) {
          const currentStock = Number(prod.stock) || 0;
          const newStock = Math.max(0, currentStock - qtyToDecrease);
          await dbService.updateItem('catalog', prod.id, { stock: newStock });
          toast.success(`📦 Stock de "${prod.name}" descontado a ${newStock} unidades.`);
        }
      }

      toast.success('✈️ ¡Reserva / Compra de viaje asentada correctamente!');
      setAmount('');
      setDescription('');
      setActivePreset(null);
      setLinkedSavingFundId('');
      setSelectedLinkedStoreId('');
      setSelectedLinkedProductId('');
      setDecreaseStockQty('0');
    } catch (err: any) {
      console.error(err);
      toast.error('Ocurrió un error al asentar el gasto del viaje.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter transactions showing only Travel transactions
  const travelHistoryTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Return true if description matches [Trip] pattern or subcategory is Viajes or category has travel terms!
      const isTripDesc = t.description.match(/^\[([^\]]+)\]/);
      const isViajesSub = t.subcategory === 'Viajes';
      const isTravelCat = travelCategory && t.categoryId === travelCategory.id;
      return t.type === 'expense' && (isTripDesc || isViajesSub || isTravelCat);
    });
  }, [transactions, travelCategory]);

  const travelDestinationSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    travelHistoryTransactions.forEach(t => {
      const match = t.description.match(/^\[([^\]]+)\]/);
      const dest = match ? match[1].toUpperCase() : 'OTROS';
      summary[dest] = (summary[dest] || 0) + t.amount;
    });
    return Object.entries(summary).sort((a,b) => b[1] - a[1]);
  }, [travelHistoryTransactions]);

  const translateType = (type: string) => {
    switch (type) {
      case 'store': return '🏪 Negocio / Tienda';
      case 'provider': return '🚚 Proveedor';
      case 'service': return '🔧 Servicio';
      case 'consumption': return '🛍️ Consumos';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card with travel visual accents */}
      <Card className="border-sky-100 bg-sky-50/20 overflow-hidden relative shadow-xs">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Palmtree className="size-24 text-sky-600 animate-pulse" />
        </div>
        <div className="absolute top-10 left-1/3 p-4 opacity-5">
          <Compass className="size-32 text-indigo-600 animate-spin" style={{ animationDuration: '40s' }} />
        </div>

        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md animate-bounce">
              <Plane className="size-5 rotate-45" />
            </div>
            <div>
              <CardTitle className="text-base font-black tracking-tight text-zinc-900">
                Bitácora de Gastos y Reservas de Viajes
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 font-medium">
                Planifica presupuestos, reserva hospedaje, vuelos y viáticos con liquidación de fondos de ahorro y descuento de stock.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid of contents: Form side VS active trips side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left column: Travel payment registration (7/12 grid) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-zinc-200/80 shadow-md rounded-2xl overflow-hidden bg-white">
            <CardHeader className="border-b border-zinc-100 pb-3 bg-zinc-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase text-sky-850 tracking-wider">
                    Registrar Costo / Reserva del Viaje
                  </CardTitle>
                  <CardDescription className="text-[10px] text-zinc-400 font-semibold block leading-none">
                    Deduce directamente de tus saldos reales y fondos acumulados.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-sky-100/60 text-sky-800 border-sky-200/50 text-[9px] font-bold">
                  Categoría: {travelCategory?.name || 'Viajes'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">

              {/* Trip Target tagger */}
              <div className="space-y-1.5 p-3.5 bg-sky-50/40 border border-sky-100 rounded-xl">
                <Label htmlFor="trip-tag" className="text-xs font-bold text-sky-950 flex items-center gap-1">
                  <MapPin className="size-3.5 text-sky-600 shrink-0" />
                  <span>Destino / Nombre del Viaje *</span>
                </Label>
                <div className="flex flex-col gap-1">
                  <Input 
                    id="trip-tag"
                    placeholder="Ej: CANCUN 2026, EUROPA, SAN ANDRES"
                    className="h-9 text-xs font-bold font-mono tracking-wider text-sky-900 placeholder:text-zinc-400 border-sky-150"
                    value={destinationTag}
                    onChange={(e) => setDestinationTag(e.target.value)}
                  />
                  {previousDestinations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                      <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider block mr-1">Tus viajes:</span>
                      {previousDestinations.slice(0, 5).map((dest, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDestinationTag(dest)}
                          className="bg-white border border-sky-200 text-sky-850 hover:bg-sky-50 text-[9px] font-bold tracking-tight px-1.5 py-0.5 rounded-full transition-all"
                        >
                          📍 {dest}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick travel presets */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                  Plantillas Rápidas de Gasto
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {travelPresets.map((preset) => {
                    const isSelected = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-bold transition-all ${
                          isSelected
                            ? 'bg-sky-50 border-sky-500 text-sky-800 shadow-3xs'
                            : 'bg-white border-zinc-150 text-zinc-650 hover:border-zinc-350 hover:bg-zinc-50'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmitTrip} className="space-y-4">
                {/* Option to pay with debt */}
                <div className="bg-rose-50/40 border border-rose-100/80 p-3 rounded-xl flex items-center justify-between shadow-3xs">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider flex items-center gap-1">
                      🔴 Pagar con Deuda
                    </span>
                    <span className="text-[9.5px] font-semibold text-rose-600">
                      Cargar gasto de viaje a tarjeta o crédito rotativo (Te aleja de la libertad financiera)
                    </span>
                  </div>
                  <input
                    id="trip-pay-with-debt-checkbox"
                    type="checkbox"
                    className="size-4.5 rounded text-rose-600 border-rose-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
                    checked={payWithDebt}
                    onChange={(e) => setPayWithDebt(e.target.checked)}
                  />
                </div>

                {!payWithDebt ? (
                  /* Visual Account Selector with Balances - Standard flow */
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-700 flex justify-between items-center">
                      <span>Origen de Fondos *</span>
                      <span className="text-[10px] text-zinc-400 font-bold bg-zinc-100 px-1.5 py-0.5 rounded">Ctrl + Click para multi cuentas</span>
                    </Label>
                    <p className="text-[10px] text-zinc-400 italic block leading-none mb-1">
                      Selecciona en cuál cuenta repercute el costo extra del viaje.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {accounts.map((acc) => {
                        const isSelected = selectedAccountIds.includes(acc.id);
                        const accountFunds = savingFunds.filter(f => f.accountId === acc.id);
                        const totalSaved = accountFunds.reduce((sum, f) => sum + (f.currentAmount || 0), 0);
                        const availableBalance = Math.max(0, (Number(acc.balance) || 0) - totalSaved);

                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={(e) => handleAccountClick(e, acc.id)}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all w-full relative ${
                              isSelected
                                ? 'border-zinc-950 bg-zinc-50/80 ring-1 ring-zinc-950 shadow-xs'
                                : 'border-zinc-150 hover:bg-zinc-50/40 bg-white'
                            }`}
                          >
                            <div 
                              className="p-1 rounded-md shrink-0 flex items-center justify-center text-white"
                              style={{ backgroundColor: acc.color || '#334155' }}
                            >
                              <Wallet className="size-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-zinc-900 truncate tracking-tight">{acc.name}</p>
                              <div className="text-[10px] font-semibold tracking-tight">
                                <span className="text-emerald-750 font-bold block">Disp: ${availableBalance.toLocaleString()}</span>
                                {totalSaved > 0 && (
                                  <span className="text-zinc-400 text-[9px] block">Res: ${totalSaved.toLocaleString()} | Tot: ${acc.balance.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="size-4 text-emerald-600 absolute right-2.5 top-2.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Debt selector when payWithDebt is active */
                  <div className="space-y-2 p-3.5 bg-rose-50/30 border border-rose-100/60 rounded-xl">
                    <Label htmlFor="trip-debt-id" className="text-xs font-bold text-rose-800 flex items-center gap-1">
                      💳 Seleccionar Tarjeta de Crédito o Crédito Rotativo *
                    </Label>
                    <p className="text-[10px] text-zinc-500 font-semibold leading-relaxed">
                      Elige a qué tarjeta o crédito rotativo existente deseas cargar este gasto de viaje. Esto aumentará tu deuda inmediatamente.
                    </p>
                    <select
                      id="trip-debt-id"
                      required
                      className="w-full h-10 px-3 bg-white border border-rose-200 rounded-lg text-xs text-rose-950 font-bold outline-none focus:ring-1 focus:ring-rose-500"
                      value={selectedDebtId}
                      onChange={(e) => setSelectedDebtId(e.target.value)}
                    >
                      <option value="" className="font-semibold text-zinc-500">-- Elige tarjeta/crédito rotativo --</option>
                      {debts
                        .filter(d => d.type === 'credit_card' || d.type === 'revolving')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            💳 {d.name} ({d.creditor}) | Deuda actual: ${d.remainingAmount.toLocaleString()}
                          </option>
                        ))}
                    </select>
                    {debts.filter(d => d.type === 'credit_card' || d.type === 'revolving').length === 0 && (
                      <p className="text-[9.5px] text-rose-600 font-bold mt-1">
                        ⚠️ No tienes tarjetas de crédito o créditos rotativos registrados en la sección "Deudas". Agrégalos primero para poder pagar con deuda.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="trip-amount" className="text-xs font-bold text-zinc-700">Monto Total ($) *</Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">$</span>
                      <Input
                        id="trip-amount"
                        type="number"
                        placeholder="0.00"
                        min="1"
                        required
                        className="pl-8 h-10 font-mono text-sm font-semibold border-zinc-200"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="trip-date" className="text-xs font-bold text-zinc-700">Fecha del Pago *</Label>
                    <Input
                      id="trip-date"
                      type="date"
                      required
                      className="h-10 text-xs border-zinc-200"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Account splits list panel */}
                {selectedAccountIds.length > 1 && (
                  <div className="space-y-2 mt-2 p-3.5 border border-zinc-200 bg-zinc-50 rounded-xl">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                        <RefreshCw className="size-3 text-sky-600 animate-spin" />
                        Distribución Multipago ({selectedAccountIds.length} Cuentas)
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          const M = selectedAccountIds.length;
                          const total = accountDeductionAmount;
                          const baseVal = Math.floor(total / M);
                          const remainder = total - (baseVal * M);
                          const newSplits: Record<string, string> = {};
                          selectedAccountIds.forEach((id, idx) => {
                            newSplits[id] = String(baseVal + (idx < remainder ? 1 : 0));
                          });
                          setAccountSplits(newSplits);
                        }}
                        className="text-[10px] text-sky-650 hover:text-sky-850 font-bold tracking-tight underline"
                      >
                        Equilibrar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mt-1">
                      {selectedAccountIds.map(accId => {
                        const acc = accounts.find(a => a.id === accId);
                        if (!acc) return null;
                        const splitStr = accountSplits[accId] || '';
                        return (
                          <div key={accId} className="flex items-center justify-between gap-2 p-1.5 border border-zinc-150 rounded-lg bg-white">
                            <span className="text-[10px] font-bold text-zinc-700 truncate">{acc.name}</span>
                            <div className="relative w-24 shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[9px] font-mono">$</span>
                              <Input
                                type="number"
                                className="h-7 pl-4.5 text-xs text-right font-semibold pr-1 border-zinc-200 font-mono"
                                value={splitStr}
                                onChange={(e) => setAccountSplits({
                                  ...accountSplits,
                                  [accId]: e.target.value
                                })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between text-[9px] font-bold text-zinc-500 pt-1 border-t border-dashed border-zinc-200">
                      <span>Restante a distribuir por cuentas:</span>
                      <span className={isSplitValid ? 'text-emerald-700' : 'text-rose-650'}>
                        Suma Splits: ${currentSplitsSum.toLocaleString()} / Meta Cobertura: ${accountDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Savings Goal Integration (Request 1 logic built inside trips!) */}
                <div className="space-y-1.5 p-3.5 border border-zinc-200 bg-zinc-50/40 rounded-xl">
                  <Label htmlFor="trip-linked-fund" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    <PiggyBank className="size-4 text-emerald-600" />
                    <span>Financiar con Fondo de Ahorro / Presupuesto Acumulado</span>
                  </Label>
                  <p className="text-[10px] text-zinc-400 font-medium leading-tight">
                    Descuenta este pago del dinero que ya guardaste para viajes.
                  </p>
                  <select
                    id="trip-linked-fund"
                    className="w-full h-10 px-3 mt-1 bg-white border border-zinc-200 rounded-lg text-xs"
                    value={linkedSavingFundId}
                    onChange={(e) => setLinkedSavingFundId(e.target.value)}
                  >
                    <option value="">-- No usar fondos de ahorro (Pagar 100% de la Cuenta) --</option>
                    {savingFunds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        🎯 {fund.name} (Ahorrado: ${fund.currentAmount.toLocaleString()} / Meta: ${fund.targetAmount.toLocaleString()})
                      </option>
                    ))}
                  </select>

                  {linkedSavingFundId && (() => {
                    const fund = savingFunds.find(f => f.id === linkedSavingFundId);
                    if (!fund) return null;

                    return (
                      <div className="mt-3 p-3 bg-white border border-zinc-250 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                            Distribución Especial (Ahorro vs. Cuentas)
                          </span>
                          <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Fondo activo
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="trip-fund-deduct" className="text-[10px] font-bold text-emerald-700">Monto del Fondo</Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-[10px]">$</span>
                              <Input
                                id="trip-fund-deduct"
                                type="number"
                                className="h-8 pl-5.5 text-xs font-bold text-zinc-800 pr-1 border-zinc-200 font-mono"
                                value={fundDeductionInput}
                                max={fund.currentAmount}
                                onChange={(e) => setFundDeductionInput(e.target.value)}
                              />
                            </div>
                            <span className="text-[9px] text-zinc-500 font-semibold block">Disponible: ${fund.currentAmount.toLocaleString()}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-indigo-700 block">Deducir de Cuenta(s)</span>
                            <div className="h-8 px-2.5 border border-zinc-250 bg-zinc-50/80 text-zinc-700 rounded-lg flex items-center justify-between font-mono font-bold text-xs">
                              <span>$</span>
                              <span>{accountDeductionAmount.toLocaleString()}</span>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-semibold block">Costo total: ${numericAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        {parseFloat(fundDeductionInput) > fund.currentAmount && (
                          <p className="text-[9.5px] text-rose-600 font-bold">
                            ⚠️ El monto solicitado excede el acumulado de este fondo (${fund.currentAmount.toLocaleString()}).
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* VINCULACIÓN AL CATÁLOGO (Request 2 logic connected to catalog and stock) */}
                <div className="space-y-1.5 p-3.5 border border-rose-150 bg-rose-50/10 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-800">
                    <Store className="size-4 shrink-0 text-rose-600" />
                    <span className="text-xs font-bold">Vincular Proveedor / Agencia de Turismo</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    Asigna hoteles, transportadores o aerolíneas del catálogo colaborativo. Si manejas stock (ej: noches pre-pagas o vouchers), podrás descontarlos.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-zinc-500">Filtrar Proveedores por Tipo</Label>
                      <select
                        className="w-full h-8 px-2 bg-white border border-zinc-250 rounded-lg text-[10px] text-zinc-700 outline-none hover:border-zinc-350"
                        value={tempFilterStoreType}
                        onChange={(e) => {
                          setTempFilterStoreType(e.target.value);
                          setSelectedLinkedStoreId('');
                          setSelectedLinkedProductId('');
                        }}
                      >
                        <option value="all">🔍 Todos ({catalogStores.length})</option>
                        <option value="store">🏪 Tiendas y Supermercados</option>
                        <option value="provider">🚚 Proveedores</option>
                        <option value="service">🔧 Servicios / Agencias</option>
                        <option value="consumption">🛍️ Consumos Internos</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-zinc-500">Seleccionar Proveedor del Catálogo</Label>
                      <select
                        className="w-full h-8 px-2 bg-white border border-zinc-250 rounded-lg text-[10px] text-zinc-750 outline-none hover:border-zinc-350 font-bold"
                        value={selectedLinkedStoreId}
                        onChange={(e) => {
                          setSelectedLinkedStoreId(e.target.value);
                          setSelectedLinkedProductId('');
                        }}
                      >
                        <option value="">-- Sin vincular proveedor --</option>
                        {filteredStoresForPayment.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({translateType(st.type)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedLinkedStoreId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-dashed border-zinc-200">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-zinc-500">Voucher / Artículo de Catalogo</Label>
                        <select
                          className="w-full h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10px] text-zinc-700"
                          value={selectedLinkedProductId}
                          onChange={(e) => {
                            const prodId = e.target.value;
                            setSelectedLinkedProductId(prodId);
                            if (prodId) {
                              const prod = catalogProducts.find(p => p.id === prodId);
                              if (prod) {
                                if (prod.price) setAmount(String(prod.price));
                                const destPrefix = destinationTag.trim() ? `[${destinationTag.toUpperCase().trim()}] ` : '';
                                setDescription(`${destPrefix}Reserva de ${prod.name} en ${prod.store}`);
                              }
                            }
                          }}
                        >
                          <option value="">-- Sin artículo --</option>
                          {productsForSelectedStore.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} - ${prod.price ? prod.price.toLocaleString() : '0'} (Stock: {prod.stock || 0})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedLinkedProductId && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-zinc-500">Deducir Unidades de Stock</Label>
                          <div className="flex items-center gap-1.5 h-8">
                            <span className="text-[10px] font-mono font-bold text-zinc-650 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded">
                              Stock: {selectedProductObj?.stock || 0}
                            </span>
                            <select
                              className="flex-1 h-8 px-1 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-black"
                              value={decreaseStockQty}
                              onChange={(e) => setDecreaseStockQty(e.target.value)}
                            >
                              <option value="0">❌ No descontar stock</option>
                              <option value="1">⬇️ Descontar 1 unidad</option>
                              <option value="2">⬇️ Descontar 2 unidades</option>
                              <option value="3">⬇️ Descontar 3 unidades</option>
                              <option value="4">⬇️ Descontar 4 unidades</option>
                              <option value="8">⬇️ Descontar 8 unidades</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Concept/Description Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="trip-desc" className="text-xs font-bold text-zinc-700">Concepto / Detalle del Gasto o Reserva *</Label>
                  <Input
                    id="trip-desc"
                    placeholder="Ej: Reserva de Noches de Hotel, Alquiler de Carro, Vuelo de ida"
                    required
                    className="h-10 text-xs border-zinc-200"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Eventual payment indicator */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-zinc-700">Gasto Eventual de Vacaciones</Label>
                    <p className="text-[10px] text-zinc-400 font-medium">Marca si no es una obligación fija / recurrente de tu presupuesto.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4.5 rounded text-sky-600 border-zinc-300 outline-none"
                    checked={isEventual}
                    onChange={(e) => setIsEventual(e.target.checked)}
                  />
                </div>

                {/* Submit button */}
                <Button 
                  type="submit" 
                  disabled={isSaving || (selectedAccountIds.length > 1 && !isSplitValid)}
                  className="w-full h-11 bg-zinc-950 font-bold hover:bg-zinc-850 text-white rounded-xl text-xs tracking-wider uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Compass className="size-4 animate-spin text-sky-400" />
                      <span>Registrando Viaje...</span>
                    </>
                  ) : (
                    <>
                      <Plane className="size-4 text-sky-400" />
                      <span>Asentar Gasto de Viaje (${numericAmount.toLocaleString()})</span>
                    </>
                  )}
                </Button>
              </form>

            </CardContent>
          </Card>
        </div>

        {/* Right column: Trips Stats & Travel ledger history (5/12 grid) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Active travel destination budgets */}
          <Card className="border-sky-100 shadow-md rounded-2xl bg-gradient-to-br from-white to-sky-50/10">
            <CardHeader className="pb-2 border-b border-zinc-100">
              <CardTitle className="text-xs font-bold uppercase text-sky-900 tracking-wider flex items-center gap-1.5">
                <Luggage className="size-4 text-sky-600" />
                Resumen de Gastos por Destino
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {travelDestinationSummary.length === 0 ? (
                <div className="text-center py-6 text-zinc-400">
                  <Compass className="size-7 mx-auto stroke-1.5 mb-2 text-zinc-300" />
                  <p className="text-[11px] font-medium">Aún no hay gastos categorizados por destino.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {travelDestinationSummary.map(([dest, val]) => (
                    <div key={dest} className="flex items-center justify-between gap-2 p-2 bg-white border border-zinc-150 rounded-xl">
                      <div className="flex items-center gap-1.5 truncate">
                        <div className="size-2 rounded-full bg-sky-500 shrink-0" />
                        <span className="text-[11px] font-bold text-zinc-800 truncate font-mono tracking-wide">{dest}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-zinc-900 font-mono">${val.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Travel history list */}
          <Card className="border-zinc-200/80 shadow-md rounded-2xl bg-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-zinc-100 bg-zinc-550/5">
              <CardTitle className="text-xs font-bold uppercase text-zinc-800 tracking-wider flex items-center gap-1.5">
                <Receipt className="size-4 text-zinc-500" />
                Historial de Gastos de Viajes
              </CardTitle>
              <CardDescription className="text-[9.5px] text-zinc-400 font-semibold block leading-none">
                Muestra solo egresos marcados con un destino o subcategoría Viajes.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-0 max-h-[480px] overflow-y-auto divide-y divide-zinc-100">
              {travelHistoryTransactions.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <Plane className="size-8 mx-auto stroke-1 text-zinc-300 mb-2 rotate-45" />
                  <p className="text-xs font-bold">No se han registrado transacciones de viajes.</p>
                  <p className="text-[10px] mt-1 text-zinc-400">Asienta pasajes o reservas de hotel arriba.</p>
                </div>
              ) : (
                travelHistoryTransactions.map((t) => {
                  const match = t.description.match(/^\[([^\]]+)\]/);
                  const dest = match ? match[1] : 'VIAJE';
                  const cleanDesc = match ? t.description.replace(/^\[[^\]]+\]\s*/, '') : t.description;
                  const acc = accounts.find(a => a.id === t.accountId);

                  return (
                    <div key={t.id} className="p-3 bg-white hover:bg-zinc-50/50 transition-colors flex items-start gap-2.5">
                      <div className="size-7 rounded-lg bg-sky-500/10 text-sky-700 flex items-center justify-center shrink-0">
                        <Plane className="size-3.5 rotate-45" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black tracking-wide uppercase text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 font-mono">
                            {dest}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-semibold font-mono">
                            {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-[11px] font-bold text-zinc-800 mt-1 leading-tight break-words">
                          {cleanDesc}
                        </p>

                        <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-zinc-450">
                          <span>Pago mediante:</span>
                          <span className="text-zinc-600 font-medium underline leading-none">{acc?.name || 'Cuenta'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col justify-between items-end h-full">
                        <span className="text-xs font-bold font-mono text-zinc-900">
                          -${t.amount.toLocaleString()}
                        </span>
                        
                        <button
                          onClick={async () => {
                            if (!window.confirm('¿Seguro de que deseas eliminar este registro de viaje? El importe se reintegrará a tu cuenta.')) return;
                            try {
                              // Reintegrate balance
                              if (acc) {
                                const currentBalance = Number(acc.balance) || 0;
                                await dbService.updateItem('accounts', acc.id, {
                                  balance: currentBalance + t.amount
                                });
                              }
                              await dbService.deleteItem('transactions', t.id);
                              toast.success('Gasto de viaje eliminado y saldo reintegrado.');
                            } catch (err) {
                              console.error(err);
                              toast.error('Error al eliminar');
                            }
                          }}
                          className="p-1 text-zinc-400 hover:text-rose-600 rounded mt-2.5 transition-colors"
                          title="Eliminar asiento de viaje"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
