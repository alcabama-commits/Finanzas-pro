import React, { useState, useEffect } from 'react';
import { Account, SavingFund } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Wallet, Trash2, Edit3, X, CreditCard, Banknote, PiggyBank, CircleEqual } from 'lucide-react';
import { dbService } from '@/src/lib/db';
import { toast } from 'sonner';

interface AccountsListProps {
  accounts: Account[];
}

export function AccountsList({ accounts }: AccountsListProps) {
  const [adding, setAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', balance: '' });
  const [savingFunds, setSavingFunds] = useState<SavingFund[]>([]);

  // Subscribe to saving funds to identify portions of money saved in this account
  useEffect(() => {
    const unsub = dbService.subscribeToCollection('saving_funds', setSavingFunds);
    return () => unsub();
  }, []);

  // States for Editing Account Balance / Name
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({ name: '', balance: '' });

  const handleAdd = async () => {
    if (!newAccount.name || !newAccount.balance) {
      toast.error('Completa todos los campos');
      return;
    }
    try {
      await dbService.addItem('accounts', {
        name: newAccount.name.trim(),
        balance: parseFloat(newAccount.balance) || 0,
        color: '#18181b', // Default black
        icon: 'wallet'
      });
      setAdding(false);
      setNewAccount({ name: '', balance: '' });
      toast.success('Cuenta creada con éxito');
    } catch (e) {
      toast.error('Error al crear la cuenta');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la cuenta "${name}"? Las transacciones asociadas no se borrarán pero perderán el balance.`)) return;
    try {
      await dbService.deleteItem('accounts', id);
      toast.success('Cuenta eliminada');
    } catch (e) {
      toast.error('No se pudo eliminar la cuenta');
    }
  };

  const handleOpenEdit = (account: Account) => {
    setEditingAcc(account);
    setEditForm({
      name: account.name,
      balance: String(account.balance)
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcc) return;
    if (!editForm.name.trim()) {
      toast.error('El nombre de la cuenta no puede estar vacío');
      return;
    }

    try {
      await dbService.updateItem('accounts', editingAcc.id, {
        name: editForm.name.trim(),
        balance: parseFloat(editForm.balance) || 0
      });
      toast.success('Cuenta y saldo actualizados correctamente');
      setEditingAcc(null);
    } catch (e) {
      toast.error('Error al actualizar la cuenta');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">Mis Cuentas y Activos</h3>
          <p className="text-xs text-zinc-500">Administra tus métodos de pago y ajusta sus saldos manualmente.</p>
        </div>
        <Button onClick={() => setAdding(!adding)} variant={adding ? "outline" : "default"} className="h-9.5 text-xs font-semibold">
          {adding ? 'Cancelar' : <><Plus className="mr-2 size-4" /> Nueva Cuenta</>}
        </Button>
      </div>

      {adding && (
        <Card className="border-zinc-900 border-2 shadow-lg animate-fade-in bg-white">
          <CardHeader className="pb-3 border-b border-zinc-50">
            <CardTitle className="text-sm font-bold text-zinc-800">Agregar Nueva Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 pb-4">
            <div className="space-y-1.5 animate-slide-in">
              <Label htmlFor="accountName">Nombre de la cuenta</Label>
              <Input 
                id="accountName"
                placeholder="Ej. Efectivo, Bancolombia, Caja Social, etc." 
                value={newAccount.name}
                onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                className="h-9.5 text-xs bg-zinc-50 border-zinc-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="initialBalance">Saldo Inicial ($)</Label>
              <Input 
                id="initialBalance"
                type="number" 
                placeholder="0.00" 
                value={newAccount.balance}
                onChange={e => setNewAccount({...newAccount, balance: e.target.value})}
                className="h-9.5 text-xs bg-zinc-50 border-zinc-200"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t border-zinc-50 py-3 bg-zinc-50/50 rounded-b-xl">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-xs font-medium text-zinc-550 h-8">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold h-8 px-4.5">
              Confirmar Cuenta
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(account => {
          const accountFunds = savingFunds.filter(f => f.accountId === account.id);
          const totalSaved = accountFunds.reduce((sum, f) => sum + (f.currentAmount || 0), 0);
          const availableBalance = Math.max(0, (Number(account.balance) || 0) - totalSaved);

          return (
            <Card key={account.id} className="group hover:shadow-md transition-all border border-zinc-200 bg-white relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-zinc-100 p-3 rounded-xl group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <Wallet className="size-6 text-zinc-500 group-hover:text-white" />
                  </div>
                  
                  {/* Actions row: persistent layout, touch friendly */}
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      onClick={() => handleOpenEdit(account)}
                      title="Editar cuenta / saldo"
                    >
                      <Edit3 className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                      onClick={() => handleDelete(account.id, account.name)}
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-lg text-zinc-800 leading-snug">{account.name}</h4>
                    <span className="text-[10px] text-zinc-400 font-medium uppercase font-sans tracking-wide">Desglose de Fondos</span>
                  </div>

                  {/* Financial distinction requested: savings fund are separate from available money */}
                  <div className="space-y-1.5 pt-1 border-t border-zinc-50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 flex items-center gap-1">🏦 Saldo Total en Banco:</span>
                      <strong className="text-zinc-800 font-mono font-bold">${(Number(account.balance) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>

                    {totalSaved > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-600">
                        <span className="flex items-center gap-1">🎯 Reservado en Fondos:</span>
                        <strong className="font-mono font-bold">-${totalSaved.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-zinc-10 border-zinc-200">
                      <span className="text-xs font-bold text-zinc-900">💵 Dinero DISPONIBLE:</span>
                      <strong className="text-lg font-black text-emerald-600 font-mono">
                        ${availableBalance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {accountFunds.length > 0 && (
                    <div className="mt-2 text-[10px] bg-amber-50/50 border border-amber-100 rounded-lg p-2 space-y-1">
                      <span className="font-bold text-amber-805 block">Fondos alojados aquí:</span>
                      {accountFunds.map(f => (
                        <div key={f.id} className="flex justify-between text-zinc-650">
                          <span className="truncate pr-2">📌 {f.name}</span>
                          <span className="font-mono font-bold shrink-0">${(f.currentAmount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {accounts.length === 0 && !adding && (
          <div className="col-span-full py-12 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-500 font-medium text-sm">
            No tienes ninguna cuenta registrada. Agrega una cuenta para empezar a registrar fondos e ingresos.
          </div>
        )}
      </div>

      {/* Account Edit Modal Popover */}
      {editingAcc && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <Card className="w-full max-w-sm border-none shadow-2xl bg-white relative animate-fade-in">
            <button 
              type="button"
              className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 rounded-full text-zinc-450 hover:text-zinc-700 transition"
              onClick={() => setEditingAcc(null)}
            >
              <X className="size-4" />
            </button>
            <CardHeader className="pb-3 border-b border-zinc-100">
              <CardTitle className="text-base font-bold text-zinc-900">Editar Cuenta / Saldo Directo</CardTitle>
            </CardHeader>

            <form onSubmit={handleSaveEdit}>
              <CardContent className="space-y-4 pt-4 pb-4 select-none">
                <div className="space-y-1.5">
                  <Label htmlFor="editAccName">Nombre de la Cuenta</Label>
                  <Input 
                    id="editAccName"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-10 text-xs text-zinc-900 font-medium bg-zinc-50 border-zinc-200 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editAccBalance">Modificar Saldo / Ingresar Efectivo ($)</Label>
                  <Input 
                    id="editAccBalance"
                    type="number"
                    step="0.01"
                    value={editForm.balance}
                    onChange={e => setEditForm({ ...editForm, balance: e.target.value })}
                    className="h-10 text-xs font-bold text-zinc-900 font-mono bg-zinc-50 border-zinc-200 focus:bg-white text-emerald-700"
                  />
                  <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                    Puedes ajustar el saldo para añadir o descontar dinero directamente. Esto calculará el total disponible de inmediato.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="py-3 bg-zinc-50 border-t border-zinc-150 flex items-center justify-end gap-2 rounded-b-xl">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingAcc(null)}
                  className="text-xs h-8 h-8 font-medium border-zinc-250 text-zinc-650"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-8"
                >
                  Actualizar Saldo
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
