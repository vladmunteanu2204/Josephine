import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import typography from '../theme/typography';

const FEATURES = [
  { icon: 'map', title: 'Offline Maps', description: 'Download all trails for offline access' },
  { icon: 'navigate', title: 'Voice Navigation', description: 'Turn-by-turn voice guidance on trails' },
  { icon: 'warning', title: 'Wrong Turn Alerts', description: 'Get notified when you go off-route' },
  { icon: 'sparkles', title: 'Unlimited AI Generation', description: 'Create unlimited custom trails' },
  { icon: 'share-social', title: 'Live Location Sharing', description: 'Share your location with trusted contacts' },
  { icon: 'eye-off', title: 'Hidden Gems', description: 'Access premium-only trail collections' },
];

export default function PremiumScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="star" size={48} color={colors.accent.primary} />
        </View>
        <Text style={styles.title}>Alpenvia Premium</Text>
        <Text style={styles.subtitle}>
          Unlock the full alpine experience
        </Text>
      </View>

      <View style={styles.plans}>
        <TouchableOpacity style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>Monthly</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>€9.99</Text>
              <Text style={styles.period}>/month</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.planCard, styles.recommendedPlan]}>
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>BEST VALUE</Text>
          </View>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>Yearly</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>€79.99</Text>
              <Text style={styles.period}>/year</Text>
            </View>
            <Text style={styles.savings}>Save 33%</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <Text style={styles.featuresTitle}>Premium Features</Text>
        {FEATURES.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={24} color={colors.accent.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.comparison}>
        <Text style={styles.comparisonTitle}>Feature Comparison</Text>
        <View style={styles.comparisonTable}>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Trail Catalog</Text>
            <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
            <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>AI Trail Generation (5/month)</Text>
            <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
            <Ionicons name="close-circle" size={24} color={colors.text.muted} />
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Offline Maps</Text>
            <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
            <Ionicons name="close-circle" size={24} color={colors.text.muted} />
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonFeature}>Voice Navigation</Text>
            <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
            <Ionicons name="close-circle" size={24} color={colors.text.muted} />
          </View>
        </View>
        <View style={styles.comparisonLabels}>
          <Text style={styles.comparisonLabel}>Premium</Text>
          <Text style={styles.comparisonLabel}>Free</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.trialButton}>
          <Text style={styles.trialButtonText}>Start 7-Day Free Trial</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Cancel anytime. No commitment required.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  plans: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recommendedPlan: {
    borderColor: colors.accent.primary,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    ...typography.small,
    color: '#fff',
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
  },
  planName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    ...typography.h1,
    color: colors.accent.primary,
  },
  period: {
    ...typography.body,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  savings: {
    ...typography.caption,
    color: colors.status.success,
    marginTop: 8,
    fontWeight: '600',
  },
  features: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  featuresTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  comparison: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  comparisonTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 16,
  },
  comparisonTable: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.elevated,
  },
  comparisonFeature: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  comparisonLabels: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingRight: 16,
  },
  comparisonLabel: {
    ...typography.caption,
    color: colors.text.muted,
    width: 24,
    textAlign: 'center',
    marginLeft: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  trialButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  trialButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  footerNote: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
