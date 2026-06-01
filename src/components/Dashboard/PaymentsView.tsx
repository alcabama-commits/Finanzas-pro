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
  Building2, 
  TrendingDown, 
  Wallet, 
  Wifi, 
  Play, 
  CreditCard, 
  Heart, 
  BookOpen, 
  Receipt,
  HelpCircle,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Utensils,
  ShoppingCart,
  Car,
  Banknote,
  PiggyBank,
  Home,
  Smartphone,
  Film,
  Wrench,
  Gift,
  Flame,
  Trophy,
  MapPin,
  Tag,
  Clock,
  Repeat,
  Check,
  X,
  Settings,
  Edit,
  Trash2,
  CalendarDays,
  CalendarCheck,
  Store
} from 'lucide-react';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';
import { Transaction, Account, Category, UserSettings, RecurringExpense, SavingFund, Debt } from '@/src/types';
import { TransactionsList } from './TransactionsList';

interface PaymentsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  settings?: UserSettings | null;
}

const getCategoryIcon = (iconName?: string, customColor?: string) => {
  const cn = "size-5";
  const style = customColor ? { color: customColor } : undefined;
  
  switch (iconName?.toLowerCase()) {
    case 'building-2':
    case 'building':
    case 'arriendo':
      return <Building2 className={cn} style={style} />;
    case 'receipt':
    case 'servicios':
      return <Receipt className={cn} style={style} />;
    case 'wifi':
    case 'internet':
      return <Wifi className={cn} style={style} />;
    case 'play':
    case 'suscripciones':
      return <Play className={cn} style={style} />;
    case 'credit-card':
    case 'tarjetas':
      return <CreditCard className={cn} style={style} />;
    case 'heart':
    case 'salud':
      return <Heart className={cn} style={style} />;
    case 'book-open':
    case 'education':
    case 'educación':
      return <BookOpen className={cn} style={style} />;
    case 'utensils':
    case 'comida':
      return <Utensils className={cn} style={style} />;
    case 'shopping-cart':
    case 'mercado':
      return <ShoppingCart className={cn} style={style} />;
    case 'car':
    case 'transporte':
      return <Car className={cn} style={style} />;
    case 'banknote':
    case 'sueldo':
      return <Banknote className={cn} style={style} />;
    case 'piggy-bank':
    case 'ahorro':
      return <PiggyBank className={cn} style={style} />;
    case 'home':
    case 'hogar':
      return <Home className={cn} style={style} />;
    case 'smartphone':
    case 'celular':
      return <Smartphone className={cn} style={style} />;
    case 'film':
    case 'cine/ocio':
    case 'ocio':
      return <Film className={cn} style={style} />;
    case 'wrench':
    case 'reparaciones':
      return <Wrench className={cn} style={style} />;
    case 'gift':
    case 'regalos':
      return <Gift className={cn} style={style} />;
    case 'flame':
      return <Flame className={cn} style={style} />;
    case 'trophy':
      return <Trophy className={cn} style={style} />;
    case 'map-pin':
      return <MapPin className={cn} style={style} />;
    case 'sparkles':
      return <Sparkles className={cn} style={style} />;
    case 'tag':
      return <Tag className={cn} style={style} />;
    default:
      return <HelpCircle className={cn} style={style} />;
  }
};

interface PaymentPreset {
  id: string;
  name: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  defaultDescription: string;
  keywords: string[];
  categoryColor?: string;
}

export function PaymentsView({ transactions, accounts, categories, settings }: PaymentsViewProps) {
  // Sub-tab State
  const [activeSubTab, setActiveSubTab] = useState<'liquidar' | 'recurrentes'>('liquidar');

  // Form State
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountSplits, setAccountSplits] = useState<Record<string, string>>({});
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [isEventual, setIsEventual] = useState(false);
  const [isAutoDebit, setIsAutoDebit] = useState(false);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payWithDebt, setPayWithDebt] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

  // Subscribe to debts list
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('debts', setDebts);
    return () => unsub();
  }, []);

  // Filter categories to only those of type "expense"
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'expense');
  }, [categories]);

  // Collaborative database states
  const [catalogStores, setCatalogStores] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // Manual payment catalog linking state
  const [selectedLinkedStoreId, setSelectedLinkedStoreId] = useState('');
  const [selectedLinkedProductId, setSelectedLinkedProductId] = useState('');
  const [decreaseStockQty, setDecreaseStockQty] = useState('0');
  const [tempFilterStoreType, setTempFilterStoreType] = useState('all');

  // Load/Subscribe catalog and catalog_stores
  useEffect(() => {
    const unsubStores = dbService.subscribeToCatalogStores((data) => {
      setCatalogStores(data || []);
    });
    const unsubCatalog = dbService.subscribeToCollection('catalog', (data) => {
      setCatalogProducts(data || []);
    });
    return () => {
      unsubStores();
      unsubCatalog();
    };
  }, []);

  const translateType = (type?: string) => {
    switch (type) {
      case 'store': return 'Tienda / Comercio';
      case 'provider': return 'Proveedor';
      case 'service': return 'Servicio / Cuenta';
      case 'consumption': return 'Consumo';
      default: return 'Establecimiento';
    }
  };

  // Filter stores and products based on user classification choices
  const filteredStoresForPayment = useMemo(() => {
    if (tempFilterStoreType === 'all') return catalogStores;
    return catalogStores.filter(st => st.type === tempFilterStoreType);
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

  // Recurring form data
  const [recFormData, setRecFormData] = useState({
    name: '',
    amount: '',
    paymentType: 'fixed' as 'fixed' | 'variable',
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    dayOfMonth: '1',
    startDate: '',
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'custom_months',
    intervalMonths: '1',
    description: '',
    active: true,
    linkedStoreId: '',
    linkedProductId: '',
    decreaseStockQty: '0'
  });

  // Recurring form filtered stores/products memos
  const recFilteredStores = useMemo(() => {
    // For simplicity, retrieve all, but we can search by classification too
    return catalogStores;
  }, [catalogStores]);

  const recProductsForSelectedStore = useMemo(() => {
    if (!recFormData.linkedStoreId) return [];
    const storeObj = catalogStores.find(s => s.id === recFormData.linkedStoreId);
    if (!storeObj) return [];
    return catalogProducts.filter(p => p.store && p.store.toLowerCase() === storeObj.name.toLowerCase());
  }, [catalogProducts, recFormData.linkedStoreId, catalogStores]);

  const recSelectedProductObj = useMemo(() => {
    return catalogProducts.find(p => p.id === recFormData.linkedProductId);
  }, [catalogProducts, recFormData.linkedProductId]);

  // Recurring Expenses State
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [isRecFormOpen, setIsRecFormOpen] = useState(false);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);

  // Modal / Confirm confirmation flow state
  const [confirmingExpense, setConfirmingExpense] = useState<RecurringExpense | null>(null);
  const [confirmingAmount, setConfirmingAmount] = useState('');
  const [confirmingAccountId, setConfirmingAccountId] = useState('');
  const [confirmingDate, setConfirmingDate] = useState('');

  // Saving goals / funds integration
  const [savingFunds, setSavingFunds] = useState<SavingFund[]>([]);
  const [linkedSavingFundId, setLinkedSavingFundId] = useState('');
  const [confirmingLinkedSavingFundId, setConfirmingLinkedSavingFundId] = useState('');

  // Manual payment fund contribution state
  const [fundDeductionInput, setFundDeductionInput] = useState('');
  
  // Recurring payment fund contribution state
  const [confirmingFundDeductionInput, setConfirmingFundDeductionInput] = useState('');

  // Synchronize manual payment fund deduction amount
  useEffect(() => {
    if (linkedSavingFundId) {
      const fund = savingFunds.find(f => f.id === linkedSavingFundId);
      if (fund) {
        const total = parseFloat(amount) || 0;
        const defaultDeduction = Math.min(total, fund.currentAmount);
        setFundDeductionInput(String(defaultDeduction));
      }
    } else {
      setFundDeductionInput('');
    }
  }, [linkedSavingFundId, amount, savingFunds]);

  // Synchronize confirming recurring payment fund deduction amount
  useEffect(() => {
    if (confirmingLinkedSavingFundId) {
      const fund = savingFunds.find(f => f.id === confirmingLinkedSavingFundId);
      if (fund) {
        const total = parseFloat(confirmingAmount) || 0;
        const defaultDeduction = Math.min(total, fund.currentAmount);
        setConfirmingFundDeductionInput(String(defaultDeduction));
      }
    } else {
      setConfirmingFundDeductionInput('');
    }
  }, [confirmingLinkedSavingFundId, confirmingAmount, savingFunds]);

  // Pre-fill default account/category on load or form state change
  useEffect(() => {
    if (accounts.length > 0 && !recFormData.accountId) {
      setRecFormData(prev => ({ ...prev, accountId: accounts[0].id }));
    }
  }, [accounts, recFormData.accountId]);

  useEffect(() => {
    if (expenseCategories.length > 0 && !recFormData.categoryId) {
      setRecFormData(prev => ({ ...prev, categoryId: expenseCategories[0].id }));
    }
  }, [expenseCategories, recFormData.categoryId]);

  // Load/Subscribe recurring expenses and saving funds
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('recurring_expenses', setRecurringExpenses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = dbService.subscribeToCollection('saving_funds', setSavingFunds);
    return () => unsub();
  }, []);

  // When a user selects a saving fund to pay from, optionally pre-select its physical account as the source of funds!
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

  // Pre-select physical account in confirmation modal when a saving fund is chosen
  useEffect(() => {
    if (confirmingLinkedSavingFundId) {
      const fund = savingFunds.find(f => f.id === confirmingLinkedSavingFundId);
      if (fund && fund.accountId) {
        const accExists = accounts.some(a => a.id === fund.accountId);
        if (accExists) {
          setConfirmingAccountId(fund.accountId);
        }
      }
    }
  }, [confirmingLinkedSavingFundId, savingFunds, accounts]);

  // Payment Quick Presets Options dynamically from Database Categories
  const presets: PaymentPreset[] = useMemo(() => {
    return expenseCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      label: cat.name,
      icon: getCategoryIcon(cat.icon || cat.name, cat.color),
      color: 'border-zinc-150 hover:border-zinc-350 bg-white text-zinc-900',
      defaultDescription: `Pago de ${cat.name}`,
      keywords: [cat.name.toLowerCase()],
      categoryColor: cat.color || '#71717a'
    }));
  }, [expenseCategories]);

  // Pre-select first account if not selected
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([accounts[0].id]);
    }
  }, [accounts, selectedAccountIds]);

  // Pre-select first expense category if not selected
  useEffect(() => {
    if (expenseCategories.length > 0 && !selectedCategoryId) {
      const firstCat = expenseCategories[0];
      setSelectedCategoryId(firstCat.id);
      setActivePreset(firstCat.id);
      setIsEventual(firstCat.isEventual || false);
      setIsAutoDebit(firstCat.isAutoDebit || false);
      if (firstCat.paymentType === 'fixed') {
        setAmount(firstCat.fixedAmount ? String(firstCat.fixedAmount) : '');
      } else {
        setAmount('');
      }
      if (firstCat.subcategories && firstCat.subcategories.length > 0) {
        setSelectedSubcategory(firstCat.subcategories[0]);
      } else {
        setSelectedSubcategory('');
      }
    }
  }, [expenseCategories, selectedCategoryId]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    setActivePreset(catId);
    const cat = expenseCategories.find(c => c.id === catId);
    if (cat) {
      setIsEventual(cat.isEventual || false);
      setIsAutoDebit(cat.isAutoDebit || false);
      if (cat.paymentType === 'fixed') {
        setAmount(cat.fixedAmount ? String(cat.fixedAmount) : '');
      } else {
        setAmount('');
      }
      if (cat.subcategories && cat.subcategories.length > 0) {
        setSelectedSubcategory(cat.subcategories[0]);
      } else {
        setSelectedSubcategory('');
      }
    } else {
      setSelectedSubcategory('');
    }
  };

  // Handle Preset Click
  const handlePresetSelect = (preset: PaymentPreset) => {
    setActivePreset(preset.id);
    setDescription(preset.defaultDescription);
    handleCategoryChange(preset.id);
  };

  // Safe parsed values
  const numericAmount = parseFloat(amount) || 0;
  const selectedCategory = useMemo(() => expenseCategories.find(c => c.id === selectedCategoryId), [expenseCategories, selectedCategoryId]);
  
  // Available subcategories for the main selected category
  const activeSubcategories = useMemo(() => {
    return selectedCategory?.subcategories || [];
  }, [selectedCategory]);

  // Click handler supporting Ctrl-click toggle multi-select
  const handleAccountClick = (e: React.MouseEvent, accId: string) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedAccountIds.includes(accId)) {
        if (selectedAccountIds.length > 1) {
          setSelectedAccountIds(selectedAccountIds.filter(id => id !== accId));
        } else {
          toast.warning('Debe haber al menos un origen de fondos seleccionado.');
          setSelectedAccountIds([accId]);
        }
      } else {
        setSelectedAccountIds([...selectedAccountIds, accId]);
      }
    } else {
      // Direct click without Ctrl: single selection
      setSelectedAccountIds([accId]);
    }
  };

  const accountDeductionAmount = useMemo(() => {
    if (!linkedSavingFundId) return numericAmount;
    const fDed = parseFloat(fundDeductionInput) || 0;
    return Math.max(0, numericAmount - fDed);
  }, [linkedSavingFundId, fundDeductionInput, numericAmount]);

  // Auto equal distribution splits setup
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

  // Real-time Warnings & Analytics
  const isBalanceInsufficient = useMemo(() => {
    if (selectedAccountIds.length <= 1) {
      const firstId = selectedAccountIds[0];
      const acc = accounts.find(a => a.id === firstId);
      if (!acc) return false;
      return accountDeductionAmount > (acc.balance || 0);
    }

    return selectedAccountIds.some(accId => {
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return false;
      const splitVal = parseFloat(accountSplits[accId]) || 0;
      return splitVal > (acc.balance || 0);
    });
  }, [accounts, selectedAccountIds, accountDeductionAmount, accountSplits]);

  // Limit indicators: Calculate sum of payments for the current period
  // To keep it simple, we check expenses of current quincena/mes
  const cyclePaymentsSum = useMemo(() => {
    // Basic summation of payments in the current month/quincena (matching overview.tsx style behavior)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const tDate = new Date(t.date);
        return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const limitProgressInfo = useMemo(() => {
    const limit = settings?.monthlyLimit || 1000;
    const currentTotal = cyclePaymentsSum;
    const projectTotal = currentTotal + numericAmount;
    const isExceeded = projectTotal > limit;
    const isClose = !isExceeded && projectTotal >= (limit * 0.85); // 85% of limit

    return {
      limit,
      currentTotal,
      projectTotal,
      isExceeded,
      isClose,
      percentage: (projectTotal / limit) * 100
    };
  }, [settings, cyclePaymentsSum, numericAmount]);

  // Form submit sequence
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payWithDebt) {
      if (!selectedDebtId) {
        toast.error('Debes seleccionar una Tarjeta de Crédito o Crédito Rotativo para diferir este pago.');
        return;
      }
    } else {
      if (selectedAccountIds.length === 0) {
        toast.error('Debes seleccionar al menos un origen de fondos.');
        return;
      }
      if (selectedAccountIds.length > 1 && !isSplitValid) {
        toast.error('La suma de los montos de la distribución debe coincidir con el monto total del pago.');
        return;
      }
    }

    if (!selectedCategoryId) {
      toast.error('Debes seleccionar o crear una categoría para este pago.');
      return;
    }
    if (numericAmount <= 0) {
      toast.error('Por favor escribe un valor de pago/obligación válido superior a 0.');
      return;
    }

    setIsSaving(true);
    try {
      const isNoCost = selectedCategory?.isNoCost || false;

      // Special Flow: Pay with Debt
      if (payWithDebt) {
        const debtObj = debts.find(d => d.id === selectedDebtId);
        if (!debtObj) throw new Error('Deuda seleccionada no encontrada');

        const baseDescription = description.trim() || `Pago: Obligación (${selectedCategory?.name || 'Varios'})`;

        // 1. Create Transaction
        await dbService.addItem('transactions', {
          amount: numericAmount,
          type: 'expense',
          categoryId: selectedCategoryId,
          accountId: '',
          date: new Date(date).toISOString(),
          description: `${baseDescription} (Cargado a Deuda: ${debtObj.name})`,
          isEventual: isEventual,
          subcategory: selectedSubcategory || '',
          createdAt: new Date().toISOString(),
          paidWithDebt: true,
          debtId: selectedDebtId
        });

        // 2. Increase Debt balance
        const currentRemaining = Number(debtObj.remainingAmount) || 0;
        await dbService.updateItem('debts', debtObj.id, {
          remainingAmount: currentRemaining + numericAmount
        });

        toast.warning('⚠️ ¡Pago con deuda registrado! Acabas de aumentar tu pasivo. Esto te aleja de tu libertad financiera.');
        
        // Reset form
        setAmount('');
        setDescription('');
        setSelectedSubcategory('');
        setPayWithDebt(false);
        setSelectedDebtId('');
        setIsSaving(false);
        return;
      }

      const finalFundDeduction = linkedSavingFundId ? (parseFloat(fundDeductionInput) || 0) : 0;
      const finalAccountDeduction = isNoCost ? 0 : Math.max(0, numericAmount - finalFundDeduction);
      
      const targetFund = linkedSavingFundId ? savingFunds.find(f => f.id === linkedSavingFundId) : null;
      let baseDescription = description.trim() || `Pago: Obligación (${selectedCategory?.name || 'Varios'})`;
      const finalDescription = targetFund 
        ? `${baseDescription} (Fondo: $${finalFundDeduction.toLocaleString()}, Cuenta: $${finalAccountDeduction.toLocaleString()} de ${targetFund.name})` 
        : baseDescription;

      // Single Account payment
      if (selectedAccountIds.length === 1) {
        const targetAccId = selectedAccountIds[0];
        const targetAccount = accounts.find(a => a.id === targetAccId);
        if (!targetAccount) throw new Error('Cuenta origen no encontrada');

        // 1. Write personal ledger transaction of type 'expense'
        await dbService.addItem('transactions', {
          amount: finalAccountDeduction,
          type: 'expense',
          categoryId: selectedCategoryId,
          accountId: targetAccId,
          date: new Date(date).toISOString(),
          description: finalDescription,
          isEventual: isEventual,
          subcategory: selectedSubcategory || '',
          createdAt: new Date().toISOString()
        });

        // 2. Adjust account balance
        const currentBalance = Number(targetAccount.balance) || 0;
        await dbService.updateItem('accounts', targetAccount.id, {
          balance: currentBalance - finalAccountDeduction
        });

      } else {
        // Multi-Account payment (Ctrl select split)
        for (const targetAccId of selectedAccountIds) {
          const splitVal = parseFloat(accountSplits[targetAccId]) || 0;
          if (splitVal <= 0) continue; // Skip zero/empty portions

          const targetAccount = accounts.find(a => a.id === targetAccId);
          if (!targetAccount) throw new Error(`Cuenta origen ${targetAccId} no encontrada`);

          const splitAmountNoCost = isNoCost ? 0 : splitVal;
          const multiDescription = targetFund
            ? `${baseDescription} (Split ${targetAccount.name}) (Fondo: $${finalFundDeduction.toLocaleString()}, Cuenta: $${splitAmountNoCost.toLocaleString()} de ${targetFund.name})`
            : `${baseDescription} (Split ${targetAccount.name})`;

          // 1. Write individual personal ledger transaction for each account
          await dbService.addItem('transactions', {
            amount: splitAmountNoCost,
            type: 'expense',
            categoryId: selectedCategoryId,
            accountId: targetAccId,
            date: new Date(date).toISOString(),
            description: multiDescription,
            isEventual: isEventual,
            subcategory: selectedSubcategory || '',
            createdAt: new Date().toISOString()
          });

          // 2. Adjust balance on each participating account
          const currentBalance = Number(targetAccount.balance) || 0;
          await dbService.updateItem('accounts', targetAccount.id, {
            balance: currentBalance - splitAmountNoCost
          });
        }
      }

      // 3. Deduct from Saving Fund if linked
      if (targetFund && finalFundDeduction > 0) {
        const currentFundAmount = Number(targetFund.currentAmount) || 0;
        const newFundAmount = Math.max(0, currentFundAmount - finalFundDeduction);
        await dbService.updateItem('saving_funds', targetFund.id, {
          currentAmount: newFundAmount,
          updatedAt: new Date().toISOString()
        });
        toast.success(`🎯 Se debitaron y liberaron $${finalFundDeduction.toLocaleString('es-ES')} de tu fondo de ahorro "${targetFund.name}".`);
      }

      // 4. Update product stock if linked
      if (selectedLinkedProductId) {
        const prod = catalogProducts.find(p => p.id === selectedLinkedProductId);
        const qtyToDecrease = parseInt(decreaseStockQty) || 0;
        if (prod && qtyToDecrease > 0) {
          const currentStock = Number(prod.stock) || 0;
          const newStock = Math.max(0, currentStock - qtyToDecrease);
          await dbService.updateItem('catalog', prod.id, { stock: newStock });
          toast.success(`📦 Stock de "${prod.name}" actualizado de ${currentStock} a ${newStock} unidades.`);
        }
      }

      toast.success('💸 ¡Pago asentado con éxito! Saldo deducido de la(s) cuenta(s).');

      // Clear values except selected defaults
      setAmount('');
      setDescription('');
      setActivePreset(null);
      setIsEventual(false);
      setIsAutoDebit(false);
      setSelectedSubcategory('');
      setLinkedSavingFundId('');
      setSelectedLinkedStoreId('');
      setSelectedLinkedProductId('');
      setDecreaseStockQty('0');
    } catch (err: any) {
      console.error(err);
      toast.error('Ocurrió un error al asentar la deducción.');
    } finally {
      setIsSaving(false);
    }
  };

  // CHECK WHICH EXPENSES ARE PENDING CONFIRMATION FOR THE CURRENT CYCLE
  const pendingNotificationExpenses = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1 to 12
    const currentYear = today.getFullYear();

    const isExpenseDueInMonth = (exp: RecurringExpense, targetMonth: number, targetYear: number): boolean => {
      if (exp.frequency === 'weekly' || exp.frequency === 'biweekly' || exp.frequency === 'monthly') {
        return true;
      }
      
      if (!exp.startDate) return true;
      const start = new Date(exp.startDate);
      const startYear = start.getFullYear();
      const startMonth = start.getMonth() + 1;
      
      const diffMonths = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      if (diffMonths < 0) return false;

      const interval = exp.intervalMonths || 1;
      return diffMonths % interval === 0;
    };

    const hasBeenAppliedInCurrentPeriod = (exp: RecurringExpense) => {
      if (!exp.lastAppliedDate) return false;

      const [appYear, appMonth, appDay] = exp.lastAppliedDate.split('-').map(Number);
      if (appYear !== currentYear || appMonth !== currentMonth) {
        return false;
      }

      if (exp.frequency === 'biweekly') {
        if (currentDay <= 15) {
          return appDay <= 15;
        } else {
          return appDay > 15;
        }
      }
      
      if (exp.frequency === 'weekly') {
        const lastApp = new Date(exp.lastAppliedDate);
        const diffDays = (today.getTime() - lastApp.getTime()) / (1000 * 3600 * 24);
        return diffDays < 5;
      }

      return true;
    };

    return recurringExpenses.filter(exp => {
      if (!exp.active) return false;

      if (exp.startDate) {
        const start = new Date(exp.startDate);
        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (start > todayNoTime) return false;
      }

      if (hasBeenAppliedInCurrentPeriod(exp)) {
        return false;
      }

      const isDueThisMonth = isExpenseDueInMonth(exp, currentMonth, currentYear);
      const isPastDueOrToday = currentDay >= exp.dayOfMonth;
      const isDaysBefore = (exp.dayOfMonth - currentDay) <= 3 && (exp.dayOfMonth - currentDay) >= 0;

      return isDueThisMonth && (isPastDueOrToday || isDaysBefore);
    });
  }, [recurringExpenses]);

  // RECURRING EXPENSES OPERATIONS
  const handleSaveRecurringExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recFormData.name.trim()) {
      toast.error('Por favor ingresa un nombre para la obligación.');
      return;
    }
    const numericAmt = parseFloat(recFormData.amount);
    if (recFormData.paymentType === 'fixed' && (isNaN(numericAmt) || numericAmt < 0)) {
      toast.error('Por favor ingresa un monto válido.');
      return;
    }
    if (!recFormData.accountId) {
      toast.error('Por favor selecciona una cuenta origen por defecto.');
      return;
    }
    if (!recFormData.categoryId) {
      toast.error('Por favor selecciona una categoría asociada.');
      return;
    }
    if (!recFormData.startDate) {
      toast.error('Por favor selecciona una fecha de inicio.');
      return;
    }

    const storeObj = catalogStores.find(s => s.id === recFormData.linkedStoreId);
    const prodObj = catalogProducts.find(p => p.id === recFormData.linkedProductId);

    const payload = {
      name: recFormData.name.trim(),
      amount: recFormData.paymentType === 'fixed' ? numericAmt : 0,
      paymentType: recFormData.paymentType,
      accountId: recFormData.accountId,
      categoryId: recFormData.categoryId,
      subcategoryId: recFormData.subcategoryId || '',
      dayOfMonth: parseInt(recFormData.dayOfMonth) || 1,
      startDate: recFormData.startDate,
      frequency: recFormData.frequency,
      intervalMonths: recFormData.frequency === 'custom_months' ? (parseInt(recFormData.intervalMonths) || 2) : 1,
      description: recFormData.description.trim(),
      active: recFormData.active,
      updatedAt: new Date().toISOString(),
      linkedStoreId: recFormData.linkedStoreId || '',
      linkedStoreName: storeObj ? storeObj.name : '',
      linkedProductId: recFormData.linkedProductId || '',
      linkedProductName: prodObj ? prodObj.name : '',
      decreaseStockQty: parseInt(recFormData.decreaseStockQty) || 0
    };

    try {
      if (editingRecId) {
        await dbService.updateItem('recurring_expenses', editingRecId, payload);
        toast.success('🛠️ ¡Plantilla de pago recurrente actualizada!');
      } else {
        await dbService.addItem('recurring_expenses', {
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success('✨ ¡Nuevo pago recurrente programado con éxito!');
      }
      setIsRecFormOpen(false);
      setEditingRecId(null);
      // Reset form (keep placeholders or current selections)
      setRecFormData({
        name: '',
        amount: '',
        paymentType: 'fixed',
        accountId: accounts[0]?.id || '',
        categoryId: expenseCategories[0]?.id || '',
        subcategoryId: '',
        dayOfMonth: '1',
        startDate: new Date().toISOString().split('T')[0],
        frequency: 'monthly',
        intervalMonths: '1',
        description: '',
        active: true,
        linkedStoreId: '',
        linkedProductId: '',
        decreaseStockQty: '0'
      });
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el pago recurrente.');
    }
  };

  const handleEditRecExpense = (exp: RecurringExpense) => {
    setEditingRecId(exp.id);
    setRecFormData({
      name: exp.name,
      amount: exp.amount ? String(exp.amount) : '',
      paymentType: exp.paymentType || 'fixed',
      accountId: exp.accountId,
      categoryId: exp.categoryId,
      subcategoryId: exp.subcategoryId || '',
      dayOfMonth: String(exp.dayOfMonth),
      startDate: exp.startDate || new Date().toISOString().split('T')[0],
      frequency: exp.frequency || 'monthly',
      intervalMonths: exp.intervalMonths ? String(exp.intervalMonths) : '1',
      description: exp.description || '',
      active: exp.active ?? true,
      linkedStoreId: exp.linkedStoreId || '',
      linkedProductId: exp.linkedProductId || '',
      decreaseStockQty: exp.decreaseStockQty ? String(exp.decreaseStockQty) : '0'
    });
    setIsRecFormOpen(true);
  };

  const handleDeleteRecExpense = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este pago recurrente?')) return;
    try {
      await dbService.deleteItem('recurring_expenses', id);
      toast.success('¡Pago recurrente eliminado de la lista!');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el pago recurrente.');
    }
  };

  const handleToggleRecActive = async (exp: RecurringExpense) => {
    try {
      await dbService.updateItem('recurring_expenses', exp.id, {
        active: !exp.active
      });
      toast.success(exp.active ? '⏸️ Pago recurrente pausado' : '▶️ Pago recurrente activado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar estado');
    }
  };

  const handleSkipRecPeriod = async (exp: RecurringExpense) => {
    if (!window.confirm(`¿Seguro que deseas omitir el cobro de "${exp.name}" para este período? Se marcará como resuelto sin generar transacciones ni modificar saldos.`)) return;
    try {
      const today = new Date();
      const todayShort = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await dbService.updateItem('recurring_expenses', exp.id, {
        lastAppliedDate: todayShort
      });
      toast.success(`Se omitió el pago de "${exp.name}" para este ciclo.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al omitir la obligación');
    }
  };

  const handleApplyRecExpenseClick = (exp: RecurringExpense) => {
    setConfirmingExpense(exp);
    setConfirmingAmount(exp.paymentType === 'fixed' ? String(exp.amount) : '');
    setConfirmingAccountId(exp.accountId);
    const now = new Date();
    setConfirmingDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  };

  const handleApplyRecExpenseConfirm = async () => {
    if (!confirmingExpense) return;
    const exp = confirmingExpense;
    const account = accounts.find(a => a.id === confirmingAccountId);
    if (!account) {
      toast.error('La cuenta seleccionada no existe.');
      return;
    }

    const correctedAmount = parseFloat(confirmingAmount);
    if (isNaN(correctedAmount) || correctedAmount < 0) {
      toast.error('Por favor ingresa un monto válido.');
      return;
    }

    try {
      const todayISO = new Date(confirmingDate).toISOString();
      const todayShort = confirmingDate;

      const finalFundDeduction = confirmingLinkedSavingFundId ? (parseFloat(confirmingFundDeductionInput) || 0) : 0;
      const finalAccountDeduction = Math.max(0, correctedAmount - finalFundDeduction);

      const targetFund = confirmingLinkedSavingFundId ? savingFunds.find(f => f.id === confirmingLinkedSavingFundId) : null;
      let baseDescription = exp.description || `${exp.name} (Obligación Recurrente Confirmada)`;
      const finalDescription = targetFund 
        ? `${baseDescription} (Fondo: $${finalFundDeduction.toLocaleString()}, Cuenta: $${finalAccountDeduction.toLocaleString()} de ${targetFund.name})` 
        : baseDescription;

      // 1. Create Transaction (expense)
      await dbService.addItem('transactions', {
        amount: finalAccountDeduction,
        type: 'expense',
        categoryId: exp.categoryId,
        accountId: confirmingAccountId,
        date: todayISO,
        description: finalDescription,
        isEventual: false,
        subcategory: exp.subcategoryId || '',
        createdAt: new Date().toISOString()
      });

      // 2. Adjust Account Balance
      const currentBalance = Number(account.balance) || 0;
      await dbService.updateItem('accounts', account.id, {
        balance: currentBalance - finalAccountDeduction
      });

      // 3. Mark last applied date
      await dbService.updateItem('recurring_expenses', exp.id, {
        lastAppliedDate: todayShort
      });

      // 4. Update the Linked Saving Fund if matching
      if (targetFund && finalFundDeduction > 0) {
        const currentFundAmount = Number(targetFund.currentAmount) || 0;
        const newFundAmount = Math.max(0, currentFundAmount - finalFundDeduction);
        await dbService.updateItem('saving_funds', targetFund.id, {
          currentAmount: newFundAmount,
          updatedAt: new Date().toISOString()
        });
        toast.success(`🎯 Se debitaron y liberaron $${finalFundDeduction.toLocaleString('es-ES')} de tu fondo de ahorro "${targetFund.name}".`);
      }

      // 5. Update catalog stock if linked to recurring expense
      if (exp.linkedProductId) {
        const prod = catalogProducts.find(p => p.id === exp.linkedProductId);
        const qtyToDecrease = Number(exp.decreaseStockQty) || 0;
        if (prod && qtyToDecrease > 0) {
          const currentStock = Number(prod.stock) || 0;
          const newStock = Math.max(0, currentStock - qtyToDecrease);
          await dbService.updateItem('catalog', prod.id, { stock: newStock });
          toast.success(`📦 Stock reconciliado: "${prod.name}" actualizado de ${currentStock} a ${newStock} unidades.`);
        }
      }

      toast.success(`💸 Pago de $${correctedAmount.toLocaleString('es-ES')} registrado y deducido de "${account.name}".`);
      setConfirmingExpense(null);
      setConfirmingLinkedSavingFundId('');
    } catch (err) {
      console.error(err);
      toast.error('Error al asentar el pago recurrente.');
    }
  };

  const recActiveSubcategories = useMemo(() => {
    const cat = expenseCategories.find(c => c.id === recFormData.categoryId);
    return cat?.subcategories || [];
  }, [expenseCategories, recFormData.categoryId]);

  return (
    <div className="space-y-8">
      {/* Banner de Bienvenida y Resumen */}
      <div className="bg-gradient-to-r from-rose-500/10 via-rose-600/5 to-zinc-100 rounded-2xl p-5 border border-rose-105 shadow-3xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">Módulos avanzados</span>
            <Sparkles className="size-4 text-rose-500" />
          </div>
          <h3 className="font-extrabold text-xl text-zinc-950 mt-1">Liquidación y Programación de Obligaciones</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl leading-relaxed">
            Asienta tus facturas y servicios de manera rápida o define plantillas periódicas con aviso de vencimiento para automatizar tu contabilidad.
          </p>
        </div>
        
        {/* Widget de límite mensual */}
        <div className="bg-white/90 backdrop-blur-md border border-rose-100/70 p-4 rounded-xl shadow-3xs text-right min-w-[200px]">
          <span className="text-[10px] uppercase font-black text-zinc-400 block tracking-wider">Compromisos de este Mes</span>
          <p className="text-xl font-black text-rose-600 tracking-tight mt-0.5">${cyclePaymentsSum.toLocaleString()}</p>
          {settings?.monthlyLimit && (
            <p className="text-[9px] text-zinc-500 mt-1 border-t border-zinc-100 pt-1 font-semibold">
              Límite fijado: <strong className="text-zinc-700">${settings.monthlyLimit.toLocaleString()}</strong> ({((cyclePaymentsSum / settings.monthlyLimit) * 100).toFixed(0)}%)
            </p>
          )}
        </div>
      </div>

      {/* ALERTAS O RECORDATORIOS DE PAGOS RECURRENTES PENDIENTES */}
      {pendingNotificationExpenses.length > 0 && (
        <Card className="bg-rose-50/70 border-rose-200/80 shadow-xs animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
          <CardContent className="p-5 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div className="flex gap-3">
              <div className="bg-rose-100/70 p-2.5 rounded-xl border border-rose-200 self-start text-rose-700">
                <AlertTriangle className="size-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-rose-950 text-sm">🗓️ Tienes pagos de obligaciones periódicos por asentar</h4>
                <p className="text-xs text-rose-700 leading-relaxed max-w-2xl font-medium">
                  Hemos listado tus obligaciones programadas que vencen hoy o en los próximos días. Confirma el monto exacto cobrado o descártalo si decidiste omitirlo temporalmente.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
              {pendingNotificationExpenses.map(exp => {
                return (
                  <div key={exp.id} className="flex flex-wrap items-center gap-3 bg-white border border-rose-100 p-2.5 rounded-xl shadow-3xs justify-between max-w-lg">
                    <div className="text-left font-semibold text-xs text-zinc-800">
                      <span className="font-bold text-rose-950">{exp.name}</span>
                      <span className="text-[10px] text-zinc-500 block">
                        Día de cobro: {exp.dayOfMonth} del mes • {
                          exp.paymentType === 'fixed' 
                            ? `Monto Fijo: $${exp.amount.toLocaleString()}` 
                            : 'Monto Variable a definir'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button 
                        onClick={() => handleApplyRecExpenseClick(exp)}
                        size="sm" 
                        className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold h-8 rounded-lg text-xs"
                      >
                        <Check className="mr-1 size-3.5" /> Confirmar Pago
                      </Button>
                      <Button 
                        onClick={() => handleSkipRecPeriod(exp)}
                        variant="outline"
                        size="sm" 
                        className="bg-zinc-50 border-zinc-250 hover:bg-rose-50 hover:text-rose-700 text-zinc-600 h-8 rounded-lg text-xs font-bold"
                      >
                        Omitir periodo
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SELECTOR DE SUBESTADOS/VISTAS */}
      <div className="flex border-b border-zinc-200">
        <button
          type="button"
          id="tab-btn-liquidar"
          onClick={() => setActiveSubTab('liquidar')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'liquidar'
              ? 'border-rose-500 text-rose-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <CreditCard className="size-4" />
          <span>Realizar Pago Directo / Manual</span>
        </button>
        <button
          type="button"
          id="tab-btn-recurrentes"
          onClick={() => setActiveSubTab('recurrentes')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'recurrentes'
              ? 'border-rose-500 text-rose-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Repeat className="size-4" />
          <span>Programación de Pagos Recurrentes</span>
          {recurringExpenses.length > 0 && (
            <Badge variant="secondary" className="bg-rose-100 text-rose-700 font-extrabold hover:bg-rose-100 size-5 flex items-center justify-center p-0 rounded-full">
              {recurringExpenses.length}
            </Badge>
          )}
        </button>
      </div>

      {/* VISTA 1: LIQUIDAR / COMPROMISO INDIVIDUAL (VISTA ORIGINAL PREEXISTENTE) */}
      {activeSubTab === 'liquidar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lado izquierdo: Registro */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-rose-100/85 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
              
              <CardHeader className="pb-4 pt-6">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-5 text-rose-600" />
                  <span>Registrar Pago / Obligación</span>
                </CardTitle>
                <CardDescription>
                  Usa el menú rápido interactivo para preconfigurar el tipo de pago.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* INTERACTIVE PRESETS GRID */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-700 block mb-1">Menú Rápido de Obligaciones *</Label>
                  <div id="quick-presets-menu" className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                    {presets.map((preset) => {
                      const isSelected = activePreset === preset.id;
                      const catColor = preset.categoryColor || '#71717a';
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetSelect(preset)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all h-20 ${
                            isSelected 
                              ? 'scale-102 shadow-2xs font-extrabold ring-1' 
                              : 'scale-100 border-zinc-150 hover:border-zinc-300 hover:scale-102 hover:shadow-2xs bg-white text-zinc-900'
                          }`}
                          style={{
                            borderColor: isSelected ? catColor : undefined,
                            backgroundColor: isSelected ? `${catColor}15` : undefined
                          }}
                        >
                          <div 
                            className="p-1.5 rounded-lg shadow-3xs mb-1"
                            style={{ backgroundColor: `${catColor}12` }}
                          >
                            {preset.icon}
                          </div>
                          <span 
                            className="text-[10px] font-bold block leading-none tracking-tight truncate max-w-full"
                            style={{ color: isSelected ? catColor : undefined }}
                          >
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PAYMENT REGISTRATION FORM */}
                <form onSubmit={handleSubmitPayment} className="space-y-4 pt-2 border-t border-zinc-100">
                  {/* Option to pay with debt */}
                  <div className="bg-rose-50/40 border border-rose-100/80 p-3 rounded-xl flex items-center justify-between shadow-3xs">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider flex items-center gap-1">
                        🔴 Pagar con Deuda
                      </span>
                      <span className="text-[9.5px] font-semibold text-rose-600">
                        Cargar a tarjeta o crédito rotativo (Te aleja de la libertad financiera)
                      </span>
                    </div>
                    <input
                      id="pay-with-debt-checkbox"
                      type="checkbox"
                      className="size-4.5 rounded text-rose-600 border-rose-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
                      checked={payWithDebt}
                      onChange={(e) => setPayWithDebt(e.target.checked)}
                    />
                  </div>

                  {!payWithDebt ? (
                    /* Visual Account Selector with Balances - Standard flow */
                    <div className="space-y-2">
                      <Label htmlFor="pay-account-id" className="text-xs font-bold text-zinc-700 flex justify-between items-center">
                        <span>Elegir Origen de Fondos *</span>
                        <span className="text-[10px] text-zinc-400 font-bold bg-zinc-100 px-1.5 py-0.5 rounded">Ctrl + Click para múltiples</span>
                      </Label>
                      <p className="text-[10px] text-zinc-400 italic font-semibold block leading-none mb-1">
                        Ctrl + Click para seleccionar más de una cuenta y habilitar distribución de fondos.
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
                                style={{ backgroundColor: acc.color || '#3f3f46' }}
                              >
                                <Wallet className="size-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-zinc-900 truncate tracking-tight">{acc.name}</p>
                                <div className="text-[10px] font-semibold tracking-tight">
                                  <span className="text-emerald-700 font-bold block">Disp: ${availableBalance.toLocaleString()}</span>
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
                      <Label htmlFor="pay-debt-id" className="text-xs font-bold text-rose-800 flex items-center gap-1">
                        💳 Seleccionar Tarjeta de Crédito o Crédito Rotativo *
                      </Label>
                      <p className="text-[10px] text-zinc-500 font-semibold leading-relaxed">
                        Selecciona a qué tarjeta o crédito rotativo existente deseas cargar este pago. La deuda aumentará inmediatamente.
                      </p>
                      <select
                        id="pay-debt-id"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Amount Input */}
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="pay-amount" className="text-xs font-bold text-zinc-700">Monto del Pago ($) *</Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">$</span>
                        <Input
                          id="pay-amount"
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

                    {/* Category select mapping */}
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="pay-category" className="text-xs font-bold text-zinc-700">Categoría Pasivos *</Label>
                      <select
                        id="pay-category"
                        required
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-zinc-950"
                        value={selectedCategoryId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                      >
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        {expenseCategories.length === 0 && (
                          <option value="">Crea categorías de egresos primero</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Subcategory select mapping if active subcategories exist */}
                  {activeSubcategories.length > 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-subcat" className="text-xs font-bold text-zinc-700 flex justify-between items-center">
                        <span>Subcategoría de Pasivo *</span>
                        <span className="text-[10px] text-zinc-400 font-medium">Configuradas para {selectedCategory?.name}</span>
                      </Label>
                      <select
                        id="pay-subcat"
                        required
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-zinc-950"
                        value={selectedSubcategory}
                        onChange={(e) => setSelectedSubcategory(e.target.value)}
                      >
                        {activeSubcategories.map((sub, idx) => (
                          <option key={idx} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* MULTI-ACCOUNT SPLITS PANEL */}
                  {selectedAccountIds.length > 1 && (
                    <div className="space-y-2 mt-4 p-4 border border-zinc-250 bg-zinc-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-1.5">
                          <RefreshCw className="size-3 text-rose-500 animate-spin" style={{ animationDuration: '6s' }} />
                          Distribución Multipago ({selectedAccountIds.length} Cuentas)
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            const M = selectedAccountIds.length;
                            const total = parseFloat(amount) || 0;
                            const baseVal = Math.floor(total / M);
                            const remainder = total - (baseVal * M);
                            const newSplits: Record<string, string> = {};
                            selectedAccountIds.forEach((id, idx) => {
                              newSplits[id] = String(baseVal + (idx < remainder ? 1 : 0));
                            });
                            setAccountSplits(newSplits);
                          }}
                          className="text-[10px] text-indigo-650 hover:text-indigo-850 font-extrabold tracking-tight underline"
                        >
                          Reset Balancear
                        </button>
                      </div>

                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Ajusta manualmente cuánto deducir de cada una de las cuentas elegidas.
                      </p>

                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {selectedAccountIds.map(accId => {
                          const acc = accounts.find(a => a.id === accId);
                          if (!acc) return null;
                          const individualSplitStr = accountSplits[accId] || '';
                          const individualSplitVal = parseFloat(individualSplitStr) || 0;
                          const isOverdrawn = individualSplitVal > (acc.balance || 0);

                          return (
                            <div key={accId} className="flex items-center justify-between gap-2 p-2 border border-zinc-200 rounded-lg bg-white shadow-3xs">
                              <div className="truncate flex-1">
                                <span className="text-[11px] font-bold text-zinc-800 truncate block">
                                  {acc.name}
                                </span>
                                <span className={`text-[9px] font-mono font-bold block mt-0.5 ${isOverdrawn ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`}>
                                  Bal: ${acc.balance.toLocaleString()} {isOverdrawn && '⚠️ Excede'}
                                </span>
                              </div>
                              
                              <div className="relative w-28 shrink-0">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-[10px]">$</span>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  className="h-8 pl-5 text-xs text-right font-bold pr-1.5 border-zinc-200"
                                  value={individualSplitStr}
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

                      {numericAmount > 0 && (
                        <div className="space-y-1 border-t border-zinc-200 pt-2 text-[10px]">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-zinc-500">Monto total:</span>
                            <span className="font-semibold text-zinc-900 font-mono">${numericAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-zinc-500">Monto distribuido:</span>
                            <span className={`font-mono ${isSplitValid ? 'text-emerald-700' : 'text-rose-650'}`}>
                              ${currentSplitsSum.toLocaleString()}
                            </span>
                          </div>

                          {!isSplitValid && (
                            <p className="text-[9px] text-rose-650 font-black leading-none mt-2">
                              🚨 Los splits (${currentSplitsSum.toLocaleString()}) deben sumar exactamente ${numericAmount.toLocaleString()}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                   {/* Vincular a un Fondo de Ahorro o Meta (Opcional) */}
                  <div className="space-y-1.5 p-3.5 border border-zinc-200 bg-zinc-50/50 rounded-xl">
                    <Label htmlFor="pay-linked-fund" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                      <PiggyBank className="size-4 text-emerald-600" />
                      <span>Vincular / Pagar con Fondo de Ahorro (Opcional)</span>
                    </Label>
                    <p className="text-[10px] text-zinc-400 font-medium leading-tight">
                      Si has estado ahorrando específicamente para este fin, vincularlo deducirá automáticamente este monto de tu saldo acumulado en la meta seleccionada.
                    </p>
                    <select
                      id="pay-linked-fund"
                      className="w-full h-10 px-3 mt-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-750 outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                      value={linkedSavingFundId}
                      onChange={(e) => setLinkedSavingFundId(e.target.value)}
                    >
                      <option value="">-- No pagar con fondos de ahorro --</option>
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
                        <div className="mt-3 p-3.5 bg-white border border-zinc-200 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                              Distribución de Fondos (Ahorro vs. Cuentas)
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                              Pagar de Fondo y Cuenta
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-zinc-400 font-medium leading-none">
                            Elige cuánto retirar del ahorro seleccionado. El resto se deducirá de las cuentas.
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="pay-fund-deduct" className="text-[10px] font-bold text-emerald-700">Monto del Fondo</Label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-[10px]">$</span>
                                <Input
                                  id="pay-fund-deduct"
                                  type="number"
                                  className="h-8 pl-5.5 text-xs font-bold text-zinc-800 pr-1 border-zinc-200 font-mono"
                                  value={fundDeductionInput}
                                  max={fund.currentAmount}
                                  onChange={(e) => setFundDeductionInput(e.target.value)}
                                />
                              </div>
                              <span className="text-[9px] text-zinc-500 font-semibold block">Ahorro disp: ${fund.currentAmount.toLocaleString()}</span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-indigo-700 block">Deducir de Cuenta(s)</span>
                              <div className="h-8 px-2.5 border border-zinc-250 bg-zinc-550/5 text-zinc-700 rounded-lg flex items-center justify-between font-mono font-bold text-xs">
                                <span>$</span>
                                <span>{accountDeductionAmount.toLocaleString()}</span>
                              </div>
                              <span className="text-[9px] text-zinc-550 font-semibold block">Total: ${numericAmount.toLocaleString()}</span>
                            </div>
                          </div>

                          {parseFloat(fundDeductionInput) > fund.currentAmount && (
                            <div className="text-[10px] text-rose-650 font-semibold mt-1 leading-tight flex items-center gap-1 bg-rose-50 p-2 rounded-lg border border-rose-100">
                              <AlertTriangle className="size-3.5 text-rose-500 shrink-0" />
                              <span>El monto supera lo disponible en este fondo (${fund.currentAmount.toLocaleString()}).</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* VINCULAR ESTABLECIMIENTO / PROVEEDOR Y STOCK DEL CATÁLOGO */}
                  <div className="space-y-1.5 p-3.5 border border-rose-200/50 bg-rose-50/25 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-rose-700">
                      <Store className="size-4 shrink-0 text-rose-600" />
                      <span className="text-xs font-bold">Vincular Proveedor y Stock del Catálogo (Opcional)</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium leading-tight">
                      Asigna un proveedor o negocio del catálogo colaborativo. Puedes pre-filtrar por tipo para encontrarlo rápidamente. Si tiene productos con stock, podrás seleccionarlos, pre-cargar el monto del pago y descontar automáticamente las unidades compradas.
                    </p>

                    {/* Classification filter for easier search! */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-zinc-500">Filtrar Proveedores por Tipo</Label>
                        <select
                          className="w-full h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10.5px] text-zinc-700 outline-none hover:border-zinc-300"
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
                          <option value="service font-black">🔧 Servicios Públicos/Privados</option>
                          <option value="consumption">🛍️ Consumos Internos</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-zinc-500">Seleccionar Proveedor / Negocio</Label>
                        <select
                          className="w-full h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10.5px] text-zinc-750 outline-none hover:border-zinc-300 font-semibold"
                          value={selectedLinkedStoreId}
                          onChange={(e) => {
                            const storeId = e.target.value;
                            setSelectedLinkedStoreId(storeId);
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

                    {/* Once a store is selected, we let them select a product matching that store! */}
                    {selectedLinkedStoreId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-dashed border-zinc-200">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-zinc-500">Artículos con Precio y Stock</Label>
                          <select
                            className="w-full h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10.5px] text-zinc-750 outline-none hover:border-zinc-300"
                            value={selectedLinkedProductId}
                            onChange={(e) => {
                              const prodId = e.target.value;
                              setSelectedLinkedProductId(prodId);
                              if (prodId) {
                                const prod = catalogProducts.find(p => p.id === prodId);
                                if (prod) {
                                  if (prod.price) {
                                    setAmount(String(prod.price));
                                  }
                                  setDescription(`Pago de ${prod.name} a ${prod.store}`);
                                }
                              }
                            }}
                          >
                            <option value="">-- Sin vincular producto --</option>
                            {productsForSelectedStore.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.name} - ${prod.price ? prod.price.toLocaleString() : '0'} (Stock: {prod.stock || 0})
                              </option>
                            ))}
                            {productsForSelectedStore.length === 0 && (
                              <option value="" disabled>No hay productos registrados para este proveedor</option>
                            )}
                          </select>
                        </div>

                        {selectedLinkedProductId && (
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-500">Descontar Inventario / Stock</Label>
                            <div className="flex items-center gap-1.5 h-8">
                              <span className="text-[10px] font-mono font-bold text-zinc-650 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded">
                                Stock actual: {selectedProductObj?.stock || 0}
                              </span>
                              <select
                                className="flex-1 h-8 px-1 bg-zinc-50 border border-zinc-205 rounded-lg text-[10px] text-zinc-700 font-extrabold outline-none"
                                value={decreaseStockQty}
                                onChange={(e) => setDecreaseStockQty(e.target.value)}
                              >
                                <option value="0">❌ No descontar stock</option>
                                <option value="1">⬇️ Descontar 1 unidad</option>
                                <option value="2">⬇️ Descontar 2 unidades</option>
                                <option value="3">⬇️ Descontar 3 unidades</option>
                                <option value="5">⬇️ Descontar 5 unidades</option>
                                <option value="10">⬇️ Descontar 10 unidades</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-desc" className="text-xs font-bold text-zinc-700">Concepto / Descripción del Pago *</Label>
                    <Input
                      id="pay-desc"
                      placeholder="Ej. Factura agua Abril 2026, Abono tarjeta Visa"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-10 text-xs border-zinc-200"
                    />
                  </div>

                  {/* Optional parameters: Date, eventuality */}
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-date" className="text-xs font-bold text-zinc-700">Fecha del Pago *</Label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                        <input
                          id="pay-date"
                          type="date"
                          required
                          className="w-full h-10 pl-9 pr-2.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none font-medium"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 justify-end h-full">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Otros Atributos</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEventual(!isEventual)}
                          className={`flex-1 h-10 px-2 rounded-lg border text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 ${
                            isEventual 
                              ? 'bg-amber-50 text-amber-700 border-amber-300' 
                              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          {isEventual ? '📅 Eventual: Sí' : '🔄 Mensual Fijo'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsAutoDebit(!isAutoDebit)}
                          className={`flex-1 h-10 px-2 rounded-lg border text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 ${
                            isAutoDebit 
                              ? 'bg-rose-50 text-rose-700 border-rose-300' 
                              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          {isAutoDebit ? '🔄 Débito Auto' : '👤 Manual'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BALANCE INSUFFICIENT ALERTS */}
                  {isBalanceInsufficient && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 items-start text-xs text-rose-900 animate-pulse">
                      <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold leading-tight">⚠️ Fondos insuficientes alertados</p>
                        <p className="text-[10px] opacity-90 mt-0.5">
                          El costo ingresado supera el saldo disponible de una o más de las cuentas seleccionadas. Esto llevará saldos a negativo.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* LIMIT PROGRESS & REACHING WARNINGS */}
                  {numericAmount > 0 && (
                    <div className={`p-3 rounded-xl border text-xs gap-2 ${
                      limitProgressInfo.isExceeded
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : limitProgressInfo.isClose
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-zinc-50 border-zinc-100 text-zinc-650'
                    }`}>
                      <div className="flex justify-between items-center font-bold mb-1">
                        <span className="flex items-center gap-1 font-extrabold">
                          <AlertTriangle className={`size-3.5 ${
                            limitProgressInfo.isExceeded ? 'text-red-650 animate-bounce' : limitProgressInfo.isClose ? 'text-amber-600' : 'text-zinc-400'
                          }`} />
                          Progreso del Límite de Egresos:
                        </span>
                        <span>{limitProgressInfo.percentage.toFixed(0)}%</span>
                      </div>
                      {/* Tiny visual progress bar representing how this payment affects limit */}
                      <div className="w-full h-1.5 bg-zinc-250/50 rounded-full overflow-hidden mt-1.5 relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            limitProgressInfo.isExceeded ? 'bg-red-500' : limitProgressInfo.isClose ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, limitProgressInfo.percentage)}%` }}
                        />
                      </div>
                      
                      {limitProgressInfo.isExceeded && (
                        <p className="text-[10px] font-medium mt-2 leading-snug">
                          🚨 Alerta de tope: Liquidar este pago elevará los egresos a ${limitProgressInfo.projectTotal.toLocaleString()}, superando tu presupuesto mensual de ${limitProgressInfo.limit.toLocaleString()}.
                        </p>
                      )}
                      {limitProgressInfo.isClose && (
                        <p className="text-[10px] font-medium mt-2 leading-snug">
                          ⚠️ Cuidado: Estás próximo a agotar el {limitProgressInfo.percentage.toFixed(0)}% del límite presupuestado (${limitProgressInfo.limit.toLocaleString()}) fijado para el periodo.
                        </p>
                      )}
                      {!limitProgressInfo.isExceeded && !limitProgressInfo.isClose && (
                        <p className="text-[9px] text-zinc-500 font-medium mt-2">
                          Presupuesto seguro: Conservas suficiente espacio debajo de tu presupuesto límite para asentar esta obligación con seguridad.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Submitting button */}
                  <Button
                    id="submit-custom-payment-btn"
                    type="submit"
                    disabled={isSaving || (selectedAccountIds.length > 1 && !isSplitValid)}
                    className="w-full bg-zinc-950 font-extrabold text-sm hover:bg-zinc-800 text-white h-11 shadow-sm transition-all flex items-center justify-center gap-2 rounded-xl mt-4"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin size-4 shrink-0" />
                        <span>Procesando Liquidación de Pago...</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="size-4 shrink-0 text-rose-300" />
                        <span>💸 Asentar Obligación de Pago</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Ledger history */}
          <div className="lg:col-span-7">
            <TransactionsList 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
              filterType="expense"
            />
          </div>
        </div>
      )}

      {/* VISTA 2: PROGRAMACIÓN DE PAGOS RECURRENTES (CRUD COMPLETO) */}
      {activeSubTab === 'recurrentes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-rose-50 shadow-3xs">
            <div>
              <p className="text-xs text-zinc-500 leading-normal">
                Configura obligaciones que deban realizarse con frecuencia mensual, semanal o en intervalos personalizados. El sistema las recordará y podrás liquidarlas con un solo click.
              </p>
            </div>
            
            {!isRecFormOpen && (
              <Button 
                onClick={() => {
                  setEditingRecId(null);
                  setRecFormData({
                    name: '',
                    amount: '',
                    paymentType: 'fixed',
                    accountId: accounts[0]?.id || '',
                    categoryId: expenseCategories[0]?.id || '',
                    subcategoryId: '',
                    dayOfMonth: '1',
                    startDate: new Date().toISOString().split('T')[0],
                    frequency: 'monthly',
                    intervalMonths: '1',
                    description: '',
                    active: true
                  });
                  setIsRecFormOpen(true);
                }}
                className="bg-zinc-950 text-white hover:bg-zinc-800 font-extrabold text-xs h-9 rounded-lg flex items-center gap-1 shrink-0"
              >
                <Plus className="size-4" /> Agregar Programación
              </Button>
            )}
          </div>

          {/* FORMULARIO DE AGREGAR / EDITAR PAGO RECURRENTE */}
          {isRecFormOpen && (
            <Card className="border-rose-200 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
              <CardHeader className="flex flex-row justify-between items-start pb-4 pt-6">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-950">
                    <Settings className="size-4 text-rose-500" />
                    {editingRecId ? 'Editar Plantilla de Obligación' : 'Programar Nueva Obligación / Pago Recurrente'}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 mt-1">
                    Crea los parámetros para recordar y asentar este pago según su ciclo.
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-zinc-400 hover:text-zinc-600 rounded-full"
                  onClick={() => {
                    setIsRecFormOpen(false);
                    setEditingRecId(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSaveRecurringExpense} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Concept Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-name" className="text-xs font-bold text-zinc-700">Nombre / Concepto *</Label>
                      <Input 
                        id="rec-name" 
                        placeholder="Ej. Factura Celular Movistar, Cuota Arriendo" 
                        value={recFormData.name}
                        onChange={(e) => setRecFormData({ ...recFormData, name: e.target.value })}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    {/* Fixed vs Variable paymentType */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-zinc-700 block">Tipo de Cobro *</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRecFormData({ ...recFormData, paymentType: 'fixed' })}
                          className={`flex-1 h-10 rounded-lg border text-[11px] font-black tracking-tight transition-all ${
                            recFormData.paymentType === 'fixed'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-2xs'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          💸 Monto Fijo
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecFormData({ ...recFormData, paymentType: 'variable', amount: '0' })}
                          className={`flex-1 h-10 rounded-lg border text-[11px] font-black tracking-tight transition-all ${
                            recFormData.paymentType === 'variable'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-2xs'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          📊 Variable
                        </button>
                      </div>
                    </div>

                    {/* Amount Block */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-amount" className="text-xs font-bold text-zinc-700">Monto Estimado / Fijo ($) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">$</span>
                        <Input 
                          id="rec-amount"
                          type="number"
                          step="0.01"
                          placeholder={recFormData.paymentType === 'variable' ? '0 (Se define al pagar)' : '150000'}
                          disabled={recFormData.paymentType === 'variable'}
                          value={recFormData.paymentType === 'variable' ? '' : recFormData.amount}
                          onChange={(e) => setRecFormData({ ...recFormData, amount: e.target.value })}
                          required={recFormData.paymentType === 'fixed'}
                          className="pl-7 h-10 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    {/* Periodicity / Frecuencia */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-frequency" className="text-xs font-bold text-zinc-700 block">Frecuencia de Cobro *</Label>
                      <select
                        id="rec-frequency"
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs"
                        value={recFormData.frequency}
                        onChange={(e: any) => setRecFormData({ ...recFormData, frequency: e.target.value })}
                      >
                        <option value="weekly">📅 Semanal</option>
                        <option value="biweekly">📅 Quincenal</option>
                        <option value="monthly">📅 Mensual</option>
                        <option value="custom_months">📅 Cada N meses...</option>
                      </select>
                    </div>

                    {/* Custom interval months input (Conditional) */}
                    {recFormData.frequency === 'custom_months' && (
                      <div className="space-y-1.5 animate-fade-in font-black text-indigo-950">
                        <Label htmlFor="rec-interval" className="text-xs font-bold block">¿Cada cuántos meses? (N) *</Label>
                        <Input 
                          id="rec-interval"
                          type="number"
                          min="1"
                          max="12"
                          placeholder="Ej. 2, 3 o 4"
                          value={recFormData.intervalMonths}
                          required
                          onChange={(e) => setRecFormData({ ...recFormData, intervalMonths: e.target.value })}
                          className="h-10 text-xs text-center font-bold"
                        />
                      </div>
                    )}

                    {/* Day calculation */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-day" className="text-xs font-bold text-zinc-700 block">Día de recordatorio / pago *</Label>
                      <select
                        id="rec-day"
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs"
                        value={recFormData.dayOfMonth}
                        onChange={(e) => setRecFormData({ ...recFormData, dayOfMonth: e.target.value })}
                      >
                        {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(day => (
                          <option key={day} value={day}>Día {day} del mes</option>
                        ))}
                      </select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-start" className="text-xs font-bold text-zinc-700 block">Fecha aproximada de inicio *</Label>
                      <Input 
                        id="rec-start" 
                        type="date" 
                        value={recFormData.startDate}
                        onChange={(e) => setRecFormData({ ...recFormData, startDate: e.target.value })}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    {/* Status Toggle */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-zinc-700 block">Estado Inicial *</Label>
                      <div className="flex items-center gap-2 h-10">
                        <input
                          id="rec-active"
                          type="checkbox"
                          checked={recFormData.active}
                          onChange={(e) => setRecFormData({ ...recFormData, active: e.target.checked })}
                          className="size-4 accent-rose-600 rounded border-zinc-305"
                        />
                        <Label htmlFor="rec-active" className="text-xs font-semibold text-zinc-650 cursor-pointer select-none">
                          ¿Mantener programación activa?
                        </Label>
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Default Source Account */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-account" className="text-xs font-bold text-zinc-700 block">Cuenta recomendada por defecto *</Label>
                      <select
                        id="rec-account"
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs"
                        value={recFormData.accountId}
                        onChange={(e) => setRecFormData({ ...recFormData, accountId: e.target.value })}
                        required
                      >
                        {accounts.map(a => {
                          const accountFunds = savingFunds.filter(f => f.accountId === a.id);
                          const totalSaved = accountFunds.reduce((sum, f) => sum + (f.currentAmount || 0), 0);
                          const availableBalance = Math.max(0, (Number(a.balance) || 0) - totalSaved);
                          const subtext = totalSaved > 0 ? `| Disp: $${availableBalance.toLocaleString()} (Res: $${totalSaved.toLocaleString()})` : ``;
                          return (
                            <option key={a.id} value={a.id}>
                              {a.name} (Saldo: ${a.balance.toLocaleString()} {subtext})
                            </option>
                          );
                        })}
                        {accounts.length === 0 && <option value="" disabled>Por favor crea una cuenta primero</option>}
                      </select>
                    </div>

                    {/* Category Associated */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-cat" className="text-xs font-bold text-zinc-700 block">Categoría de egreso *</Label>
                      <select
                        id="rec-cat"
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs"
                        value={recFormData.categoryId}
                        onChange={(e) => setRecFormData({ ...recFormData, categoryId: e.target.value, subcategoryId: '' })}
                        required
                      >
                        {expenseCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategories */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-sub" className="text-xs font-bold text-zinc-700 block">Subcategoría (Opcional)</Label>
                      <select
                        id="rec-sub"
                        disabled={recActiveSubcategories.length === 0}
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs disabled:opacity-50"
                        value={recFormData.subcategoryId}
                        onChange={(e) => setRecFormData({ ...recFormData, subcategoryId: e.target.value })}
                      >
                        <option value="">Ninguna</option>
                        {recActiveSubcategories.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  {/* VINCULACIÓN DE PROVEEDOR Y STOCK (CATÁLOGO) PARA OBLIGACIÓN RECURRENTE */}
                  <div className="space-y-1.5 p-3.5 border border-amber-200/50 bg-amber-50/25 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Store className="size-4 shrink-0 text-amber-600" />
                      <span className="text-xs font-bold">Vincular Proveedor / Stock del Catálogo (Opcional)</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      Vincular un proveedor y un artículo permite pre-cargar el costo de forma dinámica y descontar automáticamente el stock del catálogo en cada vencimiento que liquides.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="rec-store-link" className="text-[10px] font-bold text-zinc-500">Proveedor del Catálogo</Label>
                        <select
                          id="rec-store-link"
                          className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-zinc-750"
                          value={recFormData.linkedStoreId}
                          onChange={(e) => {
                            setRecFormData(prev => ({
                              ...prev,
                              linkedStoreId: e.target.value,
                              linkedProductId: ''
                            }));
                          }}
                        >
                          <option value="">-- No vincular establecimiento --</option>
                          {recFilteredStores.map(st => (
                            <option key={st.id} value={st.id}>{st.name} ({translateType(st.type)})</option>
                          ))}
                        </select>
                      </div>

                      {recFormData.linkedStoreId && (
                        <div className="space-y-1">
                          <Label htmlFor="rec-prod-link" className="text-[10px] font-bold text-zinc-500">Artículo / Servicio</Label>
                          <select
                            id="rec-prod-link"
                            className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-zinc-750"
                            value={recFormData.linkedProductId}
                            onChange={(e) => {
                              const prodId = e.target.value;
                              const prod = catalogProducts.find(p => p.id === prodId);
                              setRecFormData(prev => ({
                                ...prev,
                                linkedProductId: prodId,
                                amount: (prod && prod.price) ? String(prod.price) : prev.amount,
                                name: (prod && prod.name) ? `${prod.name} (${prod.store})` : prev.name
                              }));
                            }}
                          >
                            <option value="">-- No vincular producto --</option>
                            {recProductsForSelectedStore.map(p => (
                              <option key={p.id} value={p.id}>{p.name} - ${p.price} (Stock: {p.stock || 0})</option>
                            ))}
                            {recProductsForSelectedStore.length === 0 && (
                              <option value="" disabled>Sin productos asociados</option>
                            )}
                          </select>
                        </div>
                      )}
                    </div>

                    {recFormData.linkedProductId && (
                      <div className="pt-2 border-t border-dashed border-zinc-200 flex flex-wrap gap-4 items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                          Stock Actual en Catálogo: {recSelectedProductObj?.stock || 0} unidades
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <Label htmlFor="rec-stock-qty" className="text-[10px] font-bold text-zinc-500">Disminución de Stock al Liquidar:</Label>
                          <select
                            id="rec-stock-qty"
                            className="h-8 px-2 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold outline-none"
                            value={recFormData.decreaseStockQty}
                            onChange={(e) => setRecFormData(prev => ({ ...prev, decreaseStockQty: e.target.value }))}
                          >
                            <option value="0">❌ No descontar stock</option>
                            <option value="1">⬇️ Descontar 1 unidad</option>
                            <option value="2">⬇️ Descontar 2 unidades</option>
                            <option value="3">⬇️ Descontar 3 unidades</option>
                            <option value="5">⬇️ Descontar 5 unidades</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes description details */}
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-desc" className="text-xs font-bold text-zinc-700">Detalles adicionales, recordatorios o notas</Label>
                    <Input 
                      id="rec-desc"
                      placeholder="Ej. Cobros directos a tarjeta prepagada los días de quincena"
                      value={recFormData.description}
                      onChange={(e) => setRecFormData({ ...recFormData, description: e.target.value })}
                      className="h-10 text-xs"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-3 border-t border-zinc-100 justify-end">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsRecFormOpen(false);
                        setEditingRecId(null);
                      }}
                      className="font-bold h-10 px-4 rounded-xl text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold h-10 px-6 rounded-xl text-xs"
                    >
                      {editingRecId ? '💾 Actualizar Obligación' : '✨ Guardar Programación'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* LISTA DE PLANTILLAS Y PROGRAMACIONES EXISTENTES */}
          <Card className="border-rose-100/70 shadow-xs">
            <CardHeader className="pb-3 pt-6 border-b border-rose-50/50">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Obligaciones y Pagos recurrentes programados ({recurringExpenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recurringExpenses.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <span className="text-3xl block">🗓️</span>
                  <p className="text-xs font-bold text-zinc-800">No tienes obligaciones programadas</p>
                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                    Crea plantillas para tus cobros frecuentes (agua, celular, streaming) para asentar pagos en un click y recordar fechas automáticamente.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-150 text-zinc-400 uppercase text-[9px] font-black tracking-wider">
                        <th className="py-3 px-4 font-black">Obligación / Concepto</th>
                        <th className="py-3 px-4 font-black">Monto Est.</th>
                        <th className="py-3 px-4 font-black">Ciclo / Período</th>
                        <th className="py-3 px-4 font-black">Cuenta Estimada</th>
                        <th className="py-3 px-4 font-black">Categoría</th>
                        <th className="py-3 px-4 font-black text-center">Estado</th>
                        <th className="py-3 px-4 font-black text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {recurringExpenses.map(exp => {
                        const account = accounts.find(a => a.id === exp.accountId);
                        const category = categories.find(c => c.id === exp.categoryId);
                        
                        let freqLabel = 'Mensual';
                        if (exp.frequency === 'weekly') freqLabel = 'Semanal';
                        if (exp.frequency === 'biweekly') freqLabel = 'Quincenal';
                        if (exp.frequency === 'custom_months') freqLabel = `Cada ${exp.intervalMonths || 2} meses`;

                        return (
                          <tr key={exp.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-zinc-900 block">{exp.name}</span>
                              {exp.description && (
                                <span className="text-[10px] text-zinc-400 font-medium block truncate max-w-[200px]">
                                  {exp.description}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold font-mono">
                              {exp.paymentType === 'fixed' ? (
                                <span className="text-zinc-800">${exp.amount.toLocaleString()}</span>
                              ) : (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200">
                                  📊 Variable
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-650 font-semibold">
                              <span>📅 {freqLabel} (Día {exp.dayOfMonth})</span>
                              <span className="text-[9px] text-zinc-400 block font-medium">Inicia: {exp.startDate}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-zinc-550">
                              {account?.name || 'Varios / No definida'}
                            </td>
                            <td className="py-3 px-4">
                              {category ? (
                                <span 
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-3xs"
                                  style={{ backgroundColor: category.color || '#e11d48' }}
                                >
                                  {category.name}
                                  {exp.subcategoryId && ` • ${exp.subcategoryId}`}
                                </span>
                              ) : (
                                <span className="text-zinc-400">Sin categoría</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button 
                                onClick={() => handleToggleRecActive(exp)}
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition-all ${
                                  exp.active 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : 'bg-zinc-100 text-zinc-550 border border-zinc-200'
                                }`}
                              >
                                {exp.active ? '▶️ Activa' : '⏸️ Pausada'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <Button 
                                  onClick={() => handleApplyRecExpenseClick(exp)}
                                  disabled={!exp.active}
                                  size="sm" 
                                  className="h-7 w-7 p-0 bg-rose-600 font-bold text-white hover:bg-rose-700 rounded-md"
                                  title="Liquidar/Pagar"
                                >
                                  <Check className="size-3.5" />
                                </Button>
                                <Button 
                                  onClick={() => handleEditRecExpense(exp)}
                                  variant="outline"
                                  size="sm" 
                                  className="h-7 w-7 p-0 bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                                  title="Editar"
                                >
                                  <Edit className="size-3.5" />
                                </Button>
                                <Button 
                                  onClick={() => handleDeleteRecExpense(exp.id)}
                                  variant="ghost"
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 rounded-md"
                                  title="Eliminar"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* DIÁLOGO / MODAL DE CONFIRMACIÓN O MODIFICACIÓN ANTES DE ASENTAR PAGO PROGRAMADO */}
      {confirmingExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-sm bg-white border border-rose-200 shadow-2xl rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-amber-500" />
            
            <CardHeader className="pb-3 pt-6 flex flex-row justify-between items-start">
              <div>
                <CardTitle className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarCheck className="size-4 text-rose-600" />
                  Confirmar Liquidación de Pago
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500 mt-1">
                  Revisa y ajusta los montos o la cuenta origen de este período antes de realizar el descuento de saldos.
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-zinc-400 hover:text-zinc-650 rounded-full" 
                onClick={() => setConfirmingExpense(null)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <span className="text-[9px] font-black uppercase text-rose-700 block tracking-wider">Concepto</span>
                <span className="text-xs font-bold text-zinc-800">{confirmingExpense.name}</span>
                {confirmingExpense.description && (
                  <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{confirmingExpense.description}</p>
                )}
              </div>

              {/* Amount form field */}
              <div className="space-y-1.5">
                <Label htmlFor="conf-amount" className="text-xs font-bold text-zinc-700">Monto Real Cobrado ($) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">$</span>
                  <Input 
                    id="conf-amount" 
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    className="pl-7 h-10 font-mono font-bold text-sm"
                    value={confirmingAmount}
                    onChange={(e) => setConfirmingAmount(e.target.value)}
                  />
                </div>
                {confirmingExpense.paymentType === 'fixed' ? (
                  <p className="text-[9px] text-indigo-650 font-bold">
                    💵 Valor Fijo de plantilla: ${confirmingExpense.amount.toLocaleString()} (Puedes ajustarlo si varió este mes)
                  </p>
                ) : (
                  <p className="text-[9px] text-amber-600 font-bold animate-pulse">
                    ⚠️ Valor de Plantilla Variable: Ingresa el valor exacto cobrado hoy.
                  </p>
                )}
              </div>

              {/* Choosing Accounts */}
              <div className="space-y-1.5">
                <Label htmlFor="conf-account" className="text-xs font-bold text-zinc-700 block">Deducir de la Cuenta *</Label>
                <select 
                  id="conf-account" 
                  className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs"
                  value={confirmingAccountId}
                  onChange={(e) => setConfirmingAccountId(e.target.value)}
                >
                  {accounts.map(a => {
                    const accountFunds = savingFunds.filter(f => f.accountId === a.id);
                    const totalSaved = accountFunds.reduce((sum, f) => sum + (f.currentAmount || 0), 0);
                    const availableBalance = Math.max(0, (Number(a.balance) || 0) - totalSaved);
                    const subtext = totalSaved > 0 ? `| Disp: $${availableBalance.toLocaleString()} (Res: $${totalSaved.toLocaleString()})` : ``;
                    return (
                      <option key={a.id} value={a.id}>
                        {a.name} (Saldo: ${a.balance.toLocaleString()} {subtext})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Linked Saving Fund / Goal */}
              <div className="space-y-1.5 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <Label htmlFor="conf-linked-fund" className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
                  <PiggyBank className="size-3.5 text-emerald-600" />
                  <span>Vincular a un Fondo de Ahorro/Meta</span>
                </Label>
                <select 
                  id="conf-linked-fund" 
                  className="w-full h-9 px-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 outline-none"
                  value={confirmingLinkedSavingFundId}
                  onChange={(e) => setConfirmingLinkedSavingFundId(e.target.value)}
                >
                  <option value="">-- No vincular a ningún ahorro --</option>
                  {savingFunds.map(fund => (
                    <option key={fund.id} value={fund.id}>
                      🎯 {fund.name} (Ahorrado: ${fund.currentAmount.toLocaleString()})
                    </option>
                  ))}
                </select>
                {confirmingLinkedSavingFundId && (() => {
                  const fund = savingFunds.find(f => f.id === confirmingLinkedSavingFundId);
                  if (!fund) return null;
                  const rawAmount = parseFloat(confirmingAmount) || 0;
                  const confFundDeductionVal = parseFloat(confirmingFundDeductionInput) || 0;
                  const confAccountDeductionVal = Math.max(0, rawAmount - confFundDeductionVal);
                  return (
                    <div className="mt-2.5 pt-2.5 border-t border-zinc-200 space-y-2.5">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                        Distribución de Fondos
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="conf-fund-deduct" className="text-[9px] font-bold text-emerald-600">Retirar del Fondo</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-[10px]">$</span>
                            <Input
                              id="conf-fund-deduct"
                              type="number"
                              className="h-8 pl-4.5 text-xs font-bold text-zinc-800 pr-1 border-zinc-200 font-mono"
                              value={confirmingFundDeductionInput}
                              max={fund.currentAmount}
                              onChange={(e) => setConfirmingFundDeductionInput(e.target.value)}
                            />
                          </div>
                          <span className="text-[8px] text-zinc-400 block font-semibold">Ahorro: ${fund.currentAmount.toLocaleString()}</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-zinc-650 block">Deducir de Cuenta</span>
                          <div className="h-8 px-2 border border-zinc-200 bg-zinc-100 rounded-lg flex items-center justify-between font-mono font-bold text-xs">
                            <span className="text-[10px]">$</span>
                            <span>{confAccountDeductionVal.toLocaleString()}</span>
                          </div>
                          <span className="text-[8px] text-zinc-400 block font-semibold font-mono">Total: ${rawAmount.toLocaleString()}</span>
                        </div>
                      </div>

                      {confFundDeductionVal > fund.currentAmount && (
                        <p className="text-[8px] text-rose-500 font-bold leading-tight">
                          ⚠️ Supera el disponible en este fondo (${fund.currentAmount.toLocaleString()}).
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Choosing Date */}
              <div className="space-y-1.5">
                <Label htmlFor="conf-date" className="text-xs font-bold text-zinc-700 block">Fecha del Asiento *</Label>
                <Input 
                  id="conf-date" 
                  type="date"
                  className="h-10 text-xs"
                  value={confirmingDate}
                  onChange={(e) => setConfirmingDate(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100">
                <Button 
                  onClick={() => setConfirmingExpense(null)}
                  variant="outline" 
                  className="flex-1 font-bold h-10 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleApplyRecExpenseConfirm}
                  className="flex-1 bg-zinc-950 font-bold hover:bg-zinc-800 text-white h-10 rounded-xl"
                >
                  Confirmar Liquidación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
