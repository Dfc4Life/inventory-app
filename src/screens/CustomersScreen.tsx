// src/screens/CustomersScreen.tsx
// العملاء والديون — customer list + detail modal with payment recording

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatDate } from '../theme';
import { getCustomers, getCustomerById, getCustomerActivity, addCustomer, recordPayment, getUsers, deleteCustomer } from '../db/database';
import type { Customer, ActivityEntry } from '../types';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => setCustomers(await getCustomers()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalDebt = customers.reduce((s, c) => s + c.balance, 0);
  const resetForm = () => { setName(''); setPhone(''); };
  const closeForm = () => { setShowAdd(false); resetForm(); };

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert('تنبيه', 'الرجاء إدخال اسم العميل'); return; }
    setSaving(true);
    try {
      await addCustomer(name.trim(), phone.trim());
      await load();
      closeForm();
      Alert.alert('✅ تم', 'تمت إضافة العميل بنجاح');
    } catch (e) {
      Alert.alert('خطأ', 'تعذّرت الإضافة. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (c: Customer) => {
    setDetail(c);
    setActivity([]);
    setPayAmount('');
    setShowDetail(true);
    setActivity(await getCustomerActivity(c.id));
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const updated = await getCustomerById(detail.id);
    if (updated) setDetail(updated);
    setActivity(await getCustomerActivity(detail.id));
  };

  const handlePay = async () => {
    if (!detail) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'الرجاء إدخال مبلغ صحيح');
      return;
    }
    setPaying(true);
    try {
      const users = await getUsers();
      const userId = users[0]?.id ?? 1;
      await recordPayment(detail.id, amount, userId);
      setPayAmount('');
      await refreshDetail();
      await load();
      Alert.alert('✅ تم', 'تم تسجيل الدفعة وتحديث الرصيد');
    } catch (e) {
      Alert.alert('خطأ', 'تعذّر تسجيل الدفعة. حاول مرة أخرى.');
    } finally {
      setPaying(false);
    }
  };
  const handleDelete = () => {
  if (!detail) return;
  const hasDebt = detail.balance > 0;
  const hasActivity = activity.length > 0;
  const msg = hasDebt
    ? `⚠️ هذا العميل عليه دين بمبلغ ${formatIQD(detail.balance)}.\n\nسيتم حذف العميل وسجل دفعاته نهائياً. سجلات المبيعات تبقى محفوظة في التقارير. هل أنت متأكد؟`
    : hasActivity
      ? 'سيتم حذف العميل وسجل دفعاته نهائياً. سجلات المبيعات تبقى محفوظة في التقارير. هل أنت متأكد؟'
      : 'هل أنت متأكد من حذف هذا العميل؟';
  Alert.alert(
    'حذف العميل',
    msg,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          try {
            await deleteCustomer(detail.id);
            setShowDetail(false);
            await load();
            Alert.alert('✅ تم', 'تم حذف العميل');
          } catch (e) {
            Alert.alert('خطأ', 'تعذّر الحذف. حاول مرة أخرى.');
          }
        },
      },
    ],
  );
};

  const renderItem = ({ item }: { item: Customer }) => {
    const inDebt = item.balance > 0;
    return (
      <Pressable style={styles.item} onPress={() => openDetail(item)}>
        <View style={[styles.avatar, { backgroundColor: inDebt ? COLORS.blue : COLORS.green }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>{item.phone || 'بدون رقم'}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amt, { color: inDebt ? COLORS.red : COLORS.green }]}>{formatIQD(item.balance)}</Text>
          <Text style={[styles.badge, { color: inDebt ? COLORS.red : COLORS.green }]}>{inDebt ? 'عليه دين' : 'مسدّد'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>العملاء والديون</Text>
            <Text style={styles.subtitle}>إجمالي الديون: {formatIQD(totalDebt)}</Text>
          </View>
          <Pressable style={styles.addHeaderBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.line }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>لا يوجد عملاء بعد</Text>}
      />

      {/* ADD CUSTOMER MODAL */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إضافة عميل جديد</Text>
              <Pressable onPress={closeForm}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>
            <Text style={styles.fieldLabel}>اسم العميل</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="مثال: محمد العلي" placeholderTextColor={COLORS.muted} />
            <Text style={styles.fieldLabel}>رقم الهاتف</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="0770xxxxxxxx" placeholderTextColor={COLORS.muted} keyboardType="phone-pad" />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ العميل'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CUSTOMER DETAIL MODAL */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detail?.name}</Text>
              <Pressable onPress={() => setShowDetail(false)}><Ionicons name="close" size={24} color={COLORS.muted} /></Pressable>
            </View>

            <ScrollView style={{ maxHeight: '85%' }} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.debtCard}>
                <Text style={styles.debtLabel}>الرصيد المستحق</Text>
                <Text style={[styles.debtValue, { color: (detail?.balance ?? 0) > 0 ? COLORS.red : COLORS.green }]}>
                  {formatIQD(detail?.balance ?? 0)}
                </Text>
                {detail?.phone ? <Text style={styles.debtPhone}>📞 {detail.phone}</Text> : null}
              </View>

              <Text style={styles.fieldLabel}>تسجيل دفعة سداد</Text>
              <View style={styles.payRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="المبلغ"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="numeric"
                />
                <Pressable
                  style={[styles.payBtn, paying && { opacity: 0.5 }]}
                  onPress={handlePay}
                  disabled={paying}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.payBtnText}>سجّل</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>سجل المعاملات ({activity.length})</Text>
              {activity.length === 0 ? (
                <Text style={styles.emptyHint}>لا توجد معاملات بعد</Text>
              ) : (
                activity.map(a => (
                  <View key={a.key} style={styles.activityRow}>
                    <View style={[styles.actDot, { backgroundColor: a.kind === 'sale' ? COLORS.red : COLORS.green }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actLabel}>{a.kind === 'sale' ? 'شراء آجل' : 'دفعة سداد'}</Text>
                      <Text style={styles.actDate}>{formatDate(a.created_at)}</Text>
                    </View>
                    <Text style={[styles.actAmount, { color: a.kind === 'sale' ? COLORS.red : COLORS.green }]}>
                      {a.kind === 'sale' ? '+' : '−'} {formatIQD(a.amount)}
                    </Text>
                  </View>
                ))
              )}
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.deleteBtnText}>حذف العميل</Text>
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
  desc: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amt: { fontSize: 14, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 36 },
  detailCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 36, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, textAlign: 'left' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  debtCard: { backgroundColor: COLORS.background, borderRadius: 16, padding: 18, alignItems: 'center' },
  debtLabel: { fontSize: 13, color: COLORS.muted },
  debtValue: { fontSize: 28, fontWeight: '800', marginVertical: 6 },
  debtPhone: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  payRow: { flexDirection: 'row', gap: 8 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.green, borderRadius: 12, paddingHorizontal: 22 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginVertical: SPACING.sm },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  actDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  actLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  actDate: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  actAmount: { fontSize: 13, fontWeight: '800' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.red, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)' },
deleteBtnText: { color: COLORS.red, fontWeight: '700', fontSize: 14 },
});