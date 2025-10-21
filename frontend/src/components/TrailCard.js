import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import typography from '../theme/typography';

export default function TrailCard({ trail, onPress }) {
  const getDifficultyColor = (difficulty) => {
    return colors.difficulty[difficulty.toLowerCase()] || colors.text.secondary;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image 
        source={{ uri: trail.image_url }} 
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.overlay} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{trail.name}</Text>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(trail.difficulty) }]}>
            <Text style={styles.difficultyText}>{trail.difficulty}</Text>
          </View>
        </View>

        <Text style={styles.region}>{trail.region}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="walk-outline" size={16} color={colors.accent.primary} />
            <Text style={styles.statText}>{trail.distance_km} km</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color={colors.accent.primary} />
            <Text style={styles.statText}>{trail.duration_hours}h</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="trending-up-outline" size={16} color={colors.accent.primary} />
            <Text style={styles.statText}>{trail.elevation_gain_m}m</Text>
          </View>
          {trail.rating && (
            <View style={styles.stat}>
              <Ionicons name="star" size={16} color={colors.accent.primary} />
              <Text style={styles.statText}>{trail.rating}</Text>
            </View>
          )}
        </View>

        {trail.trail_type && (
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{trail.trail_type}</Text>
            </View>
            {trail.generated && (
              <View style={[styles.badge, styles.aiBadge]}>
                <Ionicons name="sparkles" size={12} color={colors.accent.primary} />
                <Text style={styles.badgeText}>AI Generated</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  image: {
    width: '100%',
    height: 200,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    height: 200,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  region: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  statText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  aiBadge: {
    backgroundColor: colors.accent.forest,
  },
  badgeText: {
    ...typography.small,
    color: colors.text.secondary,
    marginLeft: 2,
    textTransform: 'capitalize',
  },
});
