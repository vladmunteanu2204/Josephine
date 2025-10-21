import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import colors from '../theme/colors';
import typography from '../theme/typography';

const { width } = Dimensions.get('window');

export default function TrailDetailScreen({ route, navigation }) {
  const { trail } = route.params;

  const elevationData = {
    labels: ['Start', '25%', '50%', '75%', 'End'],
    datasets: [{
      data: [1500, 1750, 2100, 1950, 1500],
    }],
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: trail.image_url }} style={styles.heroImage} />
      
      <View style={styles.content}>
        <Text style={styles.title}>{trail.name}</Text>
        <Text style={styles.region}>{trail.region}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="walk" size={24} color={colors.accent.primary} />
            <Text style={styles.statValue}>{trail.distance_km} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={colors.accent.primary} />
            <Text style={styles.statValue}>{trail.duration_hours}h</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={24} color={colors.accent.primary} />
            <Text style={styles.statValue}>{trail.elevation_gain_m}m</Text>
            <Text style={styles.statLabel}>Elevation</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.difficultyDot, { backgroundColor: colors.difficulty[trail.difficulty.toLowerCase()] }]} />
            <Text style={styles.statValue}>{trail.difficulty}</Text>
            <Text style={styles.statLabel}>Difficulty</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{trail.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elevation Profile</Text>
          <LineChart
            data={elevationData}
            width={width - 48}
            height={200}
            chartConfig={{
              backgroundColor: colors.background.card,
              backgroundGradientFrom: colors.background.card,
              backgroundGradientTo: colors.background.elevated,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(212, 165, 116, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(168, 168, 168, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.accent.primary,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {trail.pois && trail.pois.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Points of Interest</Text>
            {trail.pois.map((poi, index) => (
              <View key={index} style={styles.poiCard}>
                <Ionicons
                  name={
                    poi.type === 'viewpoint' ? 'eye' :
                    poi.type === 'lake' ? 'water' :
                    poi.type === 'cabin' ? 'home' :
                    'location'
                  }
                  size={24}
                  color={colors.accent.primary}
                />
                <View style={styles.poiContent}>
                  <Text style={styles.poiName}>{poi.name}</Text>
                  {poi.description && (
                    <Text style={styles.poiDescription}>{poi.description}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Start Trail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
            <Ionicons name="bookmark-outline" size={20} color={colors.accent.primary} />
            <Text style={styles.secondaryButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.offlineButton}>
          <Ionicons name="download-outline" size={20} color={colors.text.secondary} />
          <Text style={styles.offlineText}>Download for Offline</Text>
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={12} color={colors.accent.primary} />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  heroImage: {
    width: '100%',
    height: 300,
  },
  content: {
    padding: 24,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 4,
  },
  region: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.background.card,
    padding: 16,
    borderRadius: 12,
    margin: '1%',
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
  },
  difficultyDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 16,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  poiCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  poiContent: {
    flex: 1,
    marginLeft: 16,
  },
  poiName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  poiDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent.primary,
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: colors.background.card,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  primaryButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.accent.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  offlineButton: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    ...typography.body,
    color: colors.text.secondary,
    marginLeft: 8,
    marginRight: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  premiumText: {
    ...typography.small,
    color: colors.accent.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
});
