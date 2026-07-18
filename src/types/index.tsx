export type UserRole = 'owner' | 'staff';

export interface User {
  id: number; name: string; pin: string; role: UserRole; created_at: string;
}

export interface Product {
  id: number; name: string; category: string; unit_price: number;
  current_stock: number; low_stock_threshold: number; created_at: string;
}

export interface Customer {
  id: number; name: string; phone: string; balance: number; created_at: string;
}

export type TransactionType = 'sale' | 'purchase' | 'transfer' | 'return';
export type PaymentMethod = 'cash' | 'credit';

export interface Transaction {
  id: number; type: TransactionType; customer_id: number | null; user_id: number;
  total: number; payment_method: PaymentMethod; note: string; created_at: string;
}

export interface TransactionItem {
  id: number; transaction_id: number; product_id: number;
  quantity: number; unit_price: number; subtotal: number;
}

export type MovementType = 'in' | 'out';

export interface StockMovement {
  id: number; product_id: number; type: MovementType; quantity: number;
  reason: string; transaction_id: number | null; user_id: number; created_at: string;
}

export interface Payment {
  id: number; customer_id: number; amount: number; user_id: number;
  note: string; created_at: string;
}
// عنصر في سجل نشاط العميل (مبيعة آجلة أو دفعة سداد)
export type ActivityEntry = {
  key: string;
  kind: 'sale' | 'payment';
  amount: number;
  created_at: string;
};
// ===== التقارير — Reports types =====

export type SalesStats = {
  today: number;
  week: number;
  allTime: number;
  todayCount: number;
};

export type DaySale = { day: string; total: number };

export type TopProduct = {
  id: number;
  name: string;
  category: string;
  total_qty: number;
  total_revenue: number;
};

export type DebtSummary = {
  totalDebt: number;
  debtorsCount: number;
  weekPayments: number;
};