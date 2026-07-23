// src/screens/InventoryScreen.tsx
// المخزون — product list + detail modal with restock & movement history
// يدعم التسعير بالجملة + إصلاح لوحة المفاتيح (نموذج قابل للتمرير)

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatNumber, formatDate } from '../theme';
import { getProducts, getProductById, getStockMovements, addProduct, adjustStock, deleteProduct, getUsers } from '../db/database';
import { triggerSync } from '../sync';
import type { Product, StockMovement } from '../types';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkThreshold, setBulkThreshold] = useState('');
  const [saving, setSaving] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => setProducts(await getProducts()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resetForm = () => { setName(''); setCategory(''); setPrice(''); setStock(''); setThreshold(''); setBulkPrice(''); setBulkThreshold(''); };
  const closeForm = () => { setShowAdd(false); resetForm(); };

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert('تنبيه', 'الرجاء إدخال اسم المنتج'); return; }
    const p = parseFloat(price) || 0;
    const s = parseFloat(stock) || 0;
    const t = parseFloat(threshold) || 5;
    const bp = parseFloat(bulkPrice) || 0;
    const bt = parseFloat(bulkThreshold) || 0;
    setSaving(true);
    try {
      await addProduct(name.trim(), category.trim() || 'عام', p, s, t, bp, bt);
      await load();
      closeForm();
      Alert.alert('✅ تم', 'تمت إضافة المنتج بنجاح');
      triggerSync();
    } catch (e) {
      Alert.alert('خطأ', 'تعذّرت الإضافة.\n\n' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (p: Product) => {
    setDetail(p);
    setMovements([]);
    setAdjAmount('');
    setAdjReason('');
    setShowDetail(true);
    setMovements(await getStockMovements(p.id));
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const updated = await getProductById(detail.id);
    if (updated) setDetail(updated);
    setMovements(await getStockMovements(detail.id));
  };

  const handleAdjust = async (direction: 'in' | 'out') => {
    if (!detail) return;
    const qty = parseFloat(adjAmount);
    if (!qty || qty <= 0) { Alert.alert('تنبيه', 'الرجاء إدخال كمية صحيحة'); return; }
    if (direction === 'out' && qty > (detail.current_stock)) {
      Alert.alert('تنبيه', 'الكمية المراد خصمها أكبر من المخزون الحالي'); return;
    }
    setAdjusting(true);
    try {
      const users = await getUsers();
      const userId = users[0]?.id ?? 1;
      const reason = adjReason.trim() || (direction === 'in' ? 'إعادة تخزين' : 'خصم يدوي');
      await adjustStock(detail.id, qty, direction, reason, userId);
      setAdjAmount(''); setAdjReason('');
      await refreshDetail(); await load();
      Alert.alert('✅ تم', direction === 'in' ? 'تمت إضافة الكمية للمخزون' : 'تم خصم الكمية من المخزون');
      triggerSync();
    } catch (e) {
      Alert.alert('خطأ', 'تعذّر التحديث. حاول مرة أخرى.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleDelete = () => {
    if (!detail) return;
    const hasHistory = movements.length > 0;
    const msg = hasHistory
      ? '⚠️ لهذا المنتج سجل حركات.\n\nسيتم حذف المنتج نهائياً بما في ذلك سجل حركاته وعناصر العمليات السابقة المرتبطة به. لا يمكن التراجع. هل أنت متأكد؟'
      : 'هل أنت متأكد من حذف هذا المنتج؟';
    Alert.alert('حذف المنتج', msg, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await deleteProduct(detail.id);
          setShowDetail(false); await load();
          Alert.alert('✅ تم', 'تم حذف المنتج');
          triggerSync();
        } catch (e) { Alert.alert('خطأ', 'تعذّر الحذف. حاول مرة أخرى.'); }
      }},
    ]);
  };

  const statusBadge = (p: Product) => {
    if (p.current_stock <= 0) return { text: 'نفد', color: COLORS.red };
    if (p.current_stock <= p.low_stock_threshold) return { text: 'منخفض', color: COLORS.amber };
    return { text: 'متوفر', color: COLORS.green };
  };

  const renderItem = ({ item }: { item: Product }) => {
    const badge = statusBadge(item);
    return (
      <Pressable style={styles.item} onPress={() => openDetail(item)}>
        <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>
            {formatIQD(item.unit_price)} • {item.category}
            {item.bulk_threshold > 0 ? ` • جملة ${item.bulk_threshold}/${formatIQD(item.bulk_price)}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.qty, { color: item.current_stock <= 0 ? COLORS.red : COLORS.text }]}>
            {formatNumber(item.current_stock)}
          </Text>
          <Text style={[styles.badge, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </Pressable>
    );
  };

  const badge = detail ? statusBadge(detail) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>المخزون</Text>
            <Text style={styles.subtitle}>{products.length} منتج</Text>
          </View>
          <Pressable style={styles.addHeaderBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.line }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد منتجات بعد</Text>}
      />

      {/* ADD PRODUCT MODAL — قابل للتمرير لإصلاح لوحة المفاتيح */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إضافة منتج جديد</Text>
              <Pressable onPress={closeForm}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: '78%' }} contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>اسم المنتج</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="مثال: ماء معدني" placeholderTextColor={COLORS.muted} />

              <Text style={styles.fieldLabel}>الفئة</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="مثال: مشروبات" placeholderTextColor={COLORS.muted} />

              <View style={styles.rowTwo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>سعر القطعة (د.ع)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.fieldLabel}>الكمية الافتتاحية</Text>
                  <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.fieldLabel}>الحد الأدنى للتنبيه</Text>
              <TextInput style={styles.input} value={threshold} onChangeText={setThreshold} placeholder="5" placeholderTextColor={COLORS.muted} keyboardType="numeric" />

              {/* قسم الجملة — اختياري */}
              <View style={styles.bulkSection}>
                <Text style={styles.bulkTitle}>📦 التسعير بالجملة (اختياري)</Text>
                <Text style={styles.bulkHint}>مثال: الكرتون فيه 12 قطعة، سعر القطعة 250، سعر الكرتون 1000</Text>
                <View style={styles.rowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>عدد القطع بالكرتون</Text>
                    <TextInput style={styles.input} value={bulkThreshold} onChangeText={setBulkThreshold} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.fieldLabel}>سعر الكرتون (د.ع)</Text>
                    <TextInput style={styles.input} value={bulkPrice} onChangeText={setBulkPrice} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ المنتج'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PRODUCT DETAIL MODAL */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detail?.name}</Text>
              <Pressable onPress={() => setShowDetail(false)}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>

            <ScrollView style={{ maxHeight: '85%' }} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.stockCard}>
                <View style={[styles.stockRing, { backgroundColor: badge?.color ?? COLORS.green }]}>
                  <Text style={styles.stockNum}>{formatNumber(detail?.current_stock ?? 0)}</Text>
                  <Text style={styles.stockUnit}>قطعة</Text>
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.stockLabel}>المتبقي حالياً</Text>
                  <Text style={[styles.stockStatus, { color: badge?.color ?? COLORS.green }]}>{badge?.text}</Text>
                  <Text style={styles.stockMeta}>{detail?.category} • القطعة: {formatIQD(detail?.unit_price ?? 0)}</Text>
                  {detail && detail.bulk_threshold > 0 ? (
                    <Text style={styles.stockMeta}>جملة: {formatNumber(detail.bulk_threshold)} قطعة / {formatIQD(detail.bulk_price)}</Text>
                  ) : null}
                  <Text style={styles.stockMeta}>الحد الأدنى: {formatNumber(detail?.low_stock_threshold ?? 0)}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>إضافة / خصم مخزون</Text>
              <TextInput style={styles.input} value={adjAmount} onChangeText={setAdjAmount} placeholder="الكمية" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
              <TextInput style={[styles.input, { marginTop: 8 }]} value={adjReason} onChangeText={setAdjReason} placeholder="السبب (اختياري)" placeholderTextColor={COLORS.muted} />
              <View style={styles.adjRow}>
                <Pressable style={[styles.adjBtn, { backgroundColor: COLORS.green }, adjusting && { opacity: 0.5 }]} onPress={() => handleAdjust('in')} disabled={adjusting}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.adjBtnText}>إضافة (تعبئة)</Text>
                </Pressable>
                <Pressable style={[styles.adjBtn, { backgroundColor: COLORS.red }, adjusting && { opacity: 0.5 }]} onPress={() => handleAdjust('out')} disabled={adjusting}>
                  <Ionicons name="remove" size={18} color="#fff" />
                  <Text style={styles.adjBtnText}>خصم (تالف/تصحيح)</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>سجل الحركات ({movements.length})</Text>
              {movements.length === 0 ? (
                <Text style={styles.emptyHint}>لا توجد حركات بعد</Text>
              ) : (
                movements.map(m => (
                  <View key={m.id} style={styles.movementRow}>
                    <View style={[styles.actDot, { backgroundColor: m.type === 'in' ? COLORS.green : COLORS.red }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.movementReason}>{m.reason || (m.type === 'in' ? 'إدخال' : 'إخراج')}</Text>
                      <Text style={styles.movementDate}>{formatDate(m.created_at)}</Text>
                    </View>
                    <Text style={[styles.movementQty, { color: m.type === 'in' ? COLORS.green : COLORS.red }]}>
                      {m.type === 'in' ? '+' : '−'} {formatNumber(m.quantity)}
                    </Text>
                  </View>
                ))
              )}

              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                <Text style={styles.deleteBtnText}>حذف المنتج</Text>
              </Pressable>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
  addHeaderBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, backgroundColor: COLORS.card, paddingHorizontal: SPACING.sm },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  info: { flex: 1, marginHorizontal: 12 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  qty: { fontSize: 18, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 36, maxHeight: '92%' },
  detailCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 36, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, textAlign: 'right' },
  rowTwo: { flexDirection: 'row' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bulkSection: { marginTop: 18, padding: 14, backgroundColor: COLORS.background, borderRadius: 14 },
  bulkTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  bulkHint: { fontSize: 11, color: COLORS.muted, marginBottom: 4, lineHeight: 16 },
  stockCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 16, padding: 16, gap: 14 },
  stockRing: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  stockNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  stockUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 10 },
  stockLabel: { fontSize: 13, color: COLORS.muted },
  stockStatus: { fontSize: 16, fontWeight: '800', marginVertical: 3 },
  stockMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  adjRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  adjBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13 },
  adjBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginVertical: SPACING.sm },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  movementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  actDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  movementReason: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  movementDate: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  movementQty: { fontSize: 14, fontWeight: '800' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.red, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)' },
  deleteBtnText: { color: COLORS.red, fontWeight: '700', fontSize: 14 },
});