import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Account, Category, UserSettings, RecurringIncome } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dbService } from '@/src/lib/db';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  Repeat, 
  User, 
  Receipt, 
  Trash2, 
  ArrowUpRight, 
  Info,
  TrendingUp,
  Plus,
  Edit3,
  CheckCircle,
  Clock,
  X,
  Play,
  CreditCard,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { AddTransactionDialog } from './AddTransactionDialog';

interface IncomesTrackerViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  settings: UserSettings | null;
  onNavigateToTab?: (tab: string) => void;
}

export function IncomesTrackerView({ 
  transactions, 
  accounts, 
  categories, 
  settings, 
  onNavigateToTab 
}: IncomesTrackerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'eventual' | 'recurring'>('all');
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringIncome[]>([]);

  // Subscribe to recurring templates list to show them inside the recurring tab
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('recurring_incomes', setRecurringTemplates);
    return () => unsub();
  }, []);

  // Filter only Income type transactions
  const incomeTransactions = transactions.filter(t => t.type === 'income');

  // Split income transactions into eventual or recurring with smart fallbacks for pre-existing records
  const eventualIncomes = incomeTransactions.filter(t => {
    if (t.isEventual === true) return true;
    // Check if category name matches "ocasional" or "eventual" or "extra"
    const cat = categories.find(c => c.id === t.categoryId);
    const catName = cat?.name?.toLowerCase() || '';
    if (catName.includes('ocasional') || catName.includes('eventual') || catName.includes('extra')) {
      return true;
    }
    return false;
  });

  const recurringIncomes = incomeTransactions.filter(t => {
    // If it qualifies as eventual, it's not recurring
    if (t.isEventual === true) return false;
    const cat = categories.find(c => c.id === t.categoryId);
    const catName = cat?.name?.toLowerCase() || '';
    if (catName.includes('ocasional') || catName.includes('eventual') || catName.includes('extra')) {
      return false;
    }
    return true;
  });

  // Sort them by newest date
  const sortedAll = [...incomeTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const sortedEventuals = [...eventualIncomes].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const sortedRecurrings = [...recurringIncomes].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Handle deletion of an income transaction with full account balance adjustment
  const handleDeleteTransaction = async (t: Transaction) => {
    if (!window.confirm('¿Seguro que deseas eliminar el registro de este ingreso? El saldo de la cuenta será revertido.')) return;
    try {
      // 1. Delete item
      await dbService.deleteItem('transactions', t.id);
      
      // 2. Adjust account balance
      const account = accounts.find(a => a.id === t.accountId);
      if (account) {
        const currentBalance = Number(account.balance) || 0;
        const newBalance = currentBalance - Number(t.amount); // Deduct key amount because it was income
        await dbService.updateItem('accounts', account.id, {
          balance: newBalance
        });
      }
      toast.success('Ingreso eliminado exitosamente');
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al intentar borrar el registro');
    }
  };

  // --- Embedded Recurring Income Templates Logic ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Correction/Confirmation dialog state
  const [confirmingTemplate, setConfirmingTemplate] = useState<RecurringIncome | null>(null);
  const [confirmingAmount, setConfirmingAmount] = useState<string>('');
  
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    amount: '',
    accountId: '',
    categoryId: '',
    dayOfMonth: '15',
    description: '',
    active: true,
    frequency: 'mensual' as 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual',
    startMonth: String(new Date().getMonth() + 1)
  });

  // Filter income categories
  const incomeCategories = useMemo(() => {
    return categories.filter(c => c.type === 'income');
  }, [categories]);

  // Handle open new template form
  const handleOpenNewForm = () => {
    setEditingId(null);
    setTemplateFormData({
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

  // Handle open edit template
  const handleOpenEdit = (inc: RecurringIncome) => {
    setEditingId(inc.id);
    setTemplateFormData({
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

  // Save / Update recurring income template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFormData.name.trim() || !templateFormData.amount || !templateFormData.accountId || !templateFormData.categoryId) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    const value = parseFloat(templateFormData.amount);
    if (isNaN(value) || value <= 0) {
      toast.error('El monto debe ser un número positivo');
      return;
    }

    const day = parseInt(templateFormData.dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('Día del mes inválido (1-31)');
      return;
    }

    const isCustomFreq = templateFormData.frequency !== 'mensual' && templateFormData.frequency !== 'quincenal';
    const parsedStartMonth = parseInt(templateFormData.startMonth);

    const finalData = {
      name: templateFormData.name.trim(),
      amount: value,
      accountId: templateFormData.accountId,
      categoryId: templateFormData.categoryId,
      dayOfMonth: day,
      description: templateFormData.description.trim(),
      active: templateFormData.active,
      frequency: templateFormData.frequency,
      startMonth: isCustomFreq ? (isNaN(parsedStartMonth) ? 1 : parsedStartMonth) : undefined
    };

    try {
      if (editingId) {
        await dbService.updateItem('recurring_incomes', editingId, finalData);
        toast.success(`Plantilla "${finalData.name}" actualizada con éxito`);
      } else {
        await dbService.addItem('recurring_incomes', finalData);
        if (isCustomFreq) {
          toast.success(`Plantilla "${finalData.name}" configurada con frecuencia "${finalData.frequency}" (Mes de inicio: ${templateFormData.startMonth}).`);
        } else {
          toast.success(`Plantilla "${finalData.name}" configurada. Se repetirá con frecuencia "${finalData.frequency}".`);
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

  // Delete recurring income template
  const handleDeleteTemplate = async (incId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla de ingreso recurrente?')) return;
    try {
      await dbService.deleteItem('recurring_incomes', incId);
      toast.success('Plantilla de ingreso eliminada');
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

  // Check pending notifications for today
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

    return recurringTemplates.filter(inc => {
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
  }, [recurringTemplates]);
  // --------------------------------------------------

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Visual Subtabs Swapper */}
      <div className="flex bg-zinc-100 p-1.5 rounded-2xl max-w-2xl w-full border border-zinc-200/60 shadow-xs gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('all')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
            activeSubTab === 'all'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <TrendingUp className="size-4 text-indigo-500" />
          Todos los Ingresos
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('eventual')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
            activeSubTab === 'eventual'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Calendar className="size-4 text-amber-500" />
          Ingresos Eventuales
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('recurring')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
            activeSubTab === 'recurring'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Repeat className="size-4 text-emerald-500" />
          Ingresos Recurrentes
        </button>
      </div>

      {/* ALL INCOMES SCREEN */}
      {activeSubTab === 'all' && (
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="pb-3 border-b border-zinc-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <TrendingUp className="size-5 text-indigo-500" />
                Registro de Ingresos (Activos)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 leading-normal mt-1">
                Visualización consolidada de todos tus ingresos registrados. Usa las pestañas superiores para filtrar o administrar flujos específicos.
              </CardDescription>
            </div>
            {/* Quick button to register transaction and default to current general behavior */}
            <div>
              <AddTransactionDialog 
                accounts={accounts} 
                categories={categories} 
                activeTab="income"
                settings={settings}
                defaultType="income"
                triggerElement={
                  <Button className="bg-zinc-900 hover:bg-zinc-850 text-white font-black text-xs px-4 py-2.5 rounded-xl shrink-0 leading-none">
                    <Plus className="size-3.5 mr-1 bg-zinc-800 p-0.5 rounded-full" />
                    Registrar Nuevo Ingreso
                  </Button>
                }
              />
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {sortedAll.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción / Detalle</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Cuenta Destino</TableHead>
                    <TableHead>Tipo de Ingreso</TableHead>
                    <TableHead className="text-right flex-1">Monto</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAll.map((t) => {
                    const account = accounts.find(a => a.id === t.accountId);
                    const cat = categories.find(c => c.id === t.categoryId);
                    const isEv = t.isEventual || eventualIncomes.some(ev => ev.id === t.id);
                    
                    return (
                      <TableRow key={t.id} className="hover:bg-zinc-50/50">
                        <TableCell className="font-semibold text-xs whitespace-nowrap">
                          {format(new Date(t.date), 'dd MMM, yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-zinc-805 text-xs">
                              {isEv && t.concept ? `${t.concept}` : (t.description || 'Ingreso registrado')}
                            </span>
                            {isEv && t.payerOrEntity && (
                              <div className="text-[10px] text-amber-800 font-extrabold flex items-center gap-1 mt-0.5">
                                <span>Pagador:</span>
                                <span className="bg-amber-100/50 px-1 py-0.5 rounded border border-amber-200/40">{t.payerOrEntity}</span>
                              </div>
                            )}
                            {t.description && isEv && t.concept && (
                              <span className="text-[10px] text-zinc-450 italic font-normal">
                                {t.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className="font-normal"
                            style={{ 
                              backgroundColor: cat?.color ? `${cat.color}15` : undefined, 
                              color: cat?.color || '#10b981',
                              borderColor: cat?.color ? `${cat.color}30` : undefined
                            }}
                          >
                            {cat?.name || 'Sueldo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-655 text-xs font-semibold">
                          {account?.name || '---'}
                        </TableCell>
                        <TableCell>
                          {isEv ? (
                            <Badge variant="outline" className="font-bold text-[9px] bg-amber-50 text-amber-700 border-amber-250 uppercase tracking-wider">
                              Eventual
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-bold text-[9px] bg-emerald-50 text-emerald-700 border-emerald-250 uppercase tracking-wider">
                              Recurrente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-xs whitespace-nowrap">
                          +${(t.amount || 0).toLocaleString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            className="text-zinc-455 hover:text-rose-600 hover:bg-rose-50 size-7"
                            onClick={() => handleDeleteTransaction(t)}
                            title="Eliminar registro"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16 text-zinc-500 space-y-2">
                <Info className="size-8 text-zinc-330 mx-auto" />
                <p className="text-sm font-bold text-zinc-700">No hay ingresos registrados.</p>
                <p className="text-xs text-zinc-450 max-w-xs mx-auto">Comienza agregando un nuevo ingreso utilizando el botón superior.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* EVENTUAL INCOMES SCREEN */}
      {activeSubTab === 'eventual' && (
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="pb-3 border-b border-zinc-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Calendar className="size-5 text-amber-500" />
                Control de Ingresos Eventuales (Ocasionales)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 leading-normal mt-1 max-w-2xl">
                Flujos de capital fortuitos u ocasionales como consultorías rápidas, freelance, reembolsos o venta de garage. 
                Cada ingreso aquí registrado exige indicar el pagador o entidad correspondiente y el concepto.
              </CardDescription>
            </div>
            {/* Quick button to register specifically eventual income */}
            <div>
              <AddTransactionDialog 
                accounts={accounts} 
                categories={categories} 
                activeTab="income"
                settings={settings}
                defaultType="income"
                defaultIsEventual={true}
                buttonClassName="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 inline-flex items-center gap-1 shadow-sm px-4.5 py-2.5 rounded-xl transition-all"
                triggerElement={
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shrink-0 leading-none">
                    <Plus className="size-3.5 mr-1 bg-amber-500/50 p-0.5 rounded-full" />
                    Registrar Ingreso Eventual
                  </Button>
                }
              />
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {sortedEventuals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Persona / Entidad Emisora</TableHead>
                    <TableHead>Concepto Eventual</TableHead>
                    <TableHead>Cuenta Destino</TableHead>
                    <TableHead>Comentario / Detalle</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEventuals.map((t) => {
                    const account = accounts.find(a => a.id === t.accountId);
                    
                    return (
                      <TableRow key={t.id} className="hover:bg-zinc-50/50">
                        <TableCell className="font-semibold text-xs whitespace-nowrap">
                          {format(new Date(t.date), 'dd MMM, yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-amber-50 border border-amber-100 rounded text-amber-700">
                              <User className="size-3" />
                            </div>
                            <span className="font-bold text-zinc-800 text-xs">{t.payerOrEntity || 'Preexistente / ---'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {t.concept || 'Ingreso Ocasional'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-600 text-xs font-medium">
                          {account?.name || '---'}
                        </TableCell>
                        <TableCell className="text-zinc-500 text-xs italic max-w-xs truncate">
                          {t.description || 'Sin comentarios adicionales'}
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-xs whitespace-nowrap">
                          +${(t.amount || 0).toLocaleString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            className="text-zinc-455 hover:text-rose-600 hover:bg-rose-50 size-7 rounded-lg"
                            onClick={() => handleDeleteTransaction(t)}
                            title="Eliminar registro"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16 text-zinc-500 space-y-2">
                <Info className="size-8 text-zinc-330 mx-auto" />
                <p className="text-sm font-bold text-zinc-700">No hay ingresos eventuales registrados.</p>
                <p className="text-xs text-zinc-450 max-w-xs mx-auto">Comienza usando el botón "Registrar Ingreso Eventual" para crear uno rápidamente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RECURRING INCOMES SCREEN */}
      {activeSubTab === 'recurring' && (
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-white">
            <CardHeader className="pb-3 border-b border-zinc-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Repeat className="size-5 text-emerald-500" />
                  Registro de Ingresos Recurrentes (Planificados)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 leading-normal mt-1">
                  Listado de transacciones correspondientes a sus ingresos recurrentes o planificados (como salarios, arriendos fijos, etc).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {sortedRecurrings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción / Etiqueta</TableHead>
                      <TableHead>Tipo de Ingreso</TableHead>
                      <TableHead>Cuenta Destino</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecurrings.map((t) => {
                      const account = accounts.find(a => a.id === t.accountId);
                      const cat = categories.find(c => c.id === t.categoryId);
                      
                      return (
                        <TableRow key={t.id} className="hover:bg-zinc-50/50">
                          <TableCell className="font-semibold text-xs whitespace-nowrap">
                            {format(new Date(t.date), 'dd MMM, yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <span className="font-extrabold text-zinc-800 text-xs">{t.description || 'Ingreso periódico automatizado'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className="font-normal"
                              style={{ 
                                backgroundColor: cat?.color ? `${cat.color}15` : undefined, 
                                color: cat?.color || '#10b981',
                                borderColor: cat?.color ? `${cat.color}30` : undefined
                              }}
                            >
                              {cat?.name || 'Sueldo / Nómina'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-600 text-xs font-medium">
                            {account?.name || '---'}
                          </TableCell>
                          <TableCell className="text-right font-black text-emerald-600 text-xs whitespace-nowrap">
                            +${(t.amount || 0).toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="text-zinc-455 hover:text-rose-600 hover:bg-rose-50 size-7"
                              onClick={() => handleDeleteTransaction(t)}
                              title="Eliminar registro"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-16 text-zinc-500 space-y-2">
                  <Info className="size-8 text-zinc-330 mx-auto" />
                  <p className="text-sm font-bold text-zinc-700">No hay transacciones recurrentes registradas aún.</p>
                  <p className="text-xs text-zinc-450 max-w-sm mx-auto">
                    Los ingresos recurrentes automáticos se generan a partir de las plantillas activas de ingresos. 
                    {onNavigateToTab && " Haz clic en 'Gestionar Plantillas' para configurar tu salario o renta mensual."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert Panel for Pending Salaries/Incomes */}
          {pendingNotificationIncomes.length > 0 && (
            <Card className="bg-emerald-50 border-emerald-250/60 shadow-xs mb-4">
              <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-3">
                  <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 self-start text-emerald-700">
                    <CheckCircle className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">¿Llegó tu pago? Registros recurrentes pendientes</h4>
                    <p className="text-[11px] text-emerald-750 leading-relaxed max-w-2xl font-medium">
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8.5 rounded-lg flex-1 sm:flex-none justify-center px-3"
                      >
                        <Play className="mr-1.5 size-3 fill-current" /> Recibir {inc.name} (${inc.amount.toLocaleString()}){!inc.active && " (🔄)"}
                      </Button>
                      <Button 
                        onClick={() => handleMarkAsRegistered(inc)}
                        variant="outline"
                        size="sm" 
                        className="bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800 h-8.5 rounded-lg font-bold flex-1 sm:flex-none justify-center px-3 text-xs"
                      >
                        <Check className="size-3.5 mr-1 text-zinc-500" /> Ya Registrado
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Config Header and Trigger */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Repeat className="size-4.5 text-emerald-600" />
                Configuración de Ingresos Recurrentes (Sueldos, Rendas, etc.)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 leading-normal">
                Define tus salarios, honorarios o ingresos mensuales fijos. Guarda el valor para agilizar los depósitos mensuales en tus cuentas.
              </p>
            </div>
            <Button 
              onClick={handleOpenNewForm} 
              className="bg-zinc-950 hover:bg-zinc-850 text-white font-bold text-xs h-9 rounded-xl shrink-0"
            >
              <Plus className="mr-1 size-3.5" /> Configurar Nuevo
            </Button>
          </div>

          {/* Form drawer when open */}
          {isFormOpen && (
            <Card className="border-emerald-200 shadow-xs bg-emerald-50/5 p-4 rounded-xl">
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                  <div>
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                      {editingId ? '🛠️ Modificar Plantilla de Ingreso' : '✨ Nueva Configuración de Ingreso'}
                    </h4>
                    <p className="text-[10px] text-zinc-450 mt-1">
                      Establece el día aproximado y valor aproximado para registrar tu ingreso mensual con un solo click.
                    </p>
                  </div>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    className="size-7 rounded-full text-zinc-400 hover:text-rose-600 hover:bg-rose-50" 
                    onClick={() => setIsFormOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name" className="text-xs font-bold text-zinc-700">Nombre / Concepto</Label>
                    <Input 
                      id="tpl-name" 
                      placeholder="Ej. Salario Empresa SAS" 
                      className="h-9.5 text-xs rounded-lg"
                      value={templateFormData.name}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-amount" className="text-xs font-bold text-zinc-700">Monto ($)</Label>
                    <Input 
                      id="tpl-amount" 
                      type="number"
                      step="0.01"
                      placeholder="1,200,000" 
                      className="h-9.5 text-xs rounded-lg font-mono font-bold"
                      value={templateFormData.amount}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-frequency" className="text-xs font-bold text-zinc-700">Periodicidad / Frecuencia</Label>
                    <Select 
                      value={templateFormData.frequency} 
                      onValueChange={(v: any) => setTemplateFormData({ ...templateFormData, frequency: v })}
                    >
                      <SelectTrigger id="tpl-frequency" className="h-9.5 text-xs rounded-lg bg-white">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-day" className="text-xs font-bold text-zinc-700">Día de cobro aproximado</Label>
                    <Select 
                      value={templateFormData.dayOfMonth} 
                      onValueChange={(v) => setTemplateFormData({ ...templateFormData, dayOfMonth: v })}
                    >
                      <SelectTrigger id="tpl-day" className="h-9.5 text-xs rounded-lg">
                        <SelectValue placeholder="Seleccione día" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(day => (
                          <SelectItem key={day} value={day}>Día {day} del período</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {templateFormData.frequency !== 'mensual' && templateFormData.frequency !== 'quincenal' && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3.5 animate-fade-in">
                    <span className="text-xl">🗓️</span>
                    <div className="space-y-1 text-left flex-1">
                      <Label htmlFor="tpl-start-month" className="text-xs font-black text-indigo-950">🗓️ ¿En qué mes se recibe el primer cobro?</Label>
                      <p className="text-[10.5px] text-zinc-500">Para frecuencias especiales, necesitamos saber cuándo se inicia el ciclo para activar el aviso correctamente.</p>
                      <Select 
                        value={templateFormData.startMonth} 
                        onValueChange={(v) => setTemplateFormData({ ...templateFormData, startMonth: v })}
                      >
                        <SelectTrigger id="tpl-start-month" className="h-9 w-full sm:w-56 mt-1 text-xs rounded-lg bg-white border-indigo-200 text-indigo-900 font-bold select-none">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-account" className="text-xs font-bold text-zinc-700">Cuenta Destino por defecto</Label>
                    <Select 
                      value={templateFormData.accountId} 
                      onValueChange={(v) => setTemplateFormData({ ...templateFormData, accountId: v })}
                    >
                      <SelectTrigger id="tpl-account" className="h-9.5 text-xs rounded-lg">
                        <SelectValue placeholder="Cuentas disponibles" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name} (${(a.balance || 0).toLocaleString()})</SelectItem>
                        ))}
                        {accounts.length === 0 && <SelectItem value="_" disabled>Crea una cuenta primero</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-category" className="text-xs font-bold text-zinc-700">Categoría asociada</Label>
                    <Select 
                      value={templateFormData.categoryId} 
                      onValueChange={(v) => setTemplateFormData({ ...templateFormData, categoryId: v })}
                    >
                      <SelectTrigger id="tpl-category" className="h-9.5 text-xs rounded-lg">
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

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-description" className="text-xs font-bold text-zinc-700">Notas o Descripción opcional</Label>
                  <Input 
                    id="tpl-description" 
                    placeholder="Ej. Depósito quincenal de nómina" 
                    className="h-9.5 text-xs rounded-lg"
                    value={templateFormData.description}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTemplateFormData({ ...templateFormData, active: !templateFormData.active })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all border ${
                        templateFormData.active 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-550'
                      }`}
                    >
                      {templateFormData.active ? '● Activo' : '○ Pausado'}
                    </button>
                    <span className="text-[10px] text-zinc-455">Si está pausado, no arrojará alertas de cobro pendientes.</span>
                  </div>
                  <div className="flex justify-end gap-2.5">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="text-xs h-9"
                      onClick={() => setIsFormOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl"
                    >
                      Guardar Configuración
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurringTemplates.map((rt) => {
              const cat = categories.find(c => c.id === rt.categoryId);
              const acc = accounts.find(a => a.id === rt.accountId);
              const isAppliedThisMonth = rt.lastAppliedDate?.startsWith(format(new Date(), 'yyyy-MM'));

              return (
                <Card 
                  key={rt.id} 
                  className={`overflow-hidden transition-all border border-zinc-200 shadow-xs flex flex-col justify-between ${
                    !rt.active 
                      ? 'opacity-60 border-dashed border-zinc-200 bg-zinc-50/50' 
                      : 'hover:shadow-md bg-white'
                  }`}
                >
                  <CardHeader className="p-4 pb-2 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <Badge variant="outline" className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border-indigo-100 uppercase tracking-widest">
                          🔄 {rt.frequency || 'mensual'}{rt.startMonth ? ` (Ini: Mes ${rt.startMonth})` : ''} • Día {rt.dayOfMonth}
                        </Badge>
                        <h4 className="font-extrabold text-zinc-800 text-[13px] mt-1.5 leading-snug truncate max-w-[150px]">{rt.name}</h4>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 rounded-lg hover:bg-zinc-200/60"
                          onClick={() => handleOpenEdit(rt)}
                        >
                          <Edit3 className="size-3.5 text-zinc-650" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => handleDeleteTemplate(rt.id)}
                        >
                          <Trash2 className="size-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex flex-col justify-between flex-1 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-emerald-600 font-extrabold text-lg font-mono">
                          ${(rt.amount || 0).toLocaleString('es-ES')}
                        </span>
                        <button 
                          type="button"
                          onClick={() => handleToggleActive(rt)}
                          className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase transition-all tracking-wide ${
                            rt.active 
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-100' 
                              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          }`}
                        >
                          {rt.active ? 'Activo' : 'Pausado'}
                        </button>
                      </div>

                      {rt.description && (
                        <p className="text-zinc-500 text-[10px] leading-normal italic truncate">
                          {rt.description}
                        </p>
                      )}

                      <div className="flex flex-col gap-1 text-[10px] leading-relaxed pt-2 border-t border-dashed border-zinc-100 mt-2">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <CreditCard className="size-3 text-zinc-400" />
                          <span>Destino:</span>
                          <strong className="text-zinc-700 truncate">{acc?.name || '---'}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Clock className="size-3 text-zinc-400" />
                          <span>Último pago:</span>
                          <strong className="text-zinc-700 font-mono">
                            {rt.lastAppliedDate 
                              ? format(parseISO(rt.lastAppliedDate), 'dd/MM/yyyy') 
                              : 'Nunca registrado'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button
                        onClick={() => handleApplyIncome(rt)}
                        disabled={!rt.active}
                        size="sm"
                        className={`w-full text-xs font-black h-8 rounded-lg ${
                          isAppliedThisMonth 
                            ? 'bg-zinc-100 hover:bg-zinc-150 text-zinc-700' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
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

            {recurringTemplates.length === 0 && (
              <div className="col-span-full py-10 text-center rounded-xl border-2 border-dashed border-zinc-200 bg-white">
                <Repeat className="mx-auto mb-2 size-8 text-zinc-300 animate-pulse" />
                <h5 className="font-bold text-zinc-700 text-xs">No hay ingresos recurrentes configurados</h5>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                  Presiona "Configurar Nuevo" de arriba para definir tu primer ingreso frecuente o salario.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
                <span className="font-black uppercase text-indigo-700">{confirmingTemplate.frequency || 'mensual'}</span>
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
