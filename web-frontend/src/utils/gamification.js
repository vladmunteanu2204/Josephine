// Gamification System for Alpenvia
// Handles badges, achievements, XP, and levels

// Badge Definitions
export const BADGES = {
  // Distance Milestones
  FIRST_STEPS: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your first hike',
    icon: '👣',
    type: 'milestone',
    requirement: { hikes: 1 },
    xp: 50
  },
  TRAIL_EXPLORER: {
    id: 'trail_explorer',
    name: 'Trail Explorer',
    description: 'Complete 5 hikes',
    icon: '🥾',
    type: 'milestone',
    requirement: { hikes: 5 },
    xp: 150
  },
  MOUNTAIN_WANDERER: {
    id: 'mountain_wanderer',
    name: 'Mountain Wanderer',
    description: 'Complete 10 hikes',
    icon: '⛰️',
    type: 'milestone',
    requirement: { hikes: 10 },
    xp: 300
  },
  ALPINE_VETERAN: {
    id: 'alpine_veteran',
    name: 'Alpine Veteran',
    description: 'Complete 25 hikes',
    icon: '🏔️',
    type: 'milestone',
    requirement: { hikes: 25 },
    xp: 750
  },
  PEAK_MASTER: {
    id: 'peak_master',
    name: 'Peak Master',
    description: 'Complete 50 hikes',
    icon: '👑',
    type: 'milestone',
    requirement: { hikes: 50 },
    xp: 1500
  },

  // Distance Achievements
  KILOMETER_KING: {
    id: 'kilometer_king',
    name: 'Kilometer King',
    description: 'Hike 10km total',
    icon: '📏',
    type: 'distance',
    requirement: { totalDistance: 10 },
    xp: 100
  },
  MARATHON_HIKER: {
    id: 'marathon_hiker',
    name: 'Marathon Hiker',
    description: 'Hike 42km total',
    icon: '🎽',
    type: 'distance',
    requirement: { totalDistance: 42 },
    xp: 250
  },
  ULTRA_DISTANCE: {
    id: 'ultra_distance',
    name: 'Ultra Distance',
    description: 'Hike 100km total',
    icon: '🏃',
    type: 'distance',
    requirement: { totalDistance: 100 },
    xp: 500
  },
  LEGENDARY_EXPLORER: {
    id: 'legendary_explorer',
    name: 'Legendary Explorer',
    description: 'Hike 250km total',
    icon: '🌟',
    type: 'distance',
    requirement: { totalDistance: 250 },
    xp: 1000
  },

  // Elevation Achievements
  HILL_CLIMBER: {
    id: 'hill_climber',
    name: 'Hill Climber',
    description: 'Climb 500m total elevation',
    icon: '⛰️',
    type: 'elevation',
    requirement: { totalElevation: 500 },
    xp: 100
  },
  MOUNTAIN_ASCENDER: {
    id: 'mountain_ascender',
    name: 'Mountain Ascender',
    description: 'Climb 1,000m total elevation',
    icon: '🗻',
    type: 'elevation',
    requirement: { totalElevation: 1000 },
    xp: 200
  },
  SUMMIT_SEEKER: {
    id: 'summit_seeker',
    name: 'Summit Seeker',
    description: 'Climb 2,500m total elevation',
    icon: '⛰️',
    type: 'elevation',
    requirement: { totalElevation: 2500 },
    xp: 400
  },
  PEAK_CONQUEROR: {
    id: 'peak_conqueror',
    name: 'Peak Conqueror',
    description: 'Climb 5,000m total elevation',
    icon: '🏔️',
    type: 'elevation',
    requirement: { totalElevation: 5000 },
    xp: 800
  },

  // Special Achievements
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start a hike before 7 AM',
    icon: '🌅',
    type: 'special',
    requirement: { earlyStart: true },
    xp: 75
  },
  NIGHT_OWL: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a hike after 8 PM',
    icon: '🌙',
    type: 'special',
    requirement: { lateFinish: true },
    xp: 75
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete a difficult trail in record time',
    icon: '⚡',
    type: 'special',
    requirement: { fastCompletion: true },
    xp: 150
  },
  ENDURANCE_CHAMPION: {
    id: 'endurance_champion',
    name: 'Endurance Champion',
    description: 'Complete a hike longer than 4 hours',
    icon: '💪',
    type: 'special',
    requirement: { longDuration: 14400 },
    xp: 200
  },
  TRAIL_COMPLETIONIST: {
    id: 'trail_completionist',
    name: 'Trail Completionist',
    description: 'Complete every available trail',
    icon: '✅',
    type: 'special',
    requirement: { allTrails: true },
    xp: 2000
  }
};

// Level Thresholds (XP required for each level)
export const LEVELS = [
  { level: 1, xp: 0, title: 'Beginner' },
  { level: 2, xp: 100, title: 'Novice Hiker' },
  { level: 3, xp: 250, title: 'Trail Explorer' },
  { level: 4, xp: 500, title: 'Mountain Enthusiast' },
  { level: 5, xp: 1000, title: 'Alpine Adventurer' },
  { level: 6, xp: 1750, title: 'Peak Pursuer' },
  { level: 7, xp: 2750, title: 'Summit Seeker' },
  { level: 8, xp: 4000, title: 'Mountain Guide' },
  { level: 9, xp: 6000, title: 'Alpine Master' },
  { level: 10, xp: 9000, title: 'Legend of the Alps' }
];

// Get user's gamification data from localStorage
export function getUserGamificationData() {
  const data = localStorage.getItem('alpenvia_gamification');
  if (data) {
    return JSON.parse(data);
  }
  
  // Initialize new user
  return {
    xp: 0,
    level: 1,
    badges: [],
    stats: {
      totalHikes: 0,
      totalDistance: 0,
      totalElevation: 0,
      totalDuration: 0,
      completedTrails: []
    },
    history: []
  };
}

// Save gamification data
export function saveGamificationData(data) {
  localStorage.setItem('alpenvia_gamification', JSON.stringify(data));
}

// Calculate level from XP
export function calculateLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

// Get XP progress to next level
export function getXPProgress(xp) {
  const currentLevel = calculateLevel(xp);
  const currentLevelIndex = LEVELS.findIndex(l => l.level === currentLevel.level);
  
  if (currentLevelIndex >= LEVELS.length - 1) {
    return { current: xp, required: xp, percentage: 100 };
  }
  
  const nextLevel = LEVELS[currentLevelIndex + 1];
  const currentLevelXP = currentLevel.xp;
  const xpInLevel = xp - currentLevelXP;
  const xpRequired = nextLevel.xp - currentLevelXP;
  const percentage = Math.floor((xpInLevel / xpRequired) * 100);
  
  return {
    current: xpInLevel,
    required: xpRequired,
    percentage: Math.min(percentage, 100),
    nextLevel: nextLevel
  };
}

// Check if user earned new badges after completing a hike
export function checkNewBadges(hikeData) {
  const userData = getUserGamificationData();
  const newBadges = [];
  
  // Update stats
  userData.stats.totalHikes += 1;
  userData.stats.totalDistance += hikeData.distance / 1000; // Convert to km
  userData.stats.totalElevation += hikeData.elevation || 0;
  userData.stats.totalDuration += hikeData.duration || 0;
  
  if (hikeData.trailId && !userData.stats.completedTrails.includes(hikeData.trailId)) {
    userData.stats.completedTrails.push(hikeData.trailId);
  }
  
  // Check each badge
  Object.values(BADGES).forEach(badge => {
    // Skip if already earned
    if (userData.badges.includes(badge.id)) return;
    
    let earned = false;
    
    // Check milestone badges
    if (badge.requirement.hikes && userData.stats.totalHikes >= badge.requirement.hikes) {
      earned = true;
    }
    
    // Check distance badges
    if (badge.requirement.totalDistance && userData.stats.totalDistance >= badge.requirement.totalDistance) {
      earned = true;
    }
    
    // Check elevation badges
    if (badge.requirement.totalElevation && userData.stats.totalElevation >= badge.requirement.totalElevation) {
      earned = true;
    }
    
    // Check special badges
    if (badge.requirement.earlyStart && hikeData.startTime) {
      const hour = new Date(hikeData.startTime).getHours();
      if (hour < 7) earned = true;
    }
    
    if (badge.requirement.lateFinish && hikeData.endTime) {
      const hour = new Date(hikeData.endTime).getHours();
      if (hour >= 20) earned = true;
    }
    
    if (badge.requirement.longDuration && hikeData.duration >= badge.requirement.longDuration) {
      earned = true;
    }
    
    // Award badge
    if (earned) {
      userData.badges.push(badge.id);
      userData.xp += badge.xp;
      newBadges.push(badge);
      
      // Add to history
      userData.history.push({
        type: 'badge',
        badgeId: badge.id,
        timestamp: Date.now(),
        xpAwarded: badge.xp
      });
    }
  });
  
  // Award base XP for completing hike
  const baseXP = calculateHikeXP(hikeData);
  userData.xp += baseXP;
  userData.history.push({
    type: 'hike',
    hikeData: hikeData,
    timestamp: Date.now(),
    xpAwarded: baseXP
  });
  
  // Update level
  const newLevel = calculateLevel(userData.xp);
  const oldLevel = userData.level;
  userData.level = newLevel.level;
  
  // Check for level up
  const leveledUp = newLevel.level > oldLevel;
  
  // Save data
  saveGamificationData(userData);
  
  return {
    newBadges,
    xpGained: baseXP,
    totalXP: userData.xp,
    leveledUp,
    newLevel: newLevel,
    stats: userData.stats
  };
}

// Calculate XP awarded for completing a hike
export function calculateHikeXP(hikeData) {
  let xp = 20; // Base XP
  
  // Distance bonus
  const distanceKm = hikeData.distance / 1000;
  xp += Math.floor(distanceKm * 5);
  
  // Elevation bonus
  if (hikeData.elevation) {
    xp += Math.floor(hikeData.elevation / 10);
  }
  
  // Duration bonus
  if (hikeData.duration) {
    const hours = hikeData.duration / 3600;
    xp += Math.floor(hours * 10);
  }
  
  // Completion bonus (finished vs abandoned)
  if (hikeData.completed) {
    xp += 10;
  }
  
  return Math.max(xp, 20); // Minimum 20 XP per hike
}

// Get leaderboard data
export function getLeaderboardData() {
  // In a real app, this would fetch from backend
  // For now, we'll use mock data + current user
  const userData = getUserGamificationData();
  const currentUser = JSON.parse(localStorage.getItem('alpenvia_user') || '{}');
  
  const leaderboard = [
    {
      rank: 1,
      name: currentUser.displayName || 'You',
      level: userData.level,
      xp: userData.xp,
      totalHikes: userData.stats.totalHikes,
      totalDistance: userData.stats.totalDistance,
      isCurrentUser: true
    }
  ];
  
  return leaderboard;
}

// Get badge by ID
export function getBadgeById(badgeId) {
  return Object.values(BADGES).find(b => b.id === badgeId);
}

// Award XP directly (for challenges, bonuses, etc.)
export function awardXP(xpAmount) {
  const userData = getUserGamificationData();
  userData.xp += xpAmount;
  
  const newLevel = calculateLevel(userData.xp);
  userData.level = newLevel.level;
  
  saveGamificationData(userData);
  return userData;
}
