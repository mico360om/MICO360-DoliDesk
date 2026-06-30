import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { colors } from '../lib/theme.js'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 24 }} numberOfLines={4}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: colors.brand, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
