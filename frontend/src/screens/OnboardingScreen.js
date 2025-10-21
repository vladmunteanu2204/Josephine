import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import colors from '../theme/colors';
import typography from '../theme/typography';

const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'];
const INTERESTS = [
  { id: 'alpine lakes', icon: '💧', label: 'Alpine Lakes' },
  { id: 'panoramic views', icon: '🏔️', label: 'Panoramic Views' },
  { id: 'forests', icon: '🌲', label: 'Forests' },
  { id: 'via ferrata', icon: '🧗', label: 'Via Ferrata' },
  { id: 'cultural routes', icon: '🏛️', label: 'Cultural Routes' },
];

export default function OnboardingScreen({ onComplete }) {
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [selectedInterests, setSelectedInterests] = useState([]);

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleComplete = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        skillLevel,
        interests: selectedInterests,
        createdAt: new Date().toISOString(),
      });
      onComplete();
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Alpenvia! 🏔️</Text>
      <Text style={styles.subtitle}>Let's personalize your hiking experience</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What's your hiking skill level?</Text>
        <View style={styles.optionsRow}>
          {SKILL_LEVELS.map(level => (
            <TouchableOpacity
              key={level}
              style={[
                styles.skillButton,
                skillLevel === level && styles.skillButtonSelected
              ]}
              onPress={() => setSkillLevel(level)}
            >
              <Text style={[
                styles.skillButtonText,
                skillLevel === level && styles.skillButtonTextSelected
              ]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What interests you most?</Text>
        <Text style={styles.sectionSubtitle}>Select all that apply</Text>
        <View style={styles.interestsGrid}>
          {INTERESTS.map(interest => (
            <TouchableOpacity
              key={interest.id}
              style={[
                styles.interestCard,
                selectedInterests.includes(interest.id) && styles.interestCardSelected
              ]}
              onPress={() => toggleInterest(interest.id)}
            >
              <Text style={styles.interestIcon}>{interest.icon}</Text>
              <Text style={[
                styles.interestLabel,
                selectedInterests.includes(interest.id) && styles.interestLabelSelected
              ]}>
                {interest.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.button, selectedInterests.length === 0 && styles.buttonDisabled]}
        onPress={handleComplete}
        disabled={selectedInterests.length === 0}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skillButton: {
    flex: 1,
    backgroundColor: colors.background.card,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  skillButtonSelected: {
    backgroundColor: colors.accent.primary,
  },
  skillButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  skillButtonTextSelected: {
    color: '#fff',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  interestCard: {
    width: '48%',
    backgroundColor: colors.background.card,
    padding: 20,
    borderRadius: 12,
    margin: '1%',
    alignItems: 'center',
  },
  interestCardSelected: {
    backgroundColor: colors.accent.forest,
    borderColor: colors.accent.primary,
    borderWidth: 2,
  },
  interestIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  interestLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  interestLabelSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
