import { subDays, subMonths, addDays } from 'date-fns';
import { exerciseLibrary, calculate1RM } from './exercises';
import { medalDefinitions } from './medals';

const trainersData = [
  { id: 'trainer-christo', email: 'christo@apexfitness.nz', username: 'christo_durand', displayName: 'Christo Durand', bio: 'Head Coach & Founder of Catalift. Specializing in strength training and powerlifting for all levels.', gender: 'male', height: 185, weight: 92, specs: ['Powerlifting', 'Strength & Conditioning'], photo: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=200&h=200&fit=crop&crop=face', location: 'Catalift Hamilton', rate: 75, availability: 'Mon-Sat 6am-8pm' },
  { id: 'trainer-sarah', email: 'sarah@lesmills.co.nz', username: 'sarah_fitness', displayName: 'Sarah Thompson', bio: 'Les Mills certified instructor with 8+ years experience. HIIT and group fitness specialist.', gender: 'female', height: 168, weight: 62, specs: ['Group Fitness', 'HIIT'], photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=200&h=200&fit=crop&crop=face', location: 'Les Mills Hamilton', rate: 65, availability: 'Mon-Fri 5am-6pm' },
  { id: 'trainer-mike', email: 'mike@cityfitness.co.nz', username: 'mike_strength', displayName: 'Mike Roberts', bio: 'Former competitive powerlifter. Now helping others achieve their strength goals.', gender: 'male', height: 190, weight: 105, specs: ['Powerlifting', 'Strongman'], photo: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=200&h=200&fit=crop&crop=face', location: 'City Fitness Hamilton', rate: 70, availability: 'Tue-Sun 7am-9pm' },
  { id: 'trainer-emma', email: 'emma@snapfitness.co.nz', username: 'emma_wellness', displayName: 'Emma Wilson', bio: 'Holistic approach to fitness. Yoga, mindfulness, and strength training combined.', gender: 'female', height: 165, weight: 58, specs: ['Womens Fitness', 'Yoga'], photo: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=200&h=200&fit=crop&crop=face', location: 'Snap Fitness Cambridge', rate: 60, availability: 'Mon-Sat 6am-4pm' },
  { id: 'trainer-james', email: 'james@crossfit.co.nz', username: 'james_crossfit', displayName: 'James Chen', bio: 'CrossFit Level 3 trainer. Olympic lifting coach and competition prep specialist.', gender: 'male', height: 178, weight: 82, specs: ['CrossFit', 'Olympic Lifting'], photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop&crop=face', location: 'CrossFit Waikato', rate: 80, availability: 'Mon-Fri 6am-8pm, Sat 8am-12pm' },
];

const userProfiles = [
  { name: 'Jake Morrison', username: 'jake_lifts', gender: 'male', height: 180, weight: 85, bio: 'Gym rat since 2019.', trainer: 'trainer-christo' },
  { name: 'Sophie Williams', username: 'soph_strong', gender: 'female', height: 165, weight: 60, bio: 'Powerlifter.', trainer: 'trainer-christo' },
  { name: 'Marcus Taylor', username: 'marcus_gains', gender: 'male', height: 175, weight: 78, bio: 'Dad bod journey.', trainer: 'trainer-christo' },
  { name: 'Emily Chen', username: 'em_fitness', gender: 'female', height: 160, weight: 55, bio: 'Morning crew.', trainer: 'trainer-sarah' },
  { name: 'Ryan OConnor', username: 'ryan_power', gender: 'male', height: 182, weight: 88, bio: '500kg total chaser.', trainer: 'trainer-sarah' },
  { name: 'Mia Johnson', username: 'mia_moves', gender: 'female', height: 170, weight: 65, bio: 'CrossFit convert.', trainer: 'trainer-sarah' },
  { name: 'Daniel Smith', username: 'dan_the_man', gender: 'male', height: 178, weight: 82, bio: 'Back after 5 years.', trainer: 'trainer-mike' },
  { name: 'Olivia Brown', username: 'liv_lifts', gender: 'female', height: 168, weight: 58, bio: 'Uni student lifter.', trainer: 'trainer-mike' },
  { name: 'Tom Wilson', username: 'tommy_iron', gender: 'male', height: 185, weight: 95, bio: 'Former rugby.', trainer: 'trainer-mike' },
  { name: 'Grace Lee', username: 'grace_gains', gender: 'female', height: 162, weight: 54, bio: 'Yoga plus iron.', trainer: 'trainer-emma' },
  { name: 'Chris Martin', username: 'chris_fit', gender: 'male', height: 176, weight: 80, bio: 'Software dev lifter.', trainer: 'trainer-emma' },
  { name: 'Hannah Davis', username: 'hannah_strong', gender: 'female', height: 172, weight: 68, bio: 'Mum of 3.', trainer: 'trainer-emma' },
  { name: 'Liam Thompson', username: 'liam_beast', gender: 'male', height: 188, weight: 90, bio: 'Young and hungry.', trainer: 'trainer-james' },
  { name: 'Zoe Anderson', username: 'zoe_zest', gender: 'female', height: 164, weight: 56, bio: 'CrossFit newbie.', trainer: 'trainer-james' },
  { name: 'Nathan White', username: 'nate_fitness', gender: 'male', height: 180, weight: 83, bio: 'IT manager lifter.', trainer: 'trainer-james' },
  { name: 'Ava Miller', username: 'ava_active', gender: 'female', height: 167, weight: 62, bio: 'Runner turned lifter.', trainer: 'trainer-sarah' },
  { name: 'Josh Clark', username: 'josh_pumped', gender: 'male', height: 183, weight: 87, bio: 'Natural bodybuilder.', trainer: 'trainer-sarah' },
  { name: 'Chloe Harris', username: 'chloe_core', gender: 'female', height: 169, weight: 64, bio: 'Pilates plus heavy.', trainer: 'trainer-mike' },
  { name: 'Ben Roberts', username: 'ben_barbell', gender: 'male', height: 177, weight: 85, bio: '4 years strong.', trainer: 'trainer-emma' },
  { name: 'Isla Scott', username: 'isla_iron', gender: 'female', height: 166, weight: 59, bio: 'Kiwi strong.', trainer: 'trainer-james' },
];

const workoutTemplates = [
  { name: 'Push Day', exercises: ['bench-press', 'overhead-press', 'incline-dumbbell-press'] },
  { name: 'Pull Day', exercises: ['deadlift', 'barbell-rows', 'pull-ups'] },
  { name: 'Leg Day', exercises: ['squat', 'romanian-deadlift', 'leg-press'] },
];

const baseWeights: Record<string, number> = {
  'bench-press': 70, 'squat': 100, 'deadlift': 120, 'overhead-press': 45,
  'barbell-rows': 60, 'pull-ups': 0, 'incline-dumbbell-press': 25,
  'leg-press': 150, 'romanian-deadlift': 80,
};

export function initializeSeedData(): void {
  // DISABLED - No mock data, fresh start requires account creation
  if (typeof window === 'undefined') return;
  
  // Mark as seeded but don't create any mock data
  localStorage.setItem('apex-seeded', 'true');
  console.log('Catalift: Fresh start mode - no seed data');
  return;
  
  // OLD CODE BELOW - DISABLED
  if (localStorage.getItem('apex-seeded') === 'true') return;
  
  console.log('Initializing Catalift seed data...');
  
  const trainers = trainersData.map((t, idx) => ({
    id: t.id, email: t.email, username: t.username, displayName: t.displayName,
    profilePhoto: (t as any).photo || 'https://i.pravatar.cc/200?img=' + (idx + 50),
    bio: t.bio, gender: t.gender,
    dateOfBirth: subMonths(new Date(), 360 + idx * 24).toISOString(),
    height: t.height, weight: t.weight, preferredUnit: 'kg',
    isTrainer: true, isVerifiedTrainer: true, mode: 'trainer',
    trainerSpecializations: t.specs, trainerBio: t.bio,
    trainerLocation: (t as any).location || 'Hamilton',
    trainerRate: (t as any).rate || 70,
    trainerAvailability: (t as any).availability || 'Contact for availability',
    trainerId: undefined, followers: [] as string[], following: [] as string[],
    createdAt: subMonths(new Date(), 12).toISOString(), updatedAt: new Date().toISOString(),
    password: 'trainer123',
  }));
  
  const users = userProfiles.map((p, i) => ({
    id: 'user-' + (i + 1), email: p.username + '@email.com', username: p.username,
    displayName: p.name, profilePhoto: 'https://i.pravatar.cc/200?img=' + (i + 10),
    bio: p.bio, gender: p.gender,
    dateOfBirth: subMonths(new Date(), 300 + i * 6).toISOString(),
    height: p.height, weight: p.weight, preferredUnit: 'kg',
    isTrainer: false, isVerifiedTrainer: false, mode: 'user',
    trainerId: p.trainer, followers: [] as string[], following: [p.trainer],
    createdAt: subMonths(new Date(), Math.floor(Math.random() * 6) + 1).toISOString(),
    updatedAt: new Date().toISOString(),
    password: 'user123',
  }));
  
  const allUsers = [...users, ...trainers];
  
  // Build follow network
  users.forEach((u, i) => {
    const shuffled = [...users].filter(x => x.id !== u.id).sort(() => Math.random() - 0.5);
    shuffled.slice(0, 5).forEach(other => {
      if (!u.following.includes(other.id)) { u.following.push(other.id); other.followers.push(u.id); }
    });
    trainers.forEach(t => {
      if (!u.following.includes(t.id)) { u.following.push(t.id); t.followers.push(u.id); }
    });
  });
  trainers.forEach(t => {
    trainers.filter(x => x.id !== t.id).forEach(other => { t.following.push(other.id); });
  });
  
  // NO random workouts - all users start with empty stats
  // Medals are only earned from actual logged workouts with real weights
  const workouts: any[] = [];
  
  // Calculate personal bests
  const pbMap: Record<string, Record<string, any>> = {};
  workouts.forEach(wo => {
    if (!pbMap[wo.userId]) pbMap[wo.userId] = {};
    wo.exercises.forEach((ex: any) => {
      const s = ex.sets[0];
      if (!s) return;
      const rm = calculate1RM(s.weight, s.reps);
      if (!pbMap[wo.userId][ex.exerciseId] || rm > pbMap[wo.userId][ex.exerciseId].oneRepMax) {
        pbMap[wo.userId][ex.exerciseId] = { id: 'pb-' + ex.exerciseId + '-' + wo.userId.slice(-4), userId: wo.userId, exerciseId: ex.exerciseId, weight: s.weight, reps: s.reps, oneRepMax: rm, achievedAt: wo.startTime, workoutId: wo.id };
      }
    });
  });
  const pbs = Object.values(pbMap).flatMap(x => Object.values(x));
  
  // Generate medals - ONLY for users with actual workouts, and only earned medals
  const medals: any[] = [];
  users.forEach((user, ui) => {
    const userWorkouts = workouts.filter(w => w.userId === user.id);
    const userPbs = pbs.filter(p => p.userId === user.id);
    const totalVolume = userWorkouts.reduce((sum, w) => sum + w.totalVolume, 0);
    
    // Only create medals for users who have workouts
    if (userWorkouts.length === 0) return;
    
    // Only workout-related medals (not social medals)
    const workoutMedalIds = ['first-blood', 'getting-started', 'dedicated', 'first-pr', 'pr-hunter', 'volume-10k', 'volume-50k', 'week-warrior', 'perfectionist'];
    
    medalDefinitions.filter(def => workoutMedalIds.includes(def.id)).forEach(def => {
      let progress = 0;
      if (def.id === 'first-blood') progress = Math.min(userWorkouts.length, 1);
      else if (def.id === 'getting-started') progress = Math.min(userWorkouts.length, 5);
      else if (def.id === 'dedicated') progress = Math.min(userWorkouts.length, 25);
      else if (def.id === 'first-pr') progress = Math.min(userPbs.length, 1);
      else if (def.id === 'pr-hunter') progress = Math.min(userPbs.length, 10);
      else if (def.id === 'volume-10k') progress = Math.min(totalVolume, 10000);
      else if (def.id === 'volume-50k') progress = Math.min(totalVolume, 50000);
      else if (def.id === 'week-warrior') progress = userWorkouts.length >= 3 ? 3 : userWorkouts.length;
      else if (def.id === 'perfectionist') progress = userWorkouts.length > 0 ? 1 : 0;
      
      const earned = def.target ? progress >= def.target : false;
      // Only add EARNED medals
      if (earned) {
        medals.push({ id: 'medal-' + def.id + '-' + ui, userId: user.id, definitionId: def.id, name: def.name, description: def.description, icon: def.icon, tier: def.tier, category: def.category, earned: true, earnedAt: subDays(new Date(), Math.floor(Math.random() * 30)).toISOString(), progress, target: def.target || 1 });
      }
    });
  });
  
  // NO fake posts - feed starts empty, only real posts from actual workouts
  const posts: any[] = [];
  
  // Trainer-client relationships - Christo has 3 dedicated clients
  const christoClientUsers = users.filter(u => u.trainerId === 'trainer-christo');
  const clients = users.filter(u => u.trainerId).map((u, i) => {
    const isChristoClient = u.trainerId === 'trainer-christo';
    return { 
      id: 'client-' + i, 
      trainerId: u.trainerId, 
      clientId: u.id, 
      status: 'active', 
      startDate: u.createdAt, 
      goals: isChristoClient ? ['Build strength', 'Improve conditioning', 'Better mobility'] : ['Build strength'],
      notes: isChristoClient ? 'Great progress so far. Focus on form.' : '',
      sessionsRemaining: isChristoClient ? 12 : 8, 
      sessionsTotal: 20, 
      onboardingComplete: true 
    };
  });
  
  // Calendar events - Christo has a full week of sessions
  const events: any[] = [];
  const christoId = trainers[0].id;
  
  // Christo's weekly schedule
  const christoSchedule = [
    { day: 0, hour: 6, client: christoClientUsers[0], title: 'Morning PT - ' + christoClientUsers[0]?.displayName },
    { day: 0, hour: 9, client: christoClientUsers[1], title: 'PT Session - ' + christoClientUsers[1]?.displayName },
    { day: 0, hour: 14, client: christoClientUsers[2], title: 'Afternoon PT - ' + christoClientUsers[2]?.displayName },
    { day: 1, hour: 7, client: christoClientUsers[0], title: 'Morning PT - ' + christoClientUsers[0]?.displayName },
    { day: 1, hour: 10, client: christoClientUsers[1], title: 'PT Session - ' + christoClientUsers[1]?.displayName },
    { day: 2, hour: 6, client: christoClientUsers[2], title: 'Early Bird PT - ' + christoClientUsers[2]?.displayName },
    { day: 2, hour: 15, client: christoClientUsers[0], title: 'Afternoon PT - ' + christoClientUsers[0]?.displayName },
    { day: 3, hour: 8, client: christoClientUsers[1], title: 'Morning PT - ' + christoClientUsers[1]?.displayName },
    { day: 3, hour: 12, client: christoClientUsers[2], title: 'Lunch PT - ' + christoClientUsers[2]?.displayName },
    { day: 4, hour: 7, client: christoClientUsers[0], title: 'Morning PT - ' + christoClientUsers[0]?.displayName },
    { day: 4, hour: 11, client: christoClientUsers[1], title: 'Late Morning PT - ' + christoClientUsers[1]?.displayName },
    { day: 5, hour: 9, client: christoClientUsers[2], title: 'Weekend PT - ' + christoClientUsers[2]?.displayName },
    { day: 6, hour: 10, client: christoClientUsers[0], title: 'Sunday Session - ' + christoClientUsers[0]?.displayName },
  ];
  
  christoSchedule.forEach((sched, i) => {
    if (!sched.client) return;
    const date = addDays(new Date(), sched.day);
    events.push({ 
      id: 'event-christo-' + i, 
      trainerId: christoId, 
      clientId: sched.client.id, 
      title: sched.title, 
      type: 'workout', 
      date: date.toISOString(), 
      startTime: sched.hour.toString().padStart(2, '0') + ':00', 
      endTime: (sched.hour + 1).toString().padStart(2, '0') + ':00', 
      notes: 'Focus on compound movements' 
    });
  });
  
  // Add events for other trainers
  trainers.slice(1).forEach((t, ti) => {
    for (let i = 0; i < 3; i++) {
      const trainerClients = users.filter(u => u.trainerId === t.id);
      if (trainerClients.length === 0) return;
      const client = trainerClients[i % trainerClients.length];
      const date = addDays(new Date(), i);
      const hour = 9 + i * 2;
      events.push({ id: 'event-' + ti + '-' + i, trainerId: t.id, clientId: client.id, title: 'PT Session - ' + client.displayName, type: 'workout', date: date.toISOString(), startTime: hour.toString().padStart(2, '0') + ':00', endTime: (hour + 1).toString().padStart(2, '0') + ':00', notes: '' });
    }
  });
  
  // ============ SESSIONS & PAYMENTS FOR CHRISTO'S CLIENTS ============
  const sessions: any[] = [];
  const payments: any[] = [];
  const sessionPackages: any[] = [];
  
  // Create session packages and payment history for Christo's clients
  christoClientUsers.forEach((client, ci) => {
    if (!client) return;
    
    // Create a session package for each client
    const packageId = 'pkg-' + client.id;
    const paymentId = 'pay-pkg-' + client.id;
    const totalSessions = 20;
    const usedSessions = 8 + ci * 2; // Varying usage
    
    sessionPackages.push({
      id: packageId,
      trainerId: christoId,
      clientId: client.id,
      name: '20 Session Pack',
      totalSessions,
      usedSessions,
      remainingSessions: totalSessions - usedSessions,
      priceTotal: 1200,
      pricePerSession: 60,
      purchaseDate: subDays(new Date(), 60 + ci * 10).toISOString(),
      expiryDate: addDays(new Date(), 120).toISOString(),
      paymentId,
      status: 'active',
    });
    
    // Payment for the package
    payments.push({
      id: paymentId,
      trainerId: christoId,
      clientId: client.id,
      amount: 1200,
      currency: 'NZD',
      type: 'session_pack',
      sessionsIncluded: totalSessions,
      description: '20 Session Training Pack',
      status: 'paid',
      paidAt: subDays(new Date(), 60 + ci * 10).toISOString(),
      method: ci === 0 ? 'card' : ci === 1 ? 'bank_transfer' : 'cash',
      invoiceNumber: 'INV-2024-' + (100 + ci),
      createdAt: subDays(new Date(), 60 + ci * 10).toISOString(),
    });
    
    // Add a pending payment for one client
    if (ci === 1) {
      payments.push({
        id: 'pay-pending-' + client.id,
        trainerId: christoId,
        clientId: client.id,
        amount: 60,
        currency: 'NZD',
        type: 'single_session',
        sessionsIncluded: 1,
        description: 'Extra Session - Outside Package',
        status: 'pending',
        dueDate: addDays(new Date(), 7).toISOString(),
        invoiceNumber: 'INV-2024-' + (200 + ci),
        createdAt: subDays(new Date(), 3).toISOString(),
      });
    }
    
    // Generate past completed sessions for each client
    for (let s = 0; s < usedSessions; s++) {
      const sessionDate = subDays(new Date(), (usedSessions - s) * 3 + ci);
      const hour = 6 + (s % 4) * 2;
      sessions.push({
        id: 'session-' + client.id + '-' + s,
        trainerId: christoId,
        clientId: client.id,
        date: sessionDate.toISOString(),
        startTime: hour.toString().padStart(2, '0') + ':00',
        endTime: (hour + 1).toString().padStart(2, '0') + ':00',
        duration: 60,
        type: 'pt_session',
        status: 'completed',
        notes: s === usedSessions - 1 ? 'Great session! New PB on squats.' : '',
        rating: s > usedSessions - 3 ? 5 : undefined,
        feedback: s === usedSessions - 1 ? 'Amazing progress!' : undefined,
        paid: true,
        paymentId: packageId,
      });
    }
    
    // Add upcoming scheduled sessions (from calendar events)
    christoSchedule.filter(sched => sched.client?.id === client.id).forEach((sched, si) => {
      const sessionDate = addDays(new Date(), sched.day);
      sessions.push({
        id: 'session-upcoming-' + client.id + '-' + si,
        trainerId: christoId,
        clientId: client.id,
        date: sessionDate.toISOString(),
        startTime: sched.hour.toString().padStart(2, '0') + ':00',
        endTime: (sched.hour + 1).toString().padStart(2, '0') + ':00',
        duration: 60,
        type: 'pt_session',
        status: 'scheduled',
        paid: true, // Covered by package
        paymentId: packageId,
      });
    });
  });
  
  // Save to localStorage with proper store format
  localStorage.setItem('apex-users', JSON.stringify(allUsers));
  
  // Get Christo's data (christoId already defined above)
  // Trainers start with empty workouts, PBs, and medals - they build their own history
  const christoWorkouts: any[] = [];
  const christoPbs: any[] = [];
  const christoMedals: any[] = [];
  const christoClients = clients.filter(c => c.trainerId === christoId);
  const christoEvents = events.filter(e => e.trainerId === christoId);
  
  // Workout store format (key: apex-workout)
  localStorage.setItem('apex-workout', JSON.stringify({ 
    state: { 
      workoutHistory: christoWorkouts, 
      personalBests: christoPbs, 
      activeWorkout: null, 
      workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
      restTimer: { isRunning: false, seconds: 0, type: 'rest' },
      templates: [] 
    }, 
    version: 0 
  }));
  
  // Medal store format (key: apex-medals)
  localStorage.setItem('apex-medals', JSON.stringify({ 
    state: { 
      medals: christoMedals, 
      strengthRating: null 
    }, 
    version: 0 
  }));
  
  // Social store format (key: apex-social)
  localStorage.setItem('apex-social', JSON.stringify({ 
    state: { 
      posts, 
      allUsers, 
      notifications: [] 
    }, 
    version: 0 
  }));
  
  // Trainer store format (key: apex-trainer)
  const christoSessions = sessions.filter(s => s.trainerId === christoId);
  const christoPayments = payments.filter(p => p.trainerId === christoId);
  const christoPackages = sessionPackages.filter(p => p.trainerId === christoId);
  
  localStorage.setItem('apex-trainer', JSON.stringify({ 
    state: { 
      clients: christoClients, 
      assignedWorkouts: [], 
      calendarEvents: christoEvents,
      sessions: christoSessions,
      payments: christoPayments,
      sessionPackages: christoPackages,
      bookingRequests: [],
    }, 
    version: 0 
  }));
  
  // Auth store format - auto login as Christo with explicit followers/following
  const christoUser = {
    ...trainers[0],
    profilePhoto: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=200&h=200&fit=crop&crop=face',
    followers: users.filter(u => u.following.includes(trainers[0].id)).map(u => u.id),
    following: [...trainers.filter(t => t.id !== trainers[0].id).map(t => t.id), ...users.slice(0, 5).map(u => u.id)],
  };
  
  localStorage.setItem('apex-auth', JSON.stringify({ 
    state: { 
      user: christoUser, 
      isAuthenticated: true, 
      isLoading: false 
    }, 
    version: 0 
  }));
  
  localStorage.setItem('apex-seeded', 'true');
  console.log('Seeded: ' + allUsers.length + ' users, ' + workouts.length + ' workouts, ' + medals.length + ' medals');
}

export function resetSeedData(): void {
  if (typeof window === 'undefined') return;
  // Clear ALL localStorage for fresh start
  localStorage.clear();
  console.log('All data cleared - fresh start.');
}

export function resetWorkoutDataOnly(): void {
  if (typeof window === 'undefined') return;
  // Clear only workout-related data - keep auth/user intact
  localStorage.setItem('apex-workout', JSON.stringify({ 
    state: { workoutHistory: [], personalBests: [], activeWorkout: null, templates: [], workoutTimer: { isRunning: false, seconds: 0, type: 'workout' }, restTimer: { isRunning: false, seconds: 0, type: 'rest' } }, 
    version: 0 
  }));
  localStorage.setItem('apex-medals', JSON.stringify({ 
    state: { medals: [], evolvingMedalProgress: {}, strengthRating: null }, 
    version: 0 
  }));
  // Bump seed version so page.tsx doesn't trigger a full reseed on reload
  localStorage.setItem('apex-seed-version', 'v6');
  console.log('Workout data and medals cleared (auth preserved).');
}

/**
 * Add a workout for a specific client. Call this from browser console or seedData.
 * The workout will appear in the client's profile under "Recent Workouts".
 * 
 * Example usage:
 * addWorkoutForClient('client-123456', 'Push Day', [
 *   { exerciseId: 'bench-press', sets: [{ weight: 80, reps: 8 }, { weight: 85, reps: 6 }] },
 *   { exerciseId: 'overhead-press', sets: [{ weight: 40, reps: 10 }] }
 * ]);
 */
export function addWorkoutForClient(
  clientId: string,
  workoutName: string,
  exercises: Array<{ exerciseId: string; sets: Array<{ weight: number; reps: number }> }>,
  dateOverride?: Date
): void {
  if (typeof window === 'undefined') return;
  
  const workoutStore = JSON.parse(localStorage.getItem('apex-workout') || '{}');
  const state = workoutStore.state || { workoutHistory: [], personalBests: [] };
  
  const workoutDate = dateOverride || new Date();
  const workoutId = `w-${clientId.slice(-6)}-${Date.now()}`;
  
  // Build exercise data
  const exerciseData = exercises.map((ex, idx) => ({
    id: `ex-${workoutId}-${idx}`,
    exerciseId: ex.exerciseId,
    sets: ex.sets.map((s, si) => ({
      id: `set-${workoutId}-${idx}-${si}`,
      setNumber: si + 1,
      weight: s.weight,
      reps: s.reps,
      completed: true,
    })),
    restTimerSeconds: 90,
    notes: '',
  }));
  
  // Calculate total volume
  const totalVolume = exerciseData.reduce((sum, ex) => 
    sum + ex.sets.reduce((setSum, s) => setSum + (s.weight * s.reps), 0), 0
  );
  
  const workout = {
    id: workoutId,
    name: workoutName,
    exercises: exerciseData,
    startTime: workoutDate.toISOString(),
    endTime: new Date(workoutDate.getTime() + 3600000).toISOString(), // 1 hour later
    duration: 3600,
    totalVolume,
    notes: '',
    userId: clientId,
    status: 'completed',
  };
  
  state.workoutHistory = [workout, ...(state.workoutHistory || [])];
  
  localStorage.setItem('apex-workout', JSON.stringify({ state, version: 0 }));
  console.log(`Added workout "${workoutName}" for client ${clientId}. Volume: ${totalVolume}kg`);
}

/**
 * Get all clients for a trainer by trainer ID.
 * Useful for finding client IDs to add workouts.
 */
export function listClients(trainerId: string = 'trainer-christo'): void {
  if (typeof window === 'undefined') return;
  
  const users = JSON.parse(localStorage.getItem('apex-users') || '[]');
  const clients = users.filter((u: any) => u.trainerId === trainerId);
  
  console.log(`\nClients for ${trainerId}:`);
  console.log('─'.repeat(50));
  clients.forEach((c: any) => {
    console.log(`ID: ${c.id}`);
    console.log(`Name: ${c.displayName}`);
    console.log(`Email: ${c.email}`);
    console.log('─'.repeat(50));
  });
  console.log(`Total: ${clients.length} clients`);
}
