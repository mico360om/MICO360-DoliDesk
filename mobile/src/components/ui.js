import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, tones } from '../lib/theme.js'

export function Card({ children, style }) {
  return <View style={[layout.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>
}

export function StatusBadge({ label, tone = 'slate' }) {
  const t = tones[tone] || tones.slate
  return (
    <View style={[layout.badge, { backgroundColor: t.bg }]}>
      <Text style={[layout.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

export function Btn({ title, onPress, variant = 'primary', disabled, style }) {
  const v = {
    primary: { bg: colors.brand, fg: '#fff', bd: colors.brand },
    outline: { bg: colors.card, fg: colors.text, bd: colors.border },
    ghost: { bg: 'transparent', fg: colors.brand, bd: 'transparent' },
    danger: { bg: colors.danger, fg: '#fff', bd: colors.danger },
  }[variant]
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        layout.btn,
        { backgroundColor: v.bg, borderColor: v.bd, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[layout.btnText, { color: v.fg }]}>{title}</Text>
    </Pressable>
  )
}

export function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[layout.label, { color: colors.textMuted }]}>{label}</Text>
      {children}
      {hint ? <Text style={[layout.hint, { color: colors.textFaint }]}>{hint}</Text> : null}
    </View>
  )
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[layout.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }, props.style]}
    />
  )
}

export function Loading({ label }) {
  return (
    <View style={[layout.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.brand} />
      {label ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>{label}</Text> : null}
    </View>
  )
}

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <View style={layout.center}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <View style={[layout.center, { backgroundColor: colors.bg }]}>
      <Text style={{ fontSize: 32 }}>⚠️</Text>
      <Text style={{ color: colors.danger, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>{message}</Text>
      {onRetry ? <Btn title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: 14 }} /> : null}
    </View>
  )
}

// A thin banner shown when data is served from the offline cache.
export function OfflineBanner({ onRetry }) {
  return (
    <Pressable onPress={onRetry} style={{ backgroundColor: tones.amber.bg, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: tones.amber.fg, fontSize: 12, fontWeight: '600' }}>⚠ Offline — showing saved data</Text>
      {onRetry ? <Text style={{ color: tones.amber.fg, fontSize: 12, fontWeight: '700' }}>Retry</Text> : null}
    </Pressable>
  )
}

// Color-independent layout only — colors are applied inline above so they track
// the active theme (StyleSheet.create is evaluated once at import time).
const layout = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4 },
  hint: { fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
})
