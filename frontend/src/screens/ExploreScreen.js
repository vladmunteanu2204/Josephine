import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrailCard from '../components/TrailCard';
import { trailsApi } from '../services/api';
import colors from '../theme/colors';
import typography from '../theme/typography';

const COLLECTIONS = [
  { id: 'lakes', title: 'Alpine Lakes', icon: '💧', interest: 'alpine lakes' },
  { id: 'family', title: 'Family-Friendly', icon: '👨‍👩‍👧‍👦', difficulty: 'easy' },
  { id: 'ferrata', title: 'Via Ferrata', icon: '🧗', interest: 'via ferrata' },
  { id: 'ridge', title: 'Ridge Trails', icon: '🏔️', interest: 'panoramic views' },
  { id: 'cultural', title: 'Cultural Routes', icon: '🏛️', interest: 'cultural routes' },
];

export default function ExploreScreen({ navigation }) {
  const [trails, setTrails] = useState([]);
  const [filteredTrails, setFilteredTrails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  useEffect(() => {
    loadTrails();
  }, []);

  const loadTrails = async () => {
    try {
      const data = await trailsApi.getAllTrails();
      setTrails(data.trails);
      setFilteredTrails(data.trails);
    } catch (error) {
      console.error('Error loading trails:', error);
    }
  };

  const filterByCollection = async (collection) => {
    try {
      const filters = {};
      if (collection.difficulty) filters.difficulty = collection.difficulty;
      if (collection.interest) filters.interest = collection.interest;
      
      const data = await trailsApi.getAllTrails(filters);
      setFilteredTrails(data.trails);
    } catch (error) {
      console.error('Error filtering trails:', error);
    }
  };

  const filterByDifficulty = (difficulty) => {
    setSelectedDifficulty(difficulty);
    if (difficulty) {
      setFilteredTrails(trails.filter(t => t.difficulty.toLowerCase() === difficulty.toLowerCase()));
    } else {
      setFilteredTrails(trails);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Hikes</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trails..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collections</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collections}>
            {COLLECTIONS.map(collection => (
              <TouchableOpacity
                key={collection.id}
                style={styles.collectionCard}
                onPress={() => filterByCollection(collection)}
              >
                <Text style={styles.collectionIcon}>{collection.icon}</Text>
                <Text style={styles.collectionTitle}>{collection.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Filter</Text>
          <View style={styles.filterRow}>
            {['all', 'easy', 'medium', 'hard'].map(diff => (
              <TouchableOpacity
                key={diff}
                style={[
                  styles.filterChip,
                  (diff === 'all' ? !selectedDifficulty : selectedDifficulty === diff) && styles.filterChipActive
                ]}
                onPress={() => filterByDifficulty(diff === 'all' ? null : diff)}
              >
                <Text style={[
                  styles.filterChipText,
                  (diff === 'all' ? !selectedDifficulty : selectedDifficulty === diff) && styles.filterChipTextActive
                ]}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Trails ({filteredTrails.length})</Text>
          {filteredTrails.map(trail => (
            <TrailCard
              key={trail.id}
              trail={trail}
              onPress={() => navigation.navigate('TrailDetail', { trail })}
            />
          ))}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: colors.text.primary,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  collections: {
    paddingLeft: 24,
  },
  collectionCard: {
    width: 120,
    height: 140,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  collectionTitle: {
    ...typography.caption,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background.card,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.accent.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
});
