import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ProfileForm from '../components/ProfileForm.js'
import { Card } from '../components/ui.js'
import { colors } from '../lib/theme.js'

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>M</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 12 }}>MICO360 DoliDesk</Text>
            <Text style={{ color: '#fecaca', marginTop: 4 }}>Connect your Dolibarr account</Text>
          </View>
          <Card>
            <ProfileForm />
          </Card>
          <Text style={{ color: '#fecaca', textAlign: 'center', marginTop: 16, fontSize: 12 }}>
            Your API key is stored in the device’s secure keystore and never leaves this device.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
