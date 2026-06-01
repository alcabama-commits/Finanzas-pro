import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { dbService } from '@/src/lib/db';
import { auth } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { 
  Users, 
  Search, 
  UserCheck, 
  Activity, 
  Wallet, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft,
  DollarSign, 
  HandCoins, 
  PiggyBank, 
  ShoppingCart,
  Receipt,
  Mail,
  ShieldCheck,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

interface UserRecord {
  id: string; // auth.uid
  email?: string;
  displayName?: string;
  photoURL?: string;
  monthlyLimit?: number;
  billingCycle?: string;
  lastLogin?: string;
}

interface UserAuditingData {
  accounts: any[];
  transactions: any[];
  debts: any[];
  receivables: any[];
  saving_funds: any[];
  shopping_lists: any[];
}

export function SuperAdminView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Auditing / Inspection state
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [auditedData, setAuditedData] = useState<UserAuditingData | null>(null);
  const [loadingAuditee, setLoadingAuditee] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transactions' | 'accounts' | 'debts_receivables' | 'savings_shopping'>('summary');

  const ADMIN_EMAILS = ['camilomartg@gmail.com', 'imagina3ddesign@gmail.com'];
  const isSuperAdmin = auth.currentUser?.email ? ADMIN_EMAILS.includes(auth.currentUser.email) : false;

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoadingUsers(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const data = await dbService.listAllUsers();
        setUsers((data || []) as UserRecord[]);
      } catch (err) {
        toast.error('Error al cargar la nómina de usuarios del sistema');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [isSuperAdmin]);

  // Load user data upon selection
  const handleSelectUser = async (user: UserRecord) => {
    setSelectedUser(user);
    setLoadingAuditee(true);
    setAuditedData(null);
    setActiveSubTab('summary');
    try {
      const data = await dbService.getUserCollectionsData(user.id);
      if (data) {
        setAuditedData({
          accounts: data.accounts || [],
          transactions: data.transactions || [],
          debts: data.debts || [],
          receivables: data.receivables || [],
          saving_funds: data.saving_funds || [],
          shopping_lists: data.shopping_lists || []
        });
      }
    } catch (err) {
      toast.error('No se pudo acceder a las colecciones del usuario');
    } finally {
      setLoadingAuditee(false);
    }
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setAuditedData(null);
  };

  // Filter lists
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const name = (u.displayName || 'Anónimo').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = u.id.toLowerCase();
      const query = searchTerm.toLowerCase();
      return name.includes(query) || email.includes(query) || id.includes(query);
    });
  }, [users, searchTerm]);

  // Helpers
  const formatDateJoined = (isoString?: string) => {
    if (!isoString) return 'Nunca';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center" id="not-authorized-container">
        <ShieldCheck className="size-16 mx-auto text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-zinc-900">Acceso No Autorizado</h2>
        <p className="text-zinc-500 mt-2 max-w-md mx-auto">
          Esta pestaña de administración está restringida única y exclusivamente para la cuenta súper administradora del sistema (<strong className="text-zinc-800">camilomartg@gmail.com</strong>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="super-admin-view-root">
      
      {/* Dynamic Header */}
      {!selectedUser ? (
        <>
          <Card className="border border-zinc-200">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Consola de Súper Administrador</CardTitle>
                  <CardDescription>
                    Ovisión total reguladora y auditora de todos los usuarios registrados y de la información guardada en el sistema.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar usuario por nombre, dirección de correo o ID de Firebase..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-zinc-50 border-zinc-200 focus:bg-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users List Grid */}
          {loadingUsers ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-zinc-500">Cargando nómina de usuarios de la base de datos...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-zinc-200 text-zinc-500 col-span-full">
              <Users className="size-12 mx-auto text-zinc-300 mb-2" />
              <p className="font-semibold text-lg">No se hallaron usuarios coincidentes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((u) => (
                <Card key={u.id} className="hover:shadow-md transition-shadow border border-zinc-200 bg-white flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-zinc-900 text-white font-black flex items-center justify-center text-lg shadow-sm">
                        {u.displayName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-zinc-900 leading-tight truncate">{u.displayName || 'Usuario sin nombre'}</h4>
                        <p className="text-zinc-500 text-xs truncate flex items-center gap-1 mt-0.5">
                          <Mail className="size-3 text-zinc-400 shrink-0" />
                          <span>{u.email}</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 text-xs text-zinc-500 space-y-2 border-t border-zinc-100 pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-zinc-400">UID:</span>
                      <span className="font-mono text-[10px] text-zinc-600 truncate max-w-[150px]">{u.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-zinc-400">Límite Mensual:</span>
                      <span className="font-bold text-zinc-800">{u.monthlyLimit ? formatCurrency(u.monthlyLimit) : 'No configurado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-zinc-400">Ciclo Facturación:</span>
                      <Badge variant="outline" className="px-1 text-[10px] bg-zinc-50 font-semibold">{u.billingCycle ? `Día ${u.billingCycle}` : 'N/A'}</Badge>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-zinc-50">
                      <span className="font-medium text-zinc-400">Última Conexión:</span>
                      <span className="text-zinc-600 truncate">{u.lastLogin ? formatDateJoined(u.lastLogin) : 'N/A'}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pb-4 pt-3">
                    <Button onClick={() => handleSelectUser(u)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm flex items-center justify-center gap-1.5 text-xs py-2">
                      <Activity className="size-3.5" />
                      Auditar Información Registrada
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* AUDITING SCREEN (INDIVIDUAL REGISTRIES INSPECTOR) */
        <div className="space-y-6">
          <Button onClick={handleBackToList} variant="outline" className="text-zinc-600 border-zinc-300">
            <ArrowLeft className="size-4 mr-1.5" />
            Volver a la nómina de usuarios
          </Button>

          {/* User badge row */}
          <Card className="border border-zinc-200">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-full bg-zinc-900 text-white font-black text-2xl flex items-center justify-center shadow-lg">
                    {selectedUser.displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight">{selectedUser.displayName || 'Anónimo'}</h3>
                      <Badge className="bg-red-50 text-red-700 border-red-200 font-bold text-[10px]">Expediente auditado</Badge>
                    </div>
                    <p className="text-zinc-500 text-sm mt-0.5">{selectedUser.email}</p>
                    <p className="text-zinc-400 text-xs mt-1">ID Fiscal Firebase: <span className="font-mono">{selectedUser.id}</span></p>
                  </div>
                </div>
                
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 text-right sm:min-w-[200px]">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Límite financiero</span>
                  <span className="text-2xl font-black text-zinc-950 block mt-1">
                    {selectedUser.monthlyLimit ? formatCurrency(selectedUser.monthlyLimit) : '$0'}
                  </span>
                  <span className="text-xs text-zinc-500">Ciclo: corte día {selectedUser.billingCycle || '15'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auditor Sub-Tabs Trigger */}
          <div className="flex flex-wrap border-b border-zinc-200 gap-1.5">
            <TabTrigger label="Resumen de Cuentas" active={activeSubTab === 'summary'} onClick={() => setActiveSubTab('summary')} />
            <TabTrigger label="Transacciones" active={activeSubTab === 'transactions'} onClick={() => setActiveSubTab('transactions')} />
            <TabTrigger label="Cuentas Bancarias" active={activeSubTab === 'accounts'} onClick={() => setActiveSubTab('accounts')} />
            <TabTrigger label="Deudas & Cobrables" active={activeSubTab === 'debts_receivables'} onClick={() => setActiveSubTab('debts_receivables')} />
            <TabTrigger label="Ahorros & Compras" active={activeSubTab === 'savings_shopping'} onClick={() => setActiveSubTab('savings_shopping')} />
          </div>

          {/* Loading data message */}
          {loadingAuditee && (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-zinc-500">Extrayendo información de las colecciones en Firebase...</p>
            </div>
          )}

          {/* AUDITED SUMMARY TAB */}
          {!loadingAuditee && auditedData && (
            <div className="grid grid-cols-1 gap-6">
              
              {activeSubTab === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Stats Cards */}
                  <Card className="border border-zinc-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Activo total en cuentas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold flex items-center">
                        <Wallet className="size-5 mr-1 text-indigo-500" />
                        {formatCurrency(auditedData.accounts.reduce((sum, a) => sum + (a.balance || 0), 0))}
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">{auditedData.accounts.length} cuentas registradas</p>
                    </CardContent>
                  </Card>

                  <Card className="border border-zinc-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-zinc-500 text-xs font-bold uppercase tracking-wider font-medium">Deuda total pendiente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold flex items-center text-red-600">
                        <HandCoins className="size-5 mr-1" />
                        {formatCurrency(auditedData.debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0))}
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">{auditedData.debts.length} compromisos registrados</p>
                    </CardContent>
                  </Card>

                  <Card className="border border-zinc-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-zinc-500 text-xs font-bold uppercase tracking-wider font-medium">Cobrables (Préstamos/Bienes)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold flex items-center text-teal-600">
                        <HandCoins className="size-5 mr-1" />
                        {formatCurrency(auditedData.receivables.reduce((sum, r) => sum + (r.remainingAmount || 0), 0))}
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">{auditedData.receivables.length} cuentas por cobrar registradas</p>
                    </CardContent>
                  </Card>

                  {/* Summary lists widget */}
                  <Card className="md:col-span-3 border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="font-bold flex items-center gap-2">
                        <Activity className="size-5 text-indigo-500" />
                        Diagnóstico rápido del usuario
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150">
                          <h4 className="font-black text-sm text-zinc-800 mb-3 uppercase tracking-wider">Últimas 5 Transacciones</h4>
                          {auditedData.transactions.length === 0 ? (
                            <p className="text-xs text-zinc-500 font-medium italic">No se registran transacciones</p>
                          ) : (
                            <div className="space-y-2">
                              {auditedData.transactions.slice(0, 5).map((t, idx) => (
                                <div key={t.id || idx} className="flex justify-between text-xs py-1.5 border-b border-zinc-200/50">
                                  <div>
                                    <span className="font-medium text-zinc-800">{t.description || 'Sin descripción'}</span>
                                    <span className="block text-[10px] text-zinc-400">{t.date}</span>
                                  </div>
                                  <span className={`font-bold ${
                                    t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                                  }`}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150">
                          <h4 className="font-black text-sm text-zinc-800 mb-3 uppercase tracking-wider">Metas y Fondos de Ahorro</h4>
                          {auditedData.saving_funds.length === 0 ? (
                            <p className="text-xs text-zinc-500 font-medium italic">No se registran fondos de ahorro</p>
                          ) : (
                            <div className="space-y-3">
                              {auditedData.saving_funds.map((f, idx) => (
                                <div key={f.id || idx} className="text-xs space-y-1">
                                  <div className="flex justify-between font-medium">
                                    <span className="text-zinc-800 font-bold">{f.name}</span>
                                    <span className="text-zinc-500">{formatCurrency(f.currentAmount)} / {formatCurrency(f.targetAmount)}</span>
                                  </div>
                                  <div className="w-full bg-zinc-200 rounded-full h-2">
                                    <div 
                                      className="h-2 rounded-full" 
                                      style={{ 
                                        backgroundColor: f.color || '#4f46e5',
                                        width: `${Math.min(100, (f.currentAmount / (f.targetAmount || 1)) * 100)}%` 
                                      }} 
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TRANSACTIONS TAB */}
              {activeSubTab === 'transactions' && (
                <Card className="border border-zinc-200">
                  <CardHeader>
                    <CardTitle className="font-bold flex items-center gap-1.5">
                      <Receipt className="size-5 text-indigo-500" />
                      Historial Auditado de Transacciones ({auditedData.transactions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditedData.transactions.length === 0 ? (
                      <p className="text-center text-zinc-500 italic py-8">No se registran transacciones para este usuario.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 text-zinc-400 text-left font-medium">
                              <th className="py-2.5">Detalle / Concepto</th>
                              <th className="py-2.5">Tipo</th>
                              <th className="py-2.5">Fecha</th>
                              <th className="py-2.5 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditedData.transactions.map((t, idx) => (
                              <tr key={t.id || idx} className="border-b border-zinc-100 hover:bg-zinc-50 font-medium">
                                <td className="py-3 text-zinc-900 font-bold">{t.description || 'S/D'}</td>
                                <td className="py-3">
                                  <Badge className={
                                    t.type === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    t.type === 'expense' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                    'bg-violet-50 text-violet-700 border-violet-100'
                                  }>
                                    {t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Compra'}
                                  </Badge>
                                </td>
                                <td className="py-3 text-zinc-500 text-xs">{t.date}</td>
                                <td className="py-3 text-right font-black">
                                  {formatCurrency(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ACCOUNTS TAB */}
              {activeSubTab === 'accounts' && (
                <Card className="border border-zinc-200">
                  <CardHeader>
                    <CardTitle className="font-bold flex items-center gap-1.5">
                      <Wallet className="size-5 text-indigo-500" />
                      Monitoreo de Cuentas Financieras ({auditedData.accounts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditedData.accounts.length === 0 ? (
                      <p className="text-center text-zinc-500 italic py-8">Ninguna cuenta bancaria configurada.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {auditedData.accounts.map((acc, idx) => (
                          <div key={acc.id || idx} className="p-4 border border-zinc-200 rounded-xl bg-white shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="h-4 w-4 rounded-full block shrink-0" style={{ backgroundColor: acc.color || '#18181b' }} />
                              <div>
                                <h4 className="font-bold text-zinc-900 leading-none">{acc.name}</h4>
                                <span className="text-[10px] text-zinc-400 block mt-1">ID: {acc.id}</span>
                              </div>
                            </div>
                            <span className="font-black text-md text-zinc-950">
                              {formatCurrency(acc.balance)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* DEBTS & RECEIVABLES TAB */}
              {activeSubTab === 'debts_receivables' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Debts list */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-red-700 uppercase tracking-wider block">Deudas e Hipotecas Pendientes ({auditedData.debts.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {auditedData.debts.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No se registran deudas pendientes.</p>
                      ) : (
                        auditedData.debts.map((d, id) => (
                          <div key={d.id || id} className="p-3 border border-zinc-150 rounded-lg bg-zinc-50/50">
                            <div className="flex justify-between font-bold text-xs">
                              <span className="text-zinc-800">{d.name} ({d.creditor})</span>
                              <span className="text-red-700">{formatCurrency(d.remainingAmount)} / {formatCurrency(d.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                              <span>Mínimo pagar: {formatCurrency(d.minimumPayment)}</span>
                              <span>Estado: {d.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Receivables list */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-teal-700 uppercase tracking-wider block">Carpeta de Cobros y Préstamos ({auditedData.receivables.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {auditedData.receivables.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No se registran facturas ni préstamos por cobrar.</p>
                      ) : (
                        auditedData.receivables.map((r, id) => (
                          <div key={r.id || id} className="p-3 border border-zinc-150 rounded-lg bg-zinc-50/50">
                            <div className="flex justify-between font-bold text-xs">
                              <div>
                                <span className="text-zinc-800 block">{r.name} ({r.debtor})</span>
                                {r.type === 'work' && (
                                  <Badge className="text-[8px] px-1 py-0 bg-indigo-50 text-indigo-700 border-indigo-200 font-bold mt-1">
                                    Trabajo / Cuenta de cobro {r.invoiceSubmitted ? '(Pasada)' : '(¡No pasada!)'}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-teal-700">{formatCurrency(r.remainingAmount)} / {formatCurrency(r.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-400 mt-2 pt-1.5 border-t border-zinc-100">
                              <span>Tipo: {r.type === 'work' ? 'Trabajo Realizado' : 'Préstamo Directo'}</span>
                              <span>Estado: {r.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                </div>
              )}

              {/* SAVINGS & SHOPPING TAB */}
              {activeSubTab === 'savings_shopping' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Savings list */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-sans font-bold text-emerald-800 uppercase block tracking-wider">Ahorros Programados ({auditedData.saving_funds.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {auditedData.saving_funds.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No se registran fondos.</p>
                      ) : (
                        auditedData.saving_funds.map((sf, index) => (
                          <div key={sf.id || index} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-zinc-800">
                              <span>{sf.name}</span>
                              <span>{formatCurrency(sf.currentAmount)} / {formatCurrency(sf.targetAmount)}</span>
                            </div>
                            <div className="w-full bg-zinc-200 rounded-full h-2">
                              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (sf.currentAmount / sf.targetAmount) * 100)}%` }} />
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Shopping list */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-sans font-bold text-pink-800 uppercase block tracking-wider">Comercio, Listas y Canastas ({auditedData.shopping_lists.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {auditedData.shopping_lists.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No se registran listas de compras domésticas.</p>
                      ) : (
                        auditedData.shopping_lists.map((sl, index) => (
                          <div key={sl.id || index} className="p-3 border border-zinc-150 rounded-lg bg-zinc-50/50">
                            <div className="flex justify-between font-bold text-xs text-zinc-800">
                              <span>{sl.name}</span>
                              <Badge variant="outline" className={
                                sl.status === 'completed' ? 'bg-emerald-50 text-emerald-700 text-[9px] font-bold' : 'bg-amber-50 text-amber-700 text-[9px] font-bold'
                              }>
                                {sl.status === 'completed' ? 'Completado' : 'Pendiente'}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-2">
                              Cantidad de ítems: {sl.items?.length || 0}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}

function TabTrigger({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 transition-all ${
        active 
          ? 'border-indigo-600 text-indigo-600 font-bold' 
          : 'border-transparent text-zinc-500 hover:text-zinc-800'
      }`}
    >
      {label}
    </button>
  );
}
