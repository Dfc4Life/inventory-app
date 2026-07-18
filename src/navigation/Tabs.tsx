import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import OperationsScreen from '../screens/OperationsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import ReportsScreen from '../screens/ReportsScreen';

export type RootTabParamList = {
  'الرئيسية': undefined; 'المخزون': undefined; 'عملية': undefined;
  'العملاء': undefined; 'التقارير': undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function Tabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.muted,
      tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tab.Screen name="الرئيسية" component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tab.Screen name="المخزون" component={InventoryScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="cube" size={24} color={color} /> }} />
      <Tab.Screen name="عملية" component={OperationsScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={26} color={color} /> }} />
      <Tab.Screen name="العملاء" component={CustomersScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} /> }} />
      <Tab.Screen name="التقارير" component={ReportsScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} /> }} />
    </Tab.Navigator>
  );
}