import React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { colors } from '../lib/theme.js'
import { ENTITY_LIST } from '../lib/entities.js'

export default function RecordsScreen({ navigation }) {
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={ENTITY_LIST}
      keyExtractor={(e) => e.key}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate('RecordList', { type: item.key, title: item.label })}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 14,
            backgroundColor: pressed ? colors.subtle : colors.card,
            borderRadius: 14, borderWidth: 1, borderColor: colors.border,
            padding: 16, marginBottom: 10,
          })}
        >
          <Text style={{ fontSize: 24 }}>{item.icon}</Text>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text }}>{item.label}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
        </Pressable>
      )}
    />
  )
}
