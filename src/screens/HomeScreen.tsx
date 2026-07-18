import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { COLORS, SPACING, formatIQD } from '../theme';
import { getDashboardStats } from '../db/database';
import { useFocusEffect } from '@react-navigation/native';


export default function HomeScreen() {
  const [stats, setStats] = useState({ productCount: 0, lowStock: 0, totalDebt: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setStats(await getDashboardStats()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
      <View style={styles.header}>
        <Text style={styles.storeName}>متجر الأمل</Text>
        <Text style={styles.welcome}>مرحباً 👋</Text>
      </View>
      <View style={styles.grid}>
        <View style={[styles.card, { borderLeftColor: COLORS.line, borderLeftWidth: 1 }]}>
          <Text style={[styles.bigNum, { color: COLORS.green }]}>{stats.productCount}</Text>
          <Text style={styles.cardLabel}>عدد المنتجات</Text>
        </View>
        <View style={styles.card}>
          <Text style={[styles.bigNum, { color: COLORS.amber }]}>{stats.lowStock}</Text>
          <Text style={styles.cardLabel}>تنبيهات مخزون منخفض</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: COLORS.line, borderLeftWidth: 1 }]}>
          <Text style={[styles.bigNum, { color: COLORS.red, fontSize: 20 }]}>{formatIQD(stats.totalDebt)}</Text>
          <Text style={styles.cardLabel}>إجمالي ديون العملاء</Text>
        </View>
        <View style={styles.card}>
          <Text style={[styles.bigNum, { color: COLORS.blue }]}>—</Text>
          <Text style={styles.cardLabel}>مبيعات اليوم</Text>
        </View>
      </View>
      <Text style={styles.note}>💡 اسحب الشاشة للأسفل لتحديث البيانات</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.md + 4, paddingBottom: SPACING.lg },
  storeName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  welcome: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: '50%', padding: SPACING.md, backgroundColor: COLORS.card },
  bigNum: { fontSize: 26, fontWeight: '800' },
  cardLabel: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  note: { textAlign: 'center', color: COLORS.muted, fontSize: 11, marginTop: SPACING.md },
});