// src/screens/InventoryScreen.tsx
// المخزون — product list + add product form

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatNumber } from '../theme';
import { getProducts, addProduct } from '../db/database';
import type { Product } from '../types';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => setProducts(await getProducts()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resetForm = () => { setName(''); setCategory(''); setPrice(''); setStock(''); setThreshold(''); };
  const closeForm = () => { setShowAdd(false); resetForm(); };

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert('تنبيه', 'الرجاء إدخال اسم المنتج'); return; }
    const p = parseFloat(price) || 0;
    const s = parseFloat(stock) || 0;
    const t = parseFloat(threshold) || 5;
    setSaving(true);
    try {
      await addProduct(name.trim(), category.trim() || 'عام', p, s, t);
      await load();
      closeForm();
      Alert.alert('✅ تم', 'تمت إضافة المنتج بنجاح');
    } catch (e) {
      Alert.alert('خطأ', 'تعذّرت الإضافة. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (p: Product) => {
    if (p.current_stock <= 0) return { text: 'نفد', color: COLORS.red };
    if (p.current_stock <= p.low_stock_threshold) return { text: 'منخفض', color: COLORS.amber };
    return { text: 'متوفر', color: COLORS.green };
  };

  const renderItem = ({ item }: { item: Product }) => {
    const badge = statusBadge(item);
    return (
      <Pressable style={styles.item}>
        <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>{formatIQD(item.unit_price)} • {item.category}</Text>
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

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إضافة منتج جديد</Text>
              <Pressable onPress={closeForm}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>

            <Text style={styles.fieldLabel}>اسم المنتج</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="مثال: زيت الطعام (5 لتر)" placeholderTextColor={COLORS.muted} />

            <Text style={styles.fieldLabel}>الفئة</Text>
            <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="مثال: مواد غذائية" placeholderTextColor={COLORS.muted} />

            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>سعر الوحدة (د.ع)</Text>
                <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={styles.fieldLabel}>الكمية الافتتاحية</Text>
                <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>الحد الأدنى للتنبيه</Text>
            <TextInput style={styles.input} value={threshold} onChangeText={setThreshold} placeholder="5" placeholderTextColor={COLORS.muted} keyboardType="numeric" />

            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ المنتج'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  desc: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  qty: { fontSize: 18, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, textAlign: 'left' },
  rowTwo: { flexDirection: 'row' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});