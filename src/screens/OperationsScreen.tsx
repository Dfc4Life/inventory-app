// src/screens/OperationsScreen.tsx
// نموذج العملية — The Heartbeat: record a sale (deducts stock + updates debt)

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatNumber } from '../theme';
import { getProducts, getCustomers, getUsers, recordSale } from '../db/database';
import type { Product, Customer } from '../types';

type CartItem = Product & { qty: number };

export default function OperationsScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<'cash' | 'credit'>('cash');
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = cart.reduce((s, it) => s + it.qty * it.unit_price, 0);

  const openProductModal = async () => {
    setProducts(await getProducts());
    setShowProductModal(true);
  };

  const openCustomerModal = async () => {
    setCustomers(await getCustomers());
    setShowCustomerModal(true);
  };

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        if (existing.qty >= p.current_stock) return prev;
        return prev.map(i => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const changeQty = (id: number, delta: number) => {
    setCart(prev =>
      prev.flatMap(i => {
        if (i.id !== id) return [i];
        const next = i.qty + delta;
        if (next <= 0) return [];
        if (next > i.current_stock) return [i];
        return [{ ...i, qty: next }];
      })
    );
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  const reset = () => {
    setCart([]);
    setPayment('cash');
    setCustomer(null);
  };

  const handleSave = async () => {
    if (cart.length === 0) {
      Alert.alert('تنبيه', 'الرجاء إضافة منتج واحد على الأقل');
      return;
    }
    if (payment === 'credit' && !customer) {
      Alert.alert('تنبيه', 'الرجاء اختيار العميل للبيع الآجل');
      return;
    }
    setSaving(true);
    try {
      const users = await getUsers();
      const userId = users[0]?.id ?? 1; // TODO: replace with real login later
      const items = cart.map(i => ({
        product_id: i.id,
        quantity: i.qty,
        unit_price: i.unit_price,
      }));
      await recordSale(userId, items, payment, customer?.id ?? null);
      Alert.alert('✅ تم بنجاح', 'تم حفظ العملية وتحديث المخزون', [
        { text: 'حسناً', onPress: reset },
      ]);
    } catch (e) {
      Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>عملية جديدة</Text>
        <Text style={styles.subtitle}>تُحفظ تلقائياً على الجهاز</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.sectionLabel}>نوع العملية</Text>
        <View style={styles.typeRow}>
          <View style={[styles.typeChip, styles.typeActive]}>
            <Text style={styles.typeActiveText}>🛒 بيع</Text>
          </View>
          <View style={[styles.typeChip, styles.typeDisabled]}>
            <Text style={{ color: COLORS.muted }}>شراء</Text>
          </View>
          <View style={[styles.typeChip, styles.typeDisabled]}>
            <Text style={{ color: COLORS.muted }}>تحويل</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>المنتجات ({cart.length})</Text>
        {cart.length === 0 ? (
          <Text style={styles.emptyHint}>لم تتم إضافة منتجات بعد</Text>
        ) : (
          cart.map(item => (
            <View key={item.id} style={styles.cartItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cartName}>{item.name}</Text>
                <Text style={styles.cartPrice}>
                  {formatIQD(item.unit_price)} • متوفر: {formatNumber(item.current_stock)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => changeQty(item.id, -1)}>
                  <Ionicons name="remove" size={18} color="#fff" />
                </Pressable>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <Pressable
                  style={[styles.qtyBtn, item.qty >= item.current_stock && { opacity: 0.3 }]}
                  onPress={() => changeQty(item.id, 1)}
                  disabled={item.qty >= item.current_stock}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
              <View style={styles.cartRight}>
                <Text style={styles.cartSubtotal}>{formatIQD(item.qty * item.unit_price)}</Text>
                <Pressable onPress={() => removeFromCart(item.id)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Pressable style={styles.addBtn} onPress={openProductModal}>
          <Ionicons name="add-circle" size={20} color={COLORS.primary} />
          <Text style={styles.addBtnText}>إضافة منتج</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>طريقة الدفع</Text>
        <View style={styles.payRow}>
          <Pressable
            style={[styles.payBtn, payment === 'cash' && styles.payActive]}
            onPress={() => setPayment('cash')}
          >
            <Ionicons name="cash-outline" size={18} color={payment === 'cash' ? '#fff' : COLORS.muted} />
            <Text style={[styles.payText, payment === 'cash' && styles.payTextActive]}>نقدي</Text>
          </Pressable>
          <Pressable
            style={[styles.payBtn, payment === 'credit' && styles.payActive]}
            onPress={() => setPayment('credit')}
          >
            <Ionicons name="document-text-outline" size={18} color={payment === 'credit' ? '#fff' : COLORS.muted} />
            <Text style={[styles.payText, payment === 'credit' && styles.payTextActive]}>آجل (على الحساب)</Text>
          </Pressable>
        </View>

        {payment === 'credit' && (
          <>
            <Text style={styles.sectionLabel}>العميل</Text>
            <Pressable style={styles.selectBtn} onPress={openCustomerModal}>
              <Ionicons name="person-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.selectText, customer && { color: COLORS.text }]}>
                {customer ? customer.name : 'اختر العميل'}
              </Text>
              {customer ? (
                <Pressable onPress={() => setCustomer(null)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close-circle" size={20} color={COLORS.muted} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-back" size={18} color={COLORS.muted} style={{ marginLeft: 'auto' }} />
              )}
            </Pressable>
            {customer && (
              <Text style={styles.debtHint}>الدين الحالي: {formatIQD(customer.balance)}</Text>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>الإجمالي</Text>
          <Text style={styles.totalValue}>{formatIQD(total)}</Text>
        </View>
        <Pressable
          style={[styles.saveBtn, (saving || cart.length === 0) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving || cart.length === 0}
        >
          <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ العملية'}</Text>
        </Pressable>
      </View>

      {/* PRODUCT PICKER MODAL */}
      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر المنتج</Text>
              <Pressable onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {products.map(p => (
                <Pressable
                  key={p.id}
                  style={styles.modalItem}
                  disabled={p.current_stock <= 0}
                  onPress={() => { addToCart(p); setShowProductModal(false); }}
                >
                  <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                    <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{p.name}</Text>
                    <Text style={styles.modalItemSub}>{formatIQD(p.unit_price)}</Text>
                  </View>
                  <Text style={[styles.modalItemStock, { color: p.current_stock <= 0 ? COLORS.red : COLORS.muted }]}>
                    {p.current_stock <= 0 ? 'نفد' : formatNumber(p.current_stock)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CUSTOMER PICKER MODAL */}
      <Modal visible={showCustomerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر العميل</Text>
              <Pressable onPress={() => setShowCustomerModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {customers.map(c => (
                <Pressable
                  key={c.id}
                  style={styles.modalItem}
                  onPress={() => { setCustomer(c); setShowCustomerModal(false); }}
                >
                  <View style={[styles.avatar, { backgroundColor: COLORS.blue }]}>
                    <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{c.name}</Text>
                    <Text style={styles.modalItemSub}>{c.phone || 'بدون رقم'}</Text>
                  </View>
                  <Text style={[styles.modalItemStock, { color: c.balance > 0 ? COLORS.red : COLORS.muted }]}>
                    {formatIQD(c.balance)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.md + 4, paddingBottom: SPACING.lg },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
  body: { flex: 1, padding: SPACING.md },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginVertical: SPACING.sm },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, alignItems: 'center' },
  typeActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  typeActiveText: { color: '#fff', fontWeight: '700' },
  typeDisabled: { opacity: 0.6 },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 8 },
  cartName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cartPrice: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { width: 32, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  cartRight: { alignItems: 'flex-end', minWidth: 70 },
  cartSubtotal: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, marginTop: 4 },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  payRow: { flexDirection: 'row', gap: 8 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  payActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  payTextActive: { color: '#fff' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  selectText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  debtHint: { fontSize: 12, color: COLORS.red, marginTop: 6, marginRight: 4 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line, padding: SPACING.md, paddingBottom: SPACING.lg },
  totalLabel: { fontSize: 12, color: COLORS.muted },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.md, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalItemName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  modalItemSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  modalItemStock: { fontSize: 13, fontWeight: '700' },
});