import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { Input } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { ENTITY_LIST } from '../lib/entities.js'

export default function RecordsScreen({ navigation }) {
  const [query, setQuery] = useState('')
  const data = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ENTITY_LIST.filter((e) => e.label.toLowerCase().includes(q)) : ENTITY_LIST
  }, [query])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Input placeholder="Search record types…" value={query} onChangeText={setQuery} autoCapitalize="none" />
      </View>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16 }}
        data={data}
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
    </View>
  )
}
