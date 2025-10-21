import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import colors from '../theme/colors';
import typography from '../theme/typography';

export default function ProfileScreen({ navigation }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={colors.accent.primary} />
        </View>
        <Text style={styles.name}>{auth.currentUser?.email}</Text>
        <TouchableOpacity style={styles.premiumBadge}>
          <Ionicons name="star" size={16} color={colors.accent.primary} />
          <Text style={styles.premiumText}>Free Plan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Trails Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Saved Trails</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="settings-outline" size={24} color={colors.text.secondary} />
            <Text style={styles.menuText}>Edit Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="notifications-outline" size={24} color={colors.text.secondary} />
            <Text style={styles.menuText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="globe-outline" size={24} color={colors.text.secondary} />
            <Text style={styles.menuText}>Units & Language</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('Premium')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="star" size={24} color={colors.accent.primary} />
            <Text style={[styles.menuText, { color: colors.accent.primary }]}>
              Upgrade to Premium
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.accent.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
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
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  premiumText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.card,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h1,
    color: colors.accent.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    ...typography.body,
    color: colors.text.primary,
    marginLeft: 16,
  },
  signOutButton: {
    backgroundColor: colors.background.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  signOutText: {
    ...typography.body,
    color: colors.status.error,
    fontWeight: '600',
  },
});
