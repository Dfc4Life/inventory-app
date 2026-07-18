import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../theme';

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>التقارير</Text>
        <Text style={styles.subtitle}>ملخص الأداء</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.comingSoon}>📊 سنضيف التقارير والرسوم البيانية لاحقاً</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.md + 4, paddingBottom: SPACING.lg },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#ccfbf1', fontSize: 13, marginTop: 2 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  comingSoon: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});