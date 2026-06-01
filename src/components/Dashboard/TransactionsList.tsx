import React, { useState, useEffect } from 'react';
import { Transaction, Account, Category, Debt } from '@/src/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, TrendingUp, TrendingDown, MoreVertical, AlertTriangle } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';

interface TransactionsListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  filterType?: 'income' | 'expense' | 'purchase';
}

export function TransactionsList({ transactions, accounts, categories, filterType }: TransactionsListProps) {
  const [debts, setDebts] = useState<Debt[]>([]);

  // Subscribe to debts to render details and allow correct delete balance revert
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('debts', setDebts);
    return () => unsub();
  }, []);

  const filtered = filterType 
    ? transactions.filter(t => t.type === filterType) 
    : transactions;

  const sortedTransactions = [...filtered].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleDelete = async (t: Transaction) => {
    try {
      // 1. Delete transaction
      await dbService.deleteItem('transactions', t.id);
      
      // 2. Revert account or debt balance
      if (t.paidWithDebt && t.debtId) {
        const debtObj = debts.find(d => d.id === t.debtId);
        if (debtObj) {
          const currentRemaining = Number(debtObj.remainingAmount) || 0;
          await dbService.updateItem('debts', debtObj.id, {
            remainingAmount: Math.max(0, currentRemaining - Number(t.amount))
          });
          toast.warning('⚠️ Revertido el cargo de la deuda asignada.');
        }
      } else {
        const account = accounts.find(a => a.id === t.accountId);
        if (account) {
          const currentBalance = Number(account.balance) || 0;
          const balanceChange = t.type === 'income' ? -Number(t.amount) : Number(t.amount);
          await dbService.updateItem('accounts', account.id, {
            balance: currentBalance + balanceChange
          });
        }
      }
      toast.success('Transacción eliminada');
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const getTitle = () => {
    if (filterType === 'income') return 'Registro de Ingresos (Activos)';
    if (filterType === 'expense') return 'Registro de Pagos (Pasivos / Obligaciones)';
    if (filterType === 'purchase') return 'Registro de Compras (Pasivos)';
    return 'Historial Detallado';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedTransactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Origen / Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((t) => {
                const category = categories.find(c => c.id === t.categoryId);
                const account = accounts.find(a => a.id === t.accountId);
                const debt = t.paidWithDebt ? debts.find(d => d.id === t.debtId) : null;
                
                return (
                  <TableRow 
                    key={t.id}
                    className={t.paidWithDebt ? "bg-red-50/60 hover:bg-red-100/50 transition-all border-l-4 border-l-rose-500" : ""}
                  >
                    <TableCell className="font-medium text-xs">
                      {format(new Date(t.date), 'dd MMM, yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`font-semibold ${t.paidWithDebt ? "text-rose-950 font-black" : "text-zinc-905"}`}>
                          {t.type === 'income' && t.isEventual && t.concept 
                            ? `${t.concept} ${t.description ? `(${t.description})` : ''}`
                            : t.description || 'Sin descripción'
                          }
                        </span>
                        
                        {t.paidWithDebt && (
                          <div className="text-[10px] text-rose-700 bg-rose-100/70 border border-rose-200 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 mt-1">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="size-3.5 text-rose-650 shrink-0" />
                              ⚠️ PAGADO CON DEUDA
                            </span>
                            <span className="text-[9.5px] font-medium text-rose-600 leading-snug">
                              Esta compra con deuda te aleja de tu libertad financiera. ¡Págalo pronto!
                            </span>
                          </div>
                        )}

                        {t.type === 'income' && t.isEventual && t.payerOrEntity && (
                          <div className="text-[10px] text-amber-800 font-black flex items-center gap-1">
                            <span>Pagador:</span>
                            <span className="bg-amber-100/60 px-1 py-0.5 rounded border border-amber-200/50">{t.payerOrEntity}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {category?.isAutoDebit && (
                            <span className="text-[9px] text-rose-600 font-extrabold uppercase tracking-tight bg-rose-50 border border-rose-200/80 px-1 py-0.5 rounded leading-none flex items-center gap-0.5">
                              🔄 Débito Automático
                            </span>
                          )}
                          {category?.isNoCost && (
                            <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-tight bg-indigo-50 border border-indigo-200/80 px-1 py-0.5 rounded leading-none flex items-center gap-0.5">
                              🎁 Incluido / $0
                            </span>
                          )}
                          {(t.isEventual || category?.isEventual) && (
                            <span className="text-[9px] text-amber-600 font-extrabold uppercase tracking-tight bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded leading-none flex items-center gap-0.5">
                              📅 Eventual
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className="font-normal flex items-center gap-1 w-max"
                        style={{ 
                          backgroundColor: category?.color ? `${category.color}15` : undefined, 
                          color: category?.color,
                          borderColor: category?.color ? `${category.color}30` : undefined
                        }}
                      >
                        {category?.name || 'Desconocida'}
                        {t.subcategory && (
                          <span className="text-[10px] font-bold opacity-80 border-l border-current pl-1 ml-1">
                            {t.subcategory}
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className={t.paidWithDebt ? "text-rose-700 font-bold text-xs" : "text-zinc-500 text-sm"}>
                      {t.paidWithDebt ? (
                        <span className="flex items-center gap-1">💳 {debt ? debt.name : 'Deuda Externa'}</span>
                      ) : (
                        account?.name || '---'
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${
                      category?.isNoCost 
                        ? 'text-indigo-600'
                        : t.type === 'income' 
                        ? 'text-emerald-600' 
                        : t.type === 'purchase'
                        ? 'text-blue-600'
                        : t.paidWithDebt
                        ? 'text-rose-700 font-black'
                        : 'text-rose-600'
                    }`}>
                      {category?.isNoCost ? 'Incluido' : `${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString()}`}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-8" />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                            onClick={() => handleDelete(t)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            No hay transacciones registradas aún.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
