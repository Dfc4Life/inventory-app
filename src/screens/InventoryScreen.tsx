import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { COLORS, SPACING, formatIQD, formatNumber } from '../theme';
import { useFocusEffect } from '@react-navigation/native';
import { getProducts } from '../db/database';
import type { Product } from '../types';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setProducts(await getProducts()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const statusBadge = (p: Product) => {
    if (p.current_stock <= 0) return { text: 'نفد', color: COLORS.red };
    if (p.current_stock <= p.low_stock_threshold) return { text: 'منخفض', color: COLORS.amber };
    return { text: 'متوفر', color: COLORS.green };
  };

  const renderItem = ({ item }: { item: Product }) => {
    const badge = statusBadge(item);
    return (
      <View style={styles.item}>
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>المخزون</Text>
        <Text style={styles.subtitle}>{products.length} منتج</Text>
      </View>
      <FlatList
        data={products} keyExtractor={(item) => item.id.toString()} renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.line }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد منتجات بعد</Text>}
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
  qty: { fontSize: 18, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },
});