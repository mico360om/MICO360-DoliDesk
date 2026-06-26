import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, tones } from '../lib/theme.js'

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function StatusBadge({ label, tone = 'slate' }) {
  const t = tones[tone] || tones.slate
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

export function Btn({ title, onPress, variant = 'primary', disabled, style }) {
  const v = {
    primary: { bg: colors.brand, fg: '#fff', bd: colors.brand },
    outline: { bg: '#fff', fg: colors.text, bd: colors.border },
    ghost: { bg: 'transparent', fg: colors.brand, bd: 'transparent' },
    danger: { bg: '#dc2626', fg: '#fff', bd: '#dc2626' },
  }[variant]
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.bd, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: v.fg }]}>{title}</Text>
    </Pressable>
  )
}

export function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

export function Input(props) {
  return <TextInput placeholderTextColor={colors.textFaint} {...props} style={[styles.input, props.style]} />
}

export function Loading({ label }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
      {label ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>{label}</Text> : null}
    </View>
  )
}

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 32 }}>⚠️</Text>
      <Text style={{ color: '#b91c1c', marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>{message}</Text>
      {onRetry ? <Btn title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: 14 }} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.4 },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
})
