import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Slider } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trailsApi } from '../services/api';
import TrailCard from '../components/TrailCard';
import colors from '../theme/colors';
import typography from '../theme/typography';

const INTERESTS = [
  { id: 'alpine lakes', icon: '💧', label: 'Lakes' },
  { id: 'panoramic views', icon: '🏔️', label: 'Views' },
  { id: 'via ferrata', icon: '🧗', label: 'Via Ferrata' },
  { id: 'forests', icon: '🌲', label: 'Forests' },
  { id: 'cultural routes', icon: '🏛️', label: 'Cultural' },
];

export default function AIGeneratorScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [duration, setDuration] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [location, setLocation] = useState('Bolzano');
  const [generatedTrail, setGeneratedTrail] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const trail = await trailsApi.generateTrail({
        duration,
        difficulty,
        interests: selectedInterests,
        starting_area: location,
      });
      setGeneratedTrail(trail);
      setStep(4);
    } catch (error) {
      console.error('Error generating trail:', error);
      alert('Failed to generate trail. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setDuration(3);
    setDifficulty('medium');
    setSelectedInterests([]);
    setLocation('Bolzano');
    setGeneratedTrail(null);
  };

  if (step === 4 && generatedTrail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetWizard}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Your Custom Trail</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView>
          <View style={styles.resultSection}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={32} color={colors.accent.primary} />
              <Text style={styles.aiTitle}>AI Generated Trail</Text>
            </View>
            <TrailCard
              trail={generatedTrail}
              onPress={() => navigation.navigate('TrailDetail', { trail: generatedTrail })}
            />
            <TouchableOpacity style={styles.button} onPress={resetWizard}>
              <Text style={styles.buttonText}>Generate Another Trail</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : null}>
          <Ionicons name="arrow-back" size={24} color={step > 1 ? colors.text.primary : colors.background.card} />
        </TouchableOpacity>
        <Text style={styles.title}>AI Trail Generator</Text>
        <Text style={styles.stepIndicator}>Step {step}/3</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {step === 1 && (
          <View>
            <Text style={styles.question}>How long do you want to hike?</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{duration} hours</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={8}
                step={0.5}
                value={duration}
                onValueChange={setDuration}
                minimumTrackTintColor={colors.accent.primary}
                maximumTrackTintColor={colors.background.elevated}
                thumbTintColor={colors.accent.primary}
              />
            </View>

            <Text style={styles.question}>What difficulty?</Text>
            <View style={styles.optionsRow}>
              {['easy', 'medium', 'hard'].map(diff => (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.optionButton,
                    difficulty === diff && styles.optionButtonSelected
                  ]}
                  onPress={() => setDifficulty(diff)}
                >
                  <Text style={[
                    styles.optionText,
                    difficulty === diff && styles.optionTextSelected
                  ]}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.question}>What interests you?</Text>
            <Text style={styles.hint}>Select all that apply</Text>
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
        )}

        {step === 3 && (
          <View>
            <Text style={styles.question}>Where do you want to start?</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter location (e.g., Bolzano)"
              placeholderTextColor={colors.text.muted}
              value={location}
              onChangeText={setLocation}
            />

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Trail Summary:</Text>
              <Text style={styles.summaryText}>• Duration: {duration} hours</Text>
              <Text style={styles.summaryText}>• Difficulty: {difficulty}</Text>
              <Text style={styles.summaryText}>• Interests: {selectedInterests.join(', ') || 'None selected'}</Text>
              <Text style={styles.summaryText}>• Starting from: {location}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step < 3 ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => setStep(step + 1)}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={loading}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={[styles.buttonText, { marginLeft: 8 }]}>
              {loading ? 'Generating...' : 'Generate Trail'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  stepIndicator: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  question: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 8,
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  sliderContainer: {
    marginBottom: 40,
  },
  sliderValue: {
    ...typography.h2,
    color: colors.accent.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.background.card,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: colors.accent.primary,
  },
  optionText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  optionTextSelected: {
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
  input: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: 32,
  },
  summary: {
    backgroundColor: colors.background.card,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.primary,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 12,
  },
  summaryText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.accent.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  resultSection: {
    padding: 24,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  aiTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginLeft: 12,
  },
});
