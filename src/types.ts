export interface UserSettings {
  monthlyLimit: number;
  billingCycle: '15' | '30';
  updatedAt?: string;
  eventualIncomeConcepts?: string[];
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'purchase';
  icon: string;
  color: string;
  isAutoDebit?: boolean;
  isNoCost?: boolean;
  isEventual?: boolean;
  estimatedLimit?: number;
  subcategories?: string[];
  paymentType?: 'fixed' | 'variable';
  fixedAmount?: number;
  periodicity?: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannually' | 'annually' | 'eventual';
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'purchase';
  categoryId: string;
  accountId: string;
  date: string;
  description: string;
  isEventual?: boolean;
  createdAt: string;
  payerOrEntity?: string;
  concept?: string;
  subcategory?: string;
  paidWithDebt?: boolean;
  debtId?: string;
}

export interface PurchaseCategory {
  id: string;
  name: string;
  subcategories: string[];
  isCustom?: boolean;
  createdAt?: string;
}

export interface PurchaseProduct {
  id: string;
  name: string;
  categoryId: string; // References id in PurchaseCategory
  subcategory: string; // The subcategory name
  isRegular: boolean; // true = Consumo regular (reutilizable), false = Esporádica
  isService?: boolean; // true = Servicio/Obligación (impuestos, rentas, arriendos, utilidades)
  defaultPrice: number;
  lastStore: string; // Dónde se compra (store/facility)
  stock: number; // Inventario de existencias
  minStock?: number; // Umbral de alerta para comprar
  consumptionPercentage?: number; // Para control de porcentaje consumido (0 - 100)
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseStore {
  id: string;
  name: string;
  logoUrl?: string;
  logoFileId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  createdAt?: string;
}

export interface SavingFund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  targetDate?: string;
  description?: string;
  accountId?: string; // Tracks where this saved money physically is (Cuentas)
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurringIncome {
  id: string;
  name: string;
  amount: number;
  accountId: string;
  categoryId: string;
  dayOfMonth: number;
  description?: string;
  lastAppliedDate?: string;
  active: boolean;
  frequency?: 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  startMonth?: number; // Month number (1 for Enero to 12 for Diciembre) when the first payment is received
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  paymentType: 'fixed' | 'variable';
  accountId: string;
  categoryId: string;
  subcategoryId?: string;
  dayOfMonth: number;
  startDate: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom_months';
  intervalMonths?: number;
  description?: string;
  lastAppliedDate?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  linkedStoreId?: string;
  linkedStoreName?: string;
  linkedProductId?: string;
  linkedProductName?: string;
  decreaseStockQty?: number;
}

export interface ShoppingItem {
  id: string; // client-side unique key
  productId?: string; // empty if custom entered item
  name: string;
  qty: number;
  price: number;
  checked: boolean;
  subcategory?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  status: 'pending' | 'completed';
  items: ShoppingItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number; // percentage (e.g., 12.5 for 12.5%)
  dueDate: string; // ISO date string or YYYY-MM-DD
  minimumPayment: number;
  status: 'active' | 'paid';
  type?: 'general' | 'credit_card' | 'revolving';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string; // ISO or YYYY-MM-DD when paid
  accountId: string; // Cash, Bank, etc. source account
  notes?: string;
  createdAt?: string;
}

export interface Receivable {
  id: string;
  name: string;
  debtor: string; // Person who owes the money
  totalAmount: number;
  remainingAmount: number;
  interestRate?: number; // e.g. 5 for 5%
  dueDate: string; // expected payment date
  minimumPayment?: number;
  status: 'active' | 'collected';
  type?: 'loan' | 'work'; // 'loan' for normal money loans, 'work' for completed jobs/professional fees
  invoiceSubmitted?: boolean; // Whether the collection invoice (cuenta de cobro) has been submitted to the client
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceivablePayment {
  id: string;
  receivableId: string;
  amount: number;
  date: string; // when payment was received
  accountId: string; // Cash, Bank, etc. destination account
  notes?: string;
  createdAt?: string;
}

export interface FixedAsset {
  id: string;
  name: string;      // Apartment, car, appliance, etc.
  category: 'real_estate' | 'vehicle' | 'appliance' | 'technology' | 'other';
  estimatedValue: number;
  purchaseDate?: string;
  description?: string;
  location?: string;
  status: 'active' | 'sold' | 'deprecated' | 'donated';
  createdAt?: string;
  updatedAt?: string;
}


