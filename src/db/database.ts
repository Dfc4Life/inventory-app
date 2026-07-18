import * as SQLite from 'expo-sqlite';
import type { User, Product, Customer, StockMovement } from '../types';

const DB_NAME = 'inventory.db';
let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initSchema(db);
    await seedIfEmpty(db);
  }
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'عام',
      unit_price REAL NOT NULL DEFAULT 0,
      current_stock REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      customer_id INTEGER,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      transaction_id INTEGER,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      user_id INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

async function seedIfEmpty(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users'
  );
  if (row && row.count > 0) return;

  await database.runAsync(
    `INSERT INTO users (name, pin, role) VALUES (?, ?, ?)`,
    'أبو أحمد', '1234', 'owner'
  );

  const products: [string, string, number, number, number][] = [
    ['زيت الطعام (5 لتر)', 'منظفات', 20000, 18, 25],
    ['الرز البسمتي (10 كغ)', 'مواد غذائية', 45000, 42, 10],
    ['السكر الأبيض (1 كغ)', 'مواد غذائية', 2500, 0, 15],
    ['الشاي الأحمر', 'مشروبات', 8000, 5, 10],
    ['المعكرونة', 'مواد غذائية', 1500, 120, 20],
  ];
  for (const p of products) {
    await database.runAsync(
      `INSERT INTO products (name, category, unit_price, current_stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?)`,
      ...p
    );
  }

  const customers: [string, string, number][] = [
    ['محمد العلي', '07700000001', 850000],
    ['أم حسن', '07700000002', 1200000],
    ['أبو سيف', '07700000003', 400000],
    ['شركة النور التجارية', '07700000004', 0],
  ];
  for (const c of customers) {
    await database.runAsync(
      `INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)`,
      ...c
    );
  }
}

export async function getUsers(): Promise<User[]> {
  const database = await getDatabase();
  return database.getAllAsync<User>(`SELECT * FROM users ORDER BY name`);
}

export async function getProducts(): Promise<Product[]> {
  const database = await getDatabase();
  return database.getAllAsync<Product>(`SELECT * FROM products ORDER BY name`);
}

export async function getCustomers(): Promise<Customer[]> {
  const database = await getDatabase();
  return database.getAllAsync<Customer>(`SELECT * FROM customers ORDER BY name`);
}

export async function recordSale(
  userId: number,
  items: { product_id: number; quantity: number; unit_price: number }[],
  paymentMethod: 'cash' | 'credit',
  customerId: number | null,
  note: string = ''
): Promise<number> {
  const database = await getDatabase();
  const total = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  await database.withTransactionAsync(async () => {
    const txResult = await database.runAsync(
      `INSERT INTO transactions (type, customer_id, user_id, total, payment_method, note)
       VALUES ('sale', ?, ?, ?, ?, ?)`,
      customerId, userId, total, paymentMethod, note
    );
    const txId = txResult.lastInsertRowId as number;

    for (const it of items) {
      await database.runAsync(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        txId, it.product_id, it.quantity, it.unit_price, it.quantity * it.unit_price
      );
      await database.runAsync(
        `UPDATE products SET current_stock = current_stock - ? WHERE id = ?`,
        it.quantity, it.product_id
      );
      await database.runAsync(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, transaction_id, user_id)
         VALUES (?, 'out', ?, 'بيع', ?, ?)`,
        it.product_id, it.quantity, txId, userId
      );
    }

    if (paymentMethod === 'credit' && customerId) {
      await database.runAsync(
        `UPDATE customers SET balance = balance + ? WHERE id = ?`,
        total, customerId
      );
    }
  });

  const last = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM transactions ORDER BY id DESC LIMIT 1`
  );
  return last?.id ?? 0;
}

export async function recordPayment(
  customerId: number, amount: number, userId: number, note: string = ''
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO payments (customer_id, amount, user_id, note) VALUES (?, ?, ?, ?)`,
      customerId, amount, userId, note
    );
    await database.runAsync(
      `UPDATE customers SET balance = balance - ? WHERE id = ?`,
      amount, customerId
    );
  });
}

export async function getStockMovements(productId: number): Promise<StockMovement[]> {
  const database = await getDatabase();
  return database.getAllAsync<StockMovement>(
    `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`,
    productId
  );
}
// ----- جلب عميل واحد (Get a single customer by id) -----
export async function getCustomerById(id: number): Promise<Customer | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Customer>(
    `SELECT * FROM customers WHERE id = ?`, id
  );
}

// ----- نشاط العميل: المبيعات الآجلة + الدفعات (Customer activity feed) -----
export type ActivityEntry = {
  key: string;
  kind: 'sale' | 'payment';
  amount: number;
  created_at: string;
};

export async function getCustomerActivity(customerId: number): Promise<ActivityEntry[]> {
  const database = await getDatabase();
  const sales = await database.getAllAsync<{ id: number; total: number; created_at: string }>(
    `SELECT id, total, created_at FROM transactions
     WHERE customer_id = ? AND type = 'sale' AND payment_method = 'credit'
     ORDER BY created_at DESC`,
    customerId
  );
  const payments = await database.getAllAsync<{ id: number; amount: number; created_at: string }>(
    `SELECT id, amount, created_at FROM payments
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    customerId
  );

  const activity: ActivityEntry[] = [
    ...sales.map(s => ({ key: 'sale-' + s.id, kind: 'sale' as const, amount: s.total, created_at: s.created_at })),
    ...payments.map(p => ({ key: 'pay-' + p.id, kind: 'payment' as const, amount: p.amount, created_at: p.created_at })),
  ];

  activity.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return activity;
}
// ----- إضافة منتج جديد (Add a new product) -----
export async function addProduct(
  name: string, category: string, unitPrice: number,
  openingStock: number, lowThreshold: number
): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO products (name, category, unit_price, current_stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?)`,
    name, category, unitPrice, openingStock, lowThreshold
  );
  return result.lastInsertRowId as number;
}

// ----- إضافة عميل جديد (Add a new customer) -----
export async function addCustomer(name: string, phone: string): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO customers (name, phone, balance) VALUES (?, ?, 0)`,
    name, phone
  );
  return result.lastInsertRowId as number;
}

export async function getDashboardStats() {
  const database = await getDatabase();
  const productCount = await database.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM products`
  );
  const lowStock = await database.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM products WHERE current_stock <= low_stock_threshold`
  );
  const totalDebt = await database.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(balance), 0) as s FROM customers`
  );
  return {
    productCount: productCount?.c ?? 0,
    lowStock: lowStock?.c ?? 0,
    totalDebt: totalDebt?.s ?? 0,
  };
}