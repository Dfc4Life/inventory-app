// src/screens/OperationsScreen.tsx
// نموذج العملية — The Heartbeat: sale / purchase / transfer

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatNumber } from '../theme';
import {
  getProducts, getCustomers, getUsers,
  recordSale, recordPurchase, recordTransfer,
} from '../db/database';
import type { Product, Customer } from '../types';

type OpType = 'sale' | 'purchase' | 'transfer';
type CartItem = Product & { qty: number };

const OP_META: Record<OpType, { label: string; emoji: string; stockOut: boolean; hasMoney: boolean; subtitle: string }> = {
  sale:     { label: 'بيع',     emoji: '🛒', stockOut: true,  hasMoney: true,  subtitle: 'بيع منتجات للعملاء' },
  purchase: { label: 'شراء',    emoji: '📦', stockOut: false, hasMoney: true,  subtitle: 'إدخال / استلام بضاعة من المورّد' },
  transfer: { label: 'تحويل',   emoji: '🔄', stockOut: true,  hasMoney: false, subtitle: 'إخراج بضاعة لسبب غير البيع' },
};

export default function OperationsScreen() {
  const [opType, setOpType] = useState<OpType>('sale');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<'cash' | 'credit'>('cash');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reason, setReason] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const meta = OP_META[opType];
  const total = cart.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const totalUnits = cart.reduce((s, it) => s + it.qty, 0);

  const openProductModal = async () => { setProducts(await getProducts()); setShowProductModal(true); };
  const openCustomerModal = async () => { setCustomers(await getCustomers()); setShowCustomerModal(true); };

  const maxFor = (p: Product) => (meta.stockOut ? p.current_stock : Infinity);

  const addToCart = (p: Product) => {
    if (meta.stockOut && p.current_stock <= 0) {
      Alert.alert('تنبيه', 'هذا المنتج نفد من المخزون');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        if (existing.qty >= maxFor(p)) return prev;
        return prev.map(i => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const changeQty = (item: CartItem, delta: number) => {
    setCart(prev =>
      prev.flatMap(i => {
        if (i.id !== item.id) return [i];
        const next = i.qty + delta;
        if (next <= 0) return [];
        if (next > maxFor(i)) return [i];
        return [{ ...i, qty: next }];
      })
    );
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  const switchType = (t: OpType) => {
    setOpType(t); setCart([]); setPayment('cash'); setCustomer(null); setReason('');
  };

  const reset = () => { setCart([]); setPayment('cash'); setCustomer(null); setReason(''); };

  const handleSave = async () => {
    if (cart.length === 0) { Alert.alert('تنبيه', 'الرجاء إضافة منتج واحد على الأقل'); return; }
    if (opType === 'sale' && payment === 'credit' && !customer) {
      Alert.alert('تنبيه', 'الرجاء اختيار العميل للبيع الآجل'); return;
    }
    if (opType === 'transfer' && !reason.trim()) {
      Alert.alert('تنبيه', 'الرجاء إدخال سبب التحويل'); return;
    }
    setSaving(true);
    try {
      const users = await getUsers();
      const userId = users[0]?.id ?? 1;
      if (opType === 'sale') {
        const items = cart.map(i => ({ product_id: i.id, quantity: i.qty, unit_price: i.unit_price }));
        await recordSale(userId, items, payment, customer?.id ?? null);
      } else if (opType === 'purchase') {
        const items = cart.map(i => ({ product_id: i.id, quantity: i.qty, unit_price: i.unit_price }));
        await recordPurchase(userId, items);
      } else {
        const items = cart.map(i => ({ product_id: i.id, quantity: i.qty }));
        await recordTransfer(userId, items, reason.trim());
      }
      Alert.alert('✅ تم بنجاح', 'تم حفظ العملية وتحديث المخزون', [{ text: 'حسناً', onPress: reset }]);
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
        <Text style={styles.subtitle}>{meta.subtitle}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={-200}>
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }}>
          <Text style={styles.sectionLabel}>نوع العملية</Text>
          <View style={styles.typeRow}>
            {(Object.keys(OP_META) as OpType[]).map(t => {
              const m = OP_META[t];
              const active = opType === t;
              return (
                <Pressable key={t} style={[styles.typeChip, active ? styles.typeActive : styles.typeInactive]} onPress={() => switchType(t)}>
                  <Text style={active ? styles.typeActiveText : styles.typeInactiveText}>{m.emoji} {m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>المنتجات ({cart.length})</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyHint}>لم تتم إضافة منتجات بعد</Text>
          ) : (
            cart.map(item => {
              const atMax = meta.stockOut && item.qty >= item.current_stock;
              return (
                <View key={item.id} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartName}>{item.name}</Text>
                    <Text style={styles.cartPrice}>
                      {meta.hasMoney ? formatIQD(item.unit_price) + ' • ' : ''}
                      {meta.stockOut ? `متوفر: ${formatNumber(item.current_stock)}` : `المخزون الحالي: ${formatNumber(item.current_stock)}`}
                    </Text>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable style={styles.qtyBtn} onPress={() => changeQty(item, -1)}>
                      <Ionicons name="remove" size={18} color="#fff" />
                    </Pressable>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                    <Pressable style={[styles.qtyBtn, atMax && { opacity: 0.3 }]} onPress={() => changeQty(item, 1)} disabled={atMax}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </Pressable>
                  </View>
                  <View style={styles.cartRight}>
                    {meta.hasMoney && <Text style={styles.cartSubtotal}>{formatIQD(item.qty * item.unit_price)}</Text>}
                    <Pressable onPress={() => removeFromCart(item.id)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Pressable style={styles.addBtn} onPress={openProductModal}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.addBtnText}>إضافة منتج</Text>
          </Pressable>

          {opType === 'sale' && (
            <>
              <Text style={styles.sectionLabel}>طريقة الدفع</Text>
              <View style={styles.payRow}>
                <Pressable style={[styles.payBtn, payment === 'cash' && styles.payActive]} onPress={() => setPayment('cash')}>
                  <Ionicons name="cash-outline" size={18} color={payment === 'cash' ? '#fff' : COLORS.muted} />
                  <Text style={[styles.payText, payment === 'cash' && styles.payTextActive]}>نقدي</Text>
                </Pressable>
                <Pressable style={[styles.payBtn, payment === 'credit' && styles.payActive]} onPress={() => setPayment('credit')}>
                  <Ionicons name="document-text-outline" size={18} color={payment === 'credit' ? '#fff' : COLORS.muted} />
                  <Text style={[styles.payText, payment === 'credit' && styles.payTextActive]}>آجل (على الحساب)</Text>
                </Pressable>
              </View>
              {payment === 'credit' && (
                <>
                  <Text style={styles.sectionLabel}>العميل</Text>
                  <Pressable style={styles.selectBtn} onPress={openCustomerModal}>
                    <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                    <Text style={[styles.selectText, customer && { color: COLORS.text }]}>{customer ? customer.name : 'اختر العميل'}</Text>
                    {customer ? (
                      <Pressable onPress={() => setCustomer(null)} style={{ marginLeft: 'auto' }}>
                        <Ionicons name="close-circle" size={20} color={COLORS.muted} />
                      </Pressable>
                    ) : (
                      <Ionicons name="chevron-back" size={18} color={COLORS.muted} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                  {customer && <Text style={styles.debtHint}>الدين الحالي: {formatIQD(customer.balance)}</Text>}
                </>
              )}
            </>
          )}

          {opType === 'purchase' && (
            <>
              <Text style={styles.sectionLabel}>ملاحظة / المورّد (اختياري)</Text>
              <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="مثال: استلام من المورّد أحمد" placeholderTextColor={COLORS.muted} />
              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.noteText}>الشراء يضيف الكمية للمخزون. تتبّع ديون الموردين سيُضاف لاحقاً.</Text>
              </View>
            </>
          )}

          {opType === 'transfer' && (
            <>
              <Text style={styles.sectionLabel}>سبب التحويل *</Text>
              <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="مثال: تالف، عيّنة، تحويل لفرع آخر" placeholderTextColor={COLORS.muted} />
              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.amber} />
                <Text style={styles.noteText}>التحويل يخصم الكمية من المخزون بدون مبلغ مالي.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>{meta.hasMoney ? 'الإجمالي' : 'الكمية'}</Text>
          <Text style={styles.totalValue}>{meta.hasMoney ? formatIQD(total) : `${cart.length} منتج • ${formatNumber(totalUnits)} وحدة`}</Text>
        </View>
        <Pressable style={[styles.saveBtn, (saving || cart.length === 0) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || cart.length === 0}>
          <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ العملية'}</Text>
        </Pressable>
      </View>

      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر المنتج</Text>
              <Pressable onPress={() => setShowProductModal(false)}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {products.map(p => {
                const blocked = meta.stockOut && p.current_stock <= 0;
                return (
                  <Pressable key={p.id} style={[styles.modalItem, blocked && { opacity: 0.4 }]} disabled={blocked} onPress={() => { addToCart(p); setShowProductModal(false); }}>
                    <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}><Text style={styles.avatarText}>{p.name.charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{p.name}</Text>
                      <Text style={styles.modalItemSub}>{formatIQD(p.unit_price)}</Text>
                    </View>
                    <Text style={[styles.modalItemStock, { color: p.current_stock <= 0 ? COLORS.red : COLORS.muted }]}>{p.current_stock <= 0 ? 'نفد' : formatNumber(p.current_stock)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCustomerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر العميل</Text>
              <Pressable onPress={() => setShowCustomerModal(false)}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {customers.map(c => (
                <Pressable key={c.id} style={styles.modalItem} onPress={() => { setCustomer(c); setShowCustomerModal(false); }}>
                  <View style={[styles.avatar, { backgroundColor: COLORS.blue }]}><Text style={styles.avatarText}>{c.name.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{c.name}</Text>
                    <Text style={styles.modalItemSub}>{c.phone || 'بدون رقم'}</Text>
                  </View>
                  <Text style={[styles.modalItemStock, { color: c.balance > 0 ? COLORS.red : COLORS.muted }]}>{formatIQD(c.balance)}</Text>
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
  typeChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  typeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeInactive: { borderColor: COLORS.line, backgroundColor: COLORS.card },
  typeActiveText: { color: '#fff', fontWeight: '700' },
  typeInactiveText: { color: COLORS.muted, fontWeight: '600' },
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
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.card, textAlign: 'right' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.background, borderRadius: 10, padding: 10, marginTop: 8 },
  noteText: { flex: 1, fontSize: 11, color: COLORS.muted, lineHeight: 16 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line, padding: SPACING.md, paddingBottom: SPACING.lg },
  totalLabel: { fontSize: 12, color: COLORS.muted },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
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