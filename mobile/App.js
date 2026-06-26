import React from 'react'
import { Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { ProfileProvider, useProfiles } from './src/context/ProfileContext.js'
import { colors } from './src/lib/theme.js'
import { Loading } from './src/components/ui.js'
import OnboardingScreen from './src/screens/OnboardingScreen.js'
import DashboardScreen from './src/screens/DashboardScreen.js'
import RecordsScreen from './src/screens/RecordsScreen.js'
import RecordListScreen from './src/screens/RecordListScreen.js'
import RecordDetailScreen from './src/screens/RecordDetailScreen.js'
import ProfilesScreen from './src/screens/ProfilesScreen.js'
import SettingsScreen from './src/screens/SettingsScreen.js'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.bg, card: '#fff', text: colors.text, border: colors.border },
}
const headerOpts = { headerStyle: { backgroundColor: '#fff' }, headerTitleStyle: { color: colors.text }, headerTintColor: colors.brand }

function tabIcon(emoji) {
  return ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
}

function RecordsStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="RecordsHome" component={RecordsScreen} options={{ title: 'Records' }} />
      <Stack.Screen name="RecordList" component={RecordListScreen} options={{ title: 'Records' }} />
      <Stack.Screen name="RecordDetail" component={RecordDetailScreen} options={{ title: 'Details' }} />
    </Stack.Navigator>
  )
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOpts,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('📊') }} />
      <Tab.Screen name="Records" component={RecordsStack} options={{ headerShown: false, tabBarIcon: tabIcon('🗂️') }} />
      <Tab.Screen name="Profiles" component={ProfilesScreen} options={{ tabBarIcon: tabIcon('👤') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: tabIcon('⚙️') }} />
    </Tab.Navigator>
  )
}

function Root() {
  const { loading, hasProfiles } = useProfiles()
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }}><Loading label="Starting MICO360 DoliDesk…" /></View>
  }
  if (!hasProfiles) return <OnboardingScreen />
  return <Tabs />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </ProfileProvider>
    </SafeAreaProvider>
  )
}
