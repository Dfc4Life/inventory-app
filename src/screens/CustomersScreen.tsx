import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { COLORS, SPACING, formatIQD } from '../theme';
import { getCustomers } from '../db/database';
import type { Customer } from '../types';
import { useFocusEffect } from '@react-navigation/native';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setCustomers(await getCustomers()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const totalDebt = customers.reduce((s, c) => s + c.balance, 0);

  const renderItem = ({ item }: { item: Customer }) => {
    const inDebt = item.balance > 0;
    return (
      <View style={styles.item}>
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>العملاء والديون</Text>
        <Text style={styles.subtitle}>إجمالي الديون: {formatIQD(totalDebt)}</Text>
      </View>
      <FlatList
        data={customers} keyExtractor={(item) => item.id.toString()} renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.line }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>لا يوجد عملاء بعد</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.md + 4, paddingBottom: SPACING.lg },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
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
});