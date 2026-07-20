// src/screens/ReportsScreen.tsx
// التقارير — real dashboard with charts, live data, and backup

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, formatIQD, formatNumber } from '../theme';
import {
  getSalesStats, getDailySales, getTopProducts, getDebtSummary,
  exportDatabase, importDatabase, resetAllData,
} from '../db/database';
import type { SalesStats, DaySale, TopProduct, DebtSummary } from '../types';
import { isSyncConfigured, getLastSyncAt, syncNowVerbose, getConfigDiagnosis } from '../sync';

export default function ReportsScreen() {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [daily, setDaily] = useState<DaySale[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | 'reset' | null>(null);

  const load = useCallback(async () => {
    const [s, d, t, dbt] = await Promise.all([
      getSalesStats(), getDailySales(), getTopProducts(5), getDebtSummary(),
    ]);
    setStats(s); setDaily(d); setTop(t); setDebt(dbt);
  }, []);

  useFocusEffect(useCallback(() => { load(); setLastSync(getLastSyncAt()); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    // ----- تصدير نسخة احتياطية (Export backup) -----
  // يفتح منتقي المجلدات ليختار المستخدم مكان الحفظ (تجربة "حفظ باسم")
      const handleExport = async () => {
    try {
      setBusy('export');
      const path = await exportDatabase();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'احفظ النسخة الاحتياطية في ملفات أو تنزيلات أو Drive',
        });
      } else {
        Alert.alert('✅ تم', 'تم إنشاء النسخة الاحتياطية');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg) || /user/i.test(msg)) return;
      Alert.alert('خطأ في التصدير', msg);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    Alert.alert(
      'استعادة نسخة احتياطية',
      'سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة الاحتياطية. لا يمكن التراجع. متابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استعادة', style: 'destructive', onPress: async () => {
            try {
              setBusy('import');
              const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['*/*'] });
              if (result.canceled || !result.assets?.length) { setBusy(null); return; }
              await importDatabase(result.assets[0].uri);
              await load();
              Alert.alert('✅ تم', 'تمت الاستعادة بنجاح. يُفضّل إعادة تشغيل التطبيق للتأكد.');
            } catch (e) {
              Alert.alert('خطأ', 'تعذّرت الاستعادة. تأكد من اختيار ملف نسخة احتياطية صحيح.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };
    // ----- بدء من جديد (Fresh start — wipe all data) -----
  const handleReset = () => {
    Alert.alert(
      '⚠️ بدء من جديد',
      'سيتم حذف جميع المنتجات والعملاء والعمليات والديون نهائياً ولا يمكن التراجع.\n\nننصح بعمل نسخة احتياطية أولاً. هل تريد المتابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، احذف كل شيء',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy('reset');
              await resetAllData();
              await load();
              Alert.alert('✅ تم', 'تم حذف جميع البيانات. التطبيق جاهز لبدء جديد.');
            } catch (e) {
              Alert.alert('خطأ', 'تعذّر الحذف. حاول مرة أخرى.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };
     const handleTestSync = async () => {
    setBusy('reset');
    const result = await syncNowVerbose();
    setLastSync(getLastSyncAt());
    setBusy(null);
    Alert.alert(result.ok ? '✅ نجح' : '❌ فشل', 'تشخيص:\n' + getConfigDiagnosis() + '\n\nنتيجة المزامنة:\n' + result.message);
  };
  const maxDaily = Math.max(1, ...daily.map(d => d.total));
  const dayLabel = (dayStr: string): string => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(dayStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return days[d.getDay()];
  };
  const maxTop = Math.max(1, ...top.map(p => p.total_qty));

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
      <View style={styles.header}>
        <Text style={styles.title}>التقارير</Text>
        <Text style={styles.subtitle}>ملخص الأداء — آخر 7 أيام</Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.line, borderLeftWidth: 1 }]}>
          <Text style={[styles.summaryValue, { color: COLORS.green }]}>{stats ? formatIQD(stats.today) : '—'}</Text>
          <Text style={styles.summaryLabel}>مبيعات اليوم</Text>
          <Text style={styles.summarySub}>{stats?.todayCount ?? 0} عملية</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.blue, fontSize: 19 }]}>{stats ? formatIQD(stats.week) : '—'}</Text>
          <Text style={styles.summaryLabel}>مبيعات الأسبوع</Text>
          <Text style={styles.summarySub}>آخر 7 أيام</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 مبيعات آخر 7 أيام</Text>
        <View style={styles.chartRow}>
          {daily.map((d, i) => {
            const heightPct = (d.total / maxDaily) * 100;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(heightPct, d.total > 0 ? 6 : 0)}%`, backgroundColor: i === daily.length - 1 ? COLORS.primary : COLORS.green }]} />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>{dayLabel(d.day)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 أكثر المنتجات مبيعاً</Text>
        {top.length === 0 ? (
          <Text style={styles.emptyHint}>لا توجد مبيعات بعد</Text>
        ) : (
          top.map((p, i) => {
            const pct = (p.total_qty / maxTop) * 100;
            return (
              <View key={p.id} style={styles.topRow}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.barTrackH}>
                    <View style={[styles.barFillH, { width: `${pct}%`, backgroundColor: i === 0 ? COLORS.amber : COLORS.primary }]} />
                  </View>
                </View>
                <View style={styles.topRight}>
                  <Text style={styles.topQty}>{formatNumber(p.total_qty)}</Text>
                  <Text style={styles.topRevenue}>{formatIQD(p.total_revenue)}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 ملخص الديون</Text>
        <View style={styles.debtRow}>
          <Text style={styles.debtLabel}>إجمالي الديون المستحقة</Text>
          <Text style={[styles.debtValue, { color: COLORS.red }]}>{debt ? formatIQD(debt.totalDebt) : '—'}</Text>
        </View>
        <View style={[styles.debtRow, styles.debtRowBorder]}>
          <Text style={styles.debtLabel}>عدد العملاء المدينين</Text>
          <Text style={styles.debtValue}>{debt?.debtorsCount ?? 0}</Text>
        </View>
        <View style={[styles.debtRow, styles.debtRowBorder]}>
          <Text style={styles.debtLabel}>تسديدات هذا الأسبوع</Text>
          <Text style={[styles.debtValue, { color: COLORS.green }]}>{debt ? formatIQD(debt.weekPayments) : '—'}</Text>
        </View>
      </View>

      <View style={styles.allTimeCard}>
        <Ionicons name="trending-up" size={26} color="#ccfbf1" />
        <Text style={styles.allTimeLabel}>إجمالي المبيعات (تراكمي)</Text>
        <Text style={styles.allTimeValue}>{stats ? formatIQD(stats.allTime) : '—'}</Text>
      </View>

      {/* النسخ الاحتياطي — Backup card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💾 النسخ الاحتياطي</Text>
        <Text style={styles.backupDesc}>
  عند الضغط على "حفظ / مشاركة" ستظهر قائمة — اختر "حفظ في الملفات" أو "التنزيلات" أو Drive لإبقاء الملف على جهازك، أو شاركه مباشرة عبر واتساب/بريد.
</Text>
        <View style={styles.backupRow}>
          <Pressable style={[styles.backupBtn, { backgroundColor: COLORS.primary }, busy === 'export' && { opacity: 0.5 }]} onPress={handleExport} disabled={busy !== null}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.backupBtnText}>{busy === 'export' ? 'جارٍ...' : 'حفظ / مشاركة'}</Text>
          </Pressable>
          <Pressable style={[styles.backupBtn, { backgroundColor: COLORS.amber }, busy === 'import' && { opacity: 0.5 }]} onPress={handleImport} disabled={busy !== null}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.backupBtnText}>{busy === 'import' ? 'جارٍ...' : 'استيراد'}</Text>
          </Pressable>
        </View>
      </View>
      {/* منطقة الخطر — Danger zone (fresh start) */}
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: COLORS.red }]}>
        <Text style={styles.cardTitle}>🗑️ بدء من جديد</Text>
        <Text style={styles.backupDesc}>
          يحذف جميع المنتجات والعملاء والعمليات والديون نهائياً لتبدأ بقاعدة بيانات فارغة. استخدمها فقط إذا كنت متأكداً تماماً.
        </Text>
        <Pressable
          style={[styles.resetBtn, busy === 'reset' && { opacity: 0.5 }]}
          onPress={handleReset}
          disabled={busy !== null}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.backupBtnText}>{busy === 'reset' ? 'جارٍ...' : 'حذف جميع البيانات'}</Text>
        </Pressable>
      </View>
            <Text style={styles.footer}>
        {isSyncConfigured()
          ? lastSync
            ? `☁️ آخر نسخة سحابية: ${lastSync.toLocaleTimeString('en-GB').slice(0,5)} • 📊 اسحب للتحديث`
            : '☁️ المزامنة السحابية مُفعّلة • 📊 اسحب للتحديث'
          : '📊 اسحب للأسفل لتحديث البيانات'}
      </Text>
                    <Pressable
          style={[styles.testSyncBtn, busy === 'reset' && { opacity: 0.5 }]}
          onPress={handleTestSync}
          disabled={busy !== null}
        >
          <Ionicons name="cloud-done-outline" size={18} color={COLORS.primary} />
          <Text style={styles.testSyncText}>اختبر المزامنة السحابية</Text>
        </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.md + 4, paddingBottom: SPACING.lg },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
  summaryGrid: { flexDirection: 'row' },
  summaryCard: { width: '50%', padding: SPACING.md, backgroundColor: COLORS.card },
  summaryValue: { fontSize: 17, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  summarySub: { fontSize: 10, color: COLORS.muted, marginTop: 1 },
  card: { backgroundColor: COLORS.card, margin: SPACING.md, marginBottom: 0, borderRadius: 16, padding: SPACING.md },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  chartRow: { flexDirection: 'row', height: 130, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: 18, height: '80%', justifyContent: 'flex-end', marginRight: 4 },
  barFill: { width: '100%', borderRadius: 6, minHeight: 2 },
  barLabel: { fontSize: 9, color: COLORS.muted, marginTop: 6, fontWeight: '600' },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  rank: { fontSize: 12, fontWeight: '800', color: COLORS.muted, width: 24 },
  topName: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 5 },
  barTrackH: { height: 8, backgroundColor: COLORS.line, borderRadius: 999, overflow: 'hidden' },
  barFillH: { height: '100%', borderRadius: 999 },
  topRight: { alignItems: 'flex-end', minWidth: 70 },
  topQty: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  topRevenue: { fontSize: 10, color: COLORS.muted, marginTop: 1 },
  debtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  debtRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.line },
  debtLabel: { fontSize: 13, color: COLORS.muted },
  debtValue: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  allTimeCard: { backgroundColor: COLORS.primaryDark, margin: SPACING.md, marginBottom: 0, borderRadius: 16, padding: SPACING.lg, alignItems: 'center' },
  allTimeLabel: { color: '#ccfbf1', fontSize: 13, marginTop: 6 },
  allTimeValue: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  backupDesc: { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginBottom: SPACING.md },
  backupRow: { flexDirection: 'row', gap: 10 },
  backupBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13 },
  backupBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  footer: { textAlign: 'center', color: COLORS.muted, fontSize: 11, marginTop: SPACING.lg, marginBottom: SPACING.lg },
    resetBtn: { backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
      testSyncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 11, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12 },
  testSyncText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
});