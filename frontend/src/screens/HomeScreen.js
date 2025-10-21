import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CTACard from '../components/CTACard';
import TrailCard from '../components/TrailCard';
import { trailsApi } from '../services/api';
import colors from '../theme/colors';
import typography from '../theme/typography';

export default function HomeScreen({ navigation }) {
  const [recommendedTrail, setRecommendedTrail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    try {
      setLoading(true);
      const recommendations = await trailsApi.getRecommendations(
        { skill_level: 'intermediate', interests: ['panoramic views'] },
        {}
      );
      setRecommendedTrail(recommendations);
    } catch (error) {
      console.error('Error loading recommendation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.subtitle}>Ready for your next adventure?</Text>
        </View>
        <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadRecommendation}
            tintColor={colors.accent.primary}
          />
        }
      >
        <View style={styles.ctaSection}>
          <CTACard
            title="Generate a Trail"
            subtitle="AI-powered custom routes"
            icon="sparkles"
            imageUrl="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"
            gradientColors={['rgba(61, 112, 104, 0.9)', 'rgba(45, 74, 62, 0.9)']}
            onPress={() => navigation.navigate('AIGenerator')}
          />
          
          <CTACard
            title="Explore Hikes"
            subtitle="Curated alpine collections"
            icon="compass"
            imageUrl="https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800"
            gradientColors={['rgba(74, 124, 158, 0.9)', 'rgba(45, 74, 94, 0.9)']}
            onPress={() => navigation.navigate('Explore')}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Recommended Trail</Text>
            <Ionicons name="refresh" size={20} color={colors.accent.primary} />
          </View>
          
          {recommendedTrail ? (
            <TrailCard
              trail={recommendedTrail}
              onPress={() => navigation.navigate('TrailDetail', { trail: recommendedTrail })}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="compass-outline" size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>Loading recommendation...</Text>
            </View>
          )}
        </View>

        <View style={styles.premiumBanner}>
          <View style={styles.premiumContent}>
            <Ionicons name="star" size={32} color={colors.accent.primary} />
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
              <Text style={styles.premiumSubtitle}>Offline maps, voice navigation & more</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.premiumButton}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={styles.premiumButtonText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  greeting: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  ctaSection: {
    paddingHorizontal: 24,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: 16,
  },
  premiumBanner: {
    margin: 24,
    padding: 20,
    backgroundColor: colors.background.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumText: {
    flex: 1,
    marginLeft: 16,
  },
  premiumTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  premiumSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
  },
  premiumButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  premiumButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
