import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '@/src/lib/db';
import { Transaction, Account, Category, UserSettings } from '@/src/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Settings as SettingsIcon, 
  History, 
  LayoutDashboard,
  LogOut,
  Bell,
  ShoppingBag,
  Tag,
  Package,
  PiggyBank,
  ShoppingCart,
  Repeat,
  HandCoins,
  Store,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { Overview } from './Dashboard/Overview';
import { TransactionsList } from './Dashboard/TransactionsList';
import { AccountsList } from './Dashboard/AccountsList';
import { CategoriesList } from './Dashboard/CategoriesList';
import { Settings } from './Dashboard/Settings';
import { AddTransactionDialog } from './Dashboard/AddTransactionDialog';
import { InventoryView } from './Dashboard/InventoryView';
import { SavingsView } from './Dashboard/SavingsView';
import { MarketView } from './Dashboard/MarketView';
import { RecurringIncomesView } from './Dashboard/RecurringIncomesView';
import { IncomesTrackerView } from './Dashboard/IncomesTrackerView';
import { DebtsView } from './Dashboard/DebtsView';
import { ReceivablesView } from './Dashboard/ReceivablesView';
import { CatalogView } from './Dashboard/CatalogView';
import { SuperAdminView } from './Dashboard/SuperAdminView';
import { FixedAssetsView } from './Dashboard/FixedAssetsView';
import { PaymentsView } from './Dashboard/PaymentsView';
import { TripsView } from './Dashboard/TripsView';
import { Plane } from 'lucide-react';

export function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Initial fetch of user settings
    dbService.getUser().then(data => {
      if (data) setSettings(data as UserSettings);
      else {
        // Default settings if none exist
        const defaultSettings: UserSettings = { monthlyLimit: 1000, billingCycle: '30' };
        dbService.setUser(defaultSettings);
        setSettings(defaultSettings);
      }
    });

    // Subscriptions
    const unsubTransactions = dbService.subscribeToCollection('transactions', setTransactions);
    const unsubCategories = dbService.subscribeToCollection('categories', (data) => {
      setCategories(data);
      if (data.length === 0) {
        // Seed some default categories
        const defaults = [
          // Income
          { name: 'Sueldo', type: 'income', color: '#10b981', icon: 'banknote', subcategories: [] },
          
          // Gastos (from Pagos presets)
          { name: 'Arriendo', type: 'expense', color: '#6366f1', icon: 'building-2', subcategories: [] },
          { name: 'Servicios', type: 'expense', color: '#f59e0b', icon: 'receipt', subcategories: [] },
          { name: 'Internet', type: 'expense', color: '#0ea5e9', icon: 'wifi', subcategories: [] },
          { name: 'Suscripciones', type: 'expense', color: '#ec4899', icon: 'play', subcategories: [] },
          { name: 'Tarjetas', type: 'expense', color: '#10b981', icon: 'credit-card', subcategories: [] },
          { name: 'Salud', type: 'expense', color: '#ef4444', icon: 'heart', subcategories: [] },
          { name: 'Educación', type: 'expense', color: '#a855f7', icon: 'book-open', subcategories: [] },
          { name: 'Otros', type: 'expense', color: '#71717a', icon: 'help-circle', subcategories: [] },

          // Compras
          { name: 'Comida', type: 'purchase', color: '#f97316', icon: 'utensils', subcategories: [] },
          { name: 'Mercado', type: 'purchase', color: '#ec4899', icon: 'shopping-cart', subcategories: [] },
          { name: 'Transporte', type: 'purchase', color: '#3b82f6', icon: 'car', subcategories: [] }
        ];
        defaults.forEach(d => dbService.addItem('categories', d));
      } else {
        // Safe check to see if we should run the Pagos and Compras alignment migration
        const migrationKey = 'has_aligned_categories_v4_pagos_compras';
        if (!localStorage.getItem(migrationKey)) {
          const targetExpenseCategories = [
            { name: 'Arriendo', color: '#6366f1', icon: 'building-2' },
            { name: 'Servicios', color: '#f59e0b', icon: 'receipt' },
            { name: 'Internet', color: '#0ea5e9', icon: 'wifi' },
            { name: 'Suscripciones', color: '#ec4899', icon: 'play' },
            { name: 'Tarjetas', color: '#10b981', icon: 'credit-card' },
            { name: 'Salud', color: '#ef4444', icon: 'heart' },
            { name: 'Educación', color: '#a855f7', icon: 'book-open' },
            { name: 'Otros', color: '#71717a', icon: 'help-circle' }
          ];

          const targetPurchaseCategories = [
            { name: 'Comida', color: '#f97316', icon: 'utensils' },
            { name: 'Mercado', color: '#ec4899', icon: 'shopping-cart' },
            { name: 'Transporte', color: '#3b82f6', icon: 'car' }
          ];

          const promises: Promise<any>[] = [];

          data.forEach(cat => {
            const nameLower = cat.name.toLowerCase();
            if (cat.type === 'expense') {
              if (nameLower === 'transporte') {
                promises.push(dbService.updateItem('categories', cat.id, { type: 'purchase', color: '#3b82f6', icon: 'car' }));
              } else if (nameLower === 'comida') {
                promises.push(dbService.updateItem('categories', cat.id, { type: 'purchase', color: '#f97316', icon: 'utensils' }));
              } else if (nameLower === 'ocio') {
                promises.push(dbService.deleteItem('categories', cat.id));
              }
            }
          });

          targetExpenseCategories.forEach(target => {
            const alreadyExists = data.some(cat => cat.name.toLowerCase() === target.name.toLowerCase() && cat.type === 'expense');
            if (!alreadyExists) {
              promises.push(dbService.addItem('categories', {
                name: target.name,
                type: 'expense',
                color: target.color,
                icon: target.icon,
                subcategories: []
              }));
            }
          });

          targetPurchaseCategories.forEach(target => {
            const alreadyExists = data.some(cat => cat.name.toLowerCase() === target.name.toLowerCase() && cat.type === 'purchase');
            if (!alreadyExists) {
              promises.push(dbService.addItem('categories', {
                name: target.name,
                type: 'purchase',
                color: target.color,
                icon: target.icon,
                subcategories: []
              }));
            }
          });

          Promise.all(promises).then(() => {
            localStorage.setItem(migrationKey, 'true');
          }).catch(err => console.error('Migration failed:', err));
        }
      }
    });

    const unsubAccounts = dbService.subscribeToCollection('accounts', (data) => {
      setAccounts(data);
      if (data.length === 0) {
        dbService.addItem('accounts', { name: 'Efectivo', balance: 0, color: '#18181b', icon: 'wallet' });
      }
    });

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200 p-6 flex flex-col gap-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 text-white p-2 rounded-lg">
            <Wallet className="size-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">Finanza Pro</span>
        </div>

        <nav className="flex flex-col gap-5 flex-grow">
          {/* General Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block">General</span>
            <NavItem 
              active={activeTab === 'overview'} 
              onClick={() => setActiveTab('overview')}
              icon={<LayoutDashboard className="size-4" />}
              label="Resumen"
            />
            <NavItem 
              active={activeTab === 'transactions'} 
              onClick={() => setActiveTab('transactions')}
              icon={<History className="size-4" />}
              label="Transacciones"
            />
          </div>

          {/* Activos Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block">Activos</span>
            <NavItem 
              active={activeTab === 'income'} 
              onClick={() => setActiveTab('income')}
              icon={<TrendingUp className="text-emerald-500 size-4" />}
              label="Ingresos"
            />
            <NavItem 
              active={activeTab === 'accounts'} 
              onClick={() => setActiveTab('accounts')}
              icon={<Wallet className="text-blue-500 size-4" />}
              label="Cuentas"
            />
            <NavItem 
              active={activeTab === 'savings'} 
              onClick={() => setActiveTab('savings')}
              icon={<PiggyBank className="text-emerald-500 size-4" />}
              label="Ahorros y Fondos"
            />
            <NavItem 
              active={activeTab === 'receivables'} 
              onClick={() => setActiveTab('receivables')}
              icon={<HandCoins className="text-teal-500 size-4" />}
              label="Cuentas por Cobrar"
            />
            <NavItem 
              active={activeTab === 'inventory'} 
              onClick={() => setActiveTab('inventory')}
              icon={<Package className="text-indigo-500 size-4" />}
              label="Inventario"
            />
            <NavItem 
              active={activeTab === 'fixed_assets'} 
              onClick={() => setActiveTab('fixed_assets')}
              icon={<Sparkles className="text-amber-500 size-4 animate-pulse" />}
              label="Activos Fijos"
            />
          </div>

          {/* Pasivos Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block">Pasivos</span>
            <NavItem 
              active={activeTab === 'debts'} 
              onClick={() => setActiveTab('debts')}
              icon={<HandCoins className="text-red-500 size-4" />}
              label="Deudas y Pasivos"
            />
            <NavItem 
              active={activeTab === 'expense'} 
              onClick={() => setActiveTab('expense')}
              icon={<TrendingDown className="text-rose-500 size-4" />}
              label="Pagos"
            />
            <NavItem 
              active={activeTab === 'trips'} 
              onClick={() => setActiveTab('trips')}
              icon={<Plane className="text-sky-500 size-4 rotate-45" />}
              label="Viajes"
            />
            <NavItem 
              active={activeTab === 'purchase'} 
              onClick={() => setActiveTab('purchase')}
              icon={<ShoppingBag className="text-violet-500 size-4" />}
              label="Compras Eventuales"
            />
            <NavItem 
              active={activeTab === 'market'} 
              onClick={() => setActiveTab('market')}
              icon={<ShoppingCart className="text-pink-500 size-4" />}
              label="Canasta y Listas"
            />
          </div>

          {/* Compartido Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block">Compartido</span>
            <NavItem 
              active={activeTab === 'catalog'} 
              onClick={() => setActiveTab('catalog')}
              icon={<Store className="text-orange-500 size-4" />}
              label="Catálogo y Stock"
            />
          </div>

          {/* Súper Administrador Section */}
          {(auth.currentUser?.email === 'camilomartg@gmail.com' || auth.currentUser?.email === 'imagina3ddesign@gmail.com') && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-red-500 tracking-wider uppercase px-3 block">Súper Admin</span>
              <NavItem 
                active={activeTab === 'superadmin'} 
                onClick={() => setActiveTab('superadmin')}
                icon={<ShieldCheck className="text-red-600 size-4" />}
                label="Consola de Control"
              />
            </div>
          )}

          {/* Configuración Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block">Configuración</span>
            <NavItem 
              active={activeTab === 'categories'} 
              onClick={() => setActiveTab('categories')}
              icon={<Tag className="size-4" />}
              label="Categorías"
            />
            <NavItem 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')}
              icon={<SettingsIcon className="size-4" />}
              label="Ajustes"
            />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100 space-y-4">
          <div className="flex items-center gap-3 text-sm px-2">
            <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center font-medium">
              {auth.currentUser?.email?.[0].toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-medium truncate">{auth.currentUser?.displayName || 'Usuario'}</span>
              <span className="text-zinc-500 text-xs truncate">{auth.currentUser?.email}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-zinc-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
            <LogOut className="mr-2 size-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 capitalize">
              {activeTab === 'overview' && 'Panel de Control'}
              {activeTab === 'transactions' && 'Historial'}
              {activeTab === 'income' && 'Registro de Ingresos'}
              {activeTab === 'recurring_income' && 'Ingresos Frecuentes y Recurrentes'}
              {activeTab === 'accounts' && 'Mis Cuentas'}
              {activeTab === 'expense' && 'Historial de Pagos y Obligaciones'}
              {activeTab === 'purchase' && 'Historial de Compras Eventuales'}
              {activeTab === 'inventory' && 'Inventario y Existencias'}
              {activeTab === 'fixed_assets' && 'Mis Activos Fijos'}
              {activeTab === 'savings' && 'Mis Ahorros y Fondos'}
              {activeTab === 'receivables' && 'Cuentas y Préstamos por Cobrar'}
              {activeTab === 'debts' && 'Mis Deudas y Obligaciones'}
              {activeTab === 'market' && 'Canasta de Compras y Control de Consumo'}
              {activeTab === 'categories' && 'Categorías'}
              {activeTab === 'settings' && 'Configuración'}
              {activeTab === 'catalog' && 'Catálogo y Precios Colaborativo'}
              {activeTab === 'superadmin' && 'Panel Regulador de Súper Administrador'}
            </h2>
            <p className="text-zinc-500 mt-1">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'inventory' && (
              <Button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-new-inventory-dialog'))} 
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs h-9 shadow-sm"
              >
                <Plus className="mr-1.5 size-4" /> Registrar Inventario Actual
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {activeTab === 'overview' && (
            <Overview 
              transactions={transactions} 
              settings={settings} 
              accounts={accounts}
              categories={categories}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsList 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
            />
          )}
          {activeTab === 'income' && (
            <IncomesTrackerView 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
              settings={settings}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === 'recurring_income' && (
            <RecurringIncomesView />
          )}
          {activeTab === 'accounts' && (
            <AccountsList 
              accounts={accounts} 
            />
          )}
          {activeTab === 'expense' && (
            <PaymentsView 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
              settings={settings}
            />
          )}
          {activeTab === 'trips' && (
            <TripsView 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
              settings={settings}
            />
          )}
          {activeTab === 'purchase' && (
            <TransactionsList 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories}
              filterType="purchase"
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryView />
          )}
          {activeTab === 'fixed_assets' && (
            <FixedAssetsView />
          )}
          {activeTab === 'savings' && (
            <SavingsView />
          )}
          {activeTab === 'receivables' && (
            <ReceivablesView />
          )}
          {activeTab === 'debts' && (
            <DebtsView />
          )}
          {activeTab === 'market' && (
            <MarketView />
          )}
          {activeTab === 'categories' && (
            <CategoriesList 
              categories={categories} 
            />
          )}
          {activeTab === 'settings' && (
            <Settings 
              settings={settings} 
              onSave={setSettings}
              accounts={accounts}
            />
          )}
          {activeTab === 'catalog' && (
            <CatalogView />
          )}
          {activeTab === 'superadmin' && (
            <SuperAdminView />
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
        ? 'bg-zinc-900 text-white shadow-md' 
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
