// User Types
export type Gender = 'male' | 'female' | 'other';
export type UserMode = 'user' | 'trainer';
export type WeightUnit = 'kg' | 'lb';
export type MembershipTier = 'free' | 'pro' | 'trainer';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  gender: Gender;
  dateOfBirth?: string;
  height?: number; // in cm
  weight?: number; // in kg
  profilePhoto?: string;
  bio?: string;
  mode: UserMode;
  isTrainer: boolean;
  isVerifiedTrainer: boolean;
  trainerSpecializations?: string[];
  preferredUnit: WeightUnit;
  exerciseUnit?: WeightUnit; // kg or lb for exercise displays
  isPublicProfile?: boolean; // true = anyone can view, false = private
  createdAt: string;
  followers: string[];
  following: string[];
  trainerId?: string; // If user has a trainer
  membershipTier?: MembershipTier; // free | pro | trainer — defaults to 'pro' for now
  // Profile card preferences
  featuredMedalIds?: string[]; // Up to 3 medal definitionIds to feature on profile card
  showStrengthRating?: boolean; // Whether to show strength rating on profile card (default true)
  contactLinks?: {
    instagram?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  // Gym affiliation
  accountStatus?: 'active' | 'placeholder';
  gymId?: string;
  gymName?: string;
  // Health & service connections
  healthConnections?: {
    appleHealth?: { connected: boolean; lastSync?: string };
    googleHealth?: { connected: boolean; lastSync?: string };
    calendar?: { connected: boolean; provider?: 'apple' | 'google' };
    stripe?: { connected: boolean; accountId?: string };
  };
}

// Exercise Types
export type MuscleGroup = 
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' 
  | 'forearms' | 'abs' | 'obliques' | 'quads' | 'hamstrings' 
  | 'glutes' | 'calves' | 'traps' | 'lats' | 'lower_back';

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio' | 'stretching' | 'warmup' | 'activation';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'bands' | 'other';

export interface FormCues {
  setup: string;
  execution: string[];
  commonMistakes?: string[];
  breathing?: string;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  category: ExerciseCategory;
  equipment: Equipment;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  animationUrl?: string;
  formCues?: FormCues;
  isCustom?: boolean;
  createdBy?: string;
  blockTypes?: BlockType[];
  alternatingSides?: boolean;
}

// Set Types
export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';

// Drop set within a main set
export interface DropSet {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight?: number;
  reps?: number;
  duration?: number; // seconds - for timed exercises like stretches
  completed: boolean;
  previousWeight?: number;
  previousReps?: number;
  restTime?: number; // seconds - override default rest for this set
  notes?: string;
  rpe?: number; // Rate of Perceived Exertion 1-10
  drops?: DropSet[]; // Drop sets attached to this set
  isAssisted?: boolean; // For assisted exercises (pull-up machine, dip machine) where weight = assistance
  isTimed?: boolean; // true for timed exercises (stretches)
}

// Superset grouping
export type SupersetGroupType = 'superset' | 'triset' | 'giant_set';

// Workout Exercise (exercise within a workout)
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  supersetWith?: string; // ID of another workout exercise (legacy)
  notes?: string;
  restTimerSeconds: number;
  isWarmup?: boolean;
  trainerNotes?: string; // PT notes for client
  // Superset grouping (new)
  groupId?: string; // Nullable - exercises with same groupId are grouped
  groupType?: SupersetGroupType;
  groupOrder?: string; // A1, A2, A3, B1, B2, etc.
  miniRestSeconds?: number; // Optional rest between exercises in superset
  isUnilateral?: boolean; // Toggle for alternating sides (L/R) exercises
}

// Workout Block (for organizing exercises in the builder)
export interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  // Circuit-specific settings
  circuitStyle?: 'rounds' | 'amrap' | 'emom' | 'forTime' | 'tabata';
  rounds?: number;
  roundDuration?: string;
  restBetweenRounds?: string;
  targetTime?: string;
  workInterval?: string;
  restInterval?: string;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    sets: number;
    reps: string;
    rest: string;
    tempo?: string;
    notes?: string;
    setStyle?: 'fixed' | 'pyramid' | 'reverse-pyramid' | '5x5' | 'drop-set' | 'amrap';
    repType?: 'reps' | 'time';
    movementPattern?: string;
    // Cardio-specific fields
    isCardio?: boolean;
    cardioType?: 'distance' | 'time' | 'intervals';
    distance?: string; // e.g., "5km", "2mi"
    distanceUnit?: 'km' | 'mi' | 'm';
    targetTime?: string; // e.g., "30:00", "1:00:00"
    targetPace?: string; // e.g., "5:30/km"
    intervals?: number; // number of intervals
    intervalWork?: string; // e.g., "400m" or "1min"
    intervalRest?: string; // e.g., "90s"
  }[];
}

// Saved Block for Block Library
export interface SavedBlock {
  id: string;
  name: string;
  type: BlockType;
  trainerId: string;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    sets: number;
    reps: string;
    repType?: 'reps' | 'time';
    rest: string;
    tempo?: string;
    notes?: string;
    setStyle?: 'fixed' | 'pyramid' | 'reverse-pyramid' | '5x5' | 'drop-set' | 'amrap';
  }[];
  // Circuit-specific settings
  circuitStyle?: 'rounds' | 'amrap' | 'emom' | 'forTime' | 'tabata';
  circuitRounds?: number;
  circuitDuration?: number; // seconds for AMRAP/For Time
  circuitRestBetween?: number; // seconds between rounds
  folder?: string; // Custom folder for organizing blocks (e.g. "Jason's workouts")
  createdAt: string;
  updatedAt: string;
}

// Block Performance Record - tracks client performance on named blocks
export interface BlockPerformance {
  id: string;
  blockId: string; // Reference to SavedBlock
  blockName: string;
  blockType: BlockType; // warmup, work, circuit, cardio, cooldown
  clientId: string;
  trainerId: string;
  workoutId: string;
  // Circuit stats
  completionTime?: number; // seconds for timed circuits
  roundsCompleted?: number;
  roundTimes?: number[]; // Per-round completion times in seconds
  intervalTimes?: number[]; // Per-interval times for interval training
  difficultyRating?: 'easy' | 'moderate' | 'hard' | null; // Client's perceived difficulty
  // Cardio stats
  cardioMode?: 'steady' | 'intervals' | 'distance' | 'emom' | 'amrap' | 'forTime';
  cardioActivity?: 'run' | 'swim' | 'bike' | 'row' | 'ski' | 'other';
  distance?: number; // meters
  avgPace?: number; // seconds per km/mile
  caloriesBurned?: number;
  // Strength stats
  totalVolume?: number;
  exerciseStats?: {
    exerciseId: string;
    exerciseName: string;
    bestWeight?: number;
    bestReps?: number;
    oneRepMax?: number;
  }[];
  performedAt: string;
  notes?: string;
}

// Workout Template
export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[];
  createdBy: string;
  isPublic: boolean;
  category?: string;
  estimatedDuration?: number; // minutes
  createdAt: string;
  updatedAt: string;
  blocks?: WorkoutBlock[]; // Optional blocks for structured workouts
}

// Active/Completed Workout
export interface Workout {
  id: string;
  templateId?: string;
  name: string;
  exercises: WorkoutExercise[];
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  totalVolume: number; // kg
  userId: string;
  notes?: string; // DEPRECATED — migrated to privateNotes on hydration
  privateNotes?: string; // Private notes visible only to the creator
  sharedNotes?: string; // Notes visible to both trainer and client
  trainerNotes?: string; // Private notes visible only to the trainer who conducted the session
  status: 'active' | 'completed' | 'cancelled';
  assignedBy?: string; // Trainer ID if assigned
  scheduledDate?: string;
  blocks?: WorkoutBlock[]; // Session workout blocks
  deletedAt?: string; // Soft delete timestamp — null means active
  aiSummary?: string; // AI-generated feedback summary shown on completion + workout history
  // PT Session Review Flow — populated only for PT sessions the client opened on their own device.
  // reviewStatus='pending' means client finished it and trainer must review+release.
  // reviewStatus='released' means trainer has released the summary (with optional coach note).
  reviewStatus?: 'pending' | 'released';
  coachNote?: string; // Trainer's personal note included when releasing the summary
  releasedAt?: string; // ISO timestamp when trainer released the summary to the client
  // D17: explicit tags written at start time when a workout is launched from
  // a program day (see startFromTemplate's `source` arg). These make
  // program-workout detection definitive at finish time instead of inferring
  // from templateId prefixes. Legacy workouts without these tags fall back
  // to the existing prefix + structural detection in detectIsProgramWorkout.
  sourceProgramId?: string;
  sourceDayIndex?: number;
}

// Personal Best / Records
export interface PersonalBest {
  id: string;
  exerciseId: string;
  // W3: optional human label mirrored to public.personal_bests.exercise_name
  // so cross-device pulls don't have to resolve exerciseId against the
  // exercise catalog to render. Not all historical in-memory PBs have it;
  // keep it optional so existing object literals still type-check.
  exerciseName?: string;
  userId: string;
  oneRepMax: number; // Calculated or actual
  bestWeight: number;
  bestReps: number;
  bestVolume: number; // Single exercise total volume
  achievedAt: string;
  workoutId: string;
}

// Strength Rating Tier
export type StrengthTier = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

// Tier ranges for each lift (kg) - Male standards
export interface TierRange {
  beginner: [number, number];
  novice: [number, number];
  intermediate: [number, number];
  advanced: [number, number];
  elite: [number, number];
}

// A slice is a sub-component of a category (e.g., "Middle Chest" within "Chest")
export interface StrengthSlice {
  id: string;
  name: string;
  weight: number; // percentage weight (e.g., 40 for 40%)
  contributingLift: string; // exercise ID
  liftName: string;
  oneRM: number;
  bestWeight?: number; // actual weight lifted for 1RM calculation
  bestReps?: number; // actual reps performed for 1RM calculation
  tier: StrengthTier;
  progressPercent: number; // 0-100 within current tier
  points: number; // weight × progressPercent / 100
}

// A category is a major muscle group (Chest, Back, Shoulders, Legs)
export interface StrengthCategory {
  id: string;
  name: string;
  icon: string;
  tier: StrengthTier;
  totalPoints: number; // sum of all slice points (0-100)
  slices: StrengthSlice[];
}

// Full strength rating with all categories
export interface StrengthRating {
  overall: number;
  overallTier: StrengthTier;
  categories: {
    chest: StrengthCategory;
    back: StrengthCategory;
    shoulders: StrengthCategory;
    legs: StrengthCategory;
  };
  lastUpdated: string;
  // Legacy fields for backward compatibility
  push: number;
  pull: number;
  legs: number;
  core: number;
  tier: StrengthTier;
  breakdown: {
    muscleGroup: MuscleGroup;
    score: number;
    tier: string;
  }[];
}

// Medals & Achievements
export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type MedalCategory = 'workout' | 'strength' | 'consistency' | 'social' | 'milestone' | 'special' | 'trainer' | 'cardio' | 'circuit' | 'stretch' | 'running';
export type EvolutionSpeed = 'fast' | 'medium' | 'slow' | 'very_slow';
export type EvolutionGlowTier = 'base' | 'gold_glow' | 'diamond_glow' | 'pink_diamond_glow';
export type MedalRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface MedalDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: MedalTier;
  category: MedalCategory;
  rarity: MedalRarity;
  requirement: string;
  target?: number;
  canEvolve?: boolean; // false for streaks and one-time milestones
  evolutionSpeed?: EvolutionSpeed; // fast=3/10/25, medium=5/15/40, slow=5/20/50, very_slow=10/30/75
  deferredCheck?: boolean; // true = medal exists but checking logic not yet implemented
}

export interface Medal {
  id: string;
  userId: string;
  definitionId: string;
  name: string;
  description: string;
  icon: string;
  tier: MedalTier;
  category: MedalCategory;
  rarity: MedalRarity;
  earned: boolean;
  earnedAt?: string;
  progress: number;
  target: number;
  // Track how many times the medal condition has been met
  timesEarned: number;
  // For evolving medals
  isEvolving?: boolean;
  currentEvolutionTier?: MedalTier;
  nextEvolutionTarget?: number;
  // Visual evolution glow tier (computed from timesEarned)
  evolutionTier: EvolutionGlowTier;
}

// Social / Feed
export type PostType = 'workout_complete' | 'pb_achieved' | 'medal_earned' | 'milestone' | 'general';

export interface FeedPost {
  id: string;
  userId: string;
  user?: User;
  type: PostType;
  content: string;
  mediaUrls?: string[];
  workoutId?: string;
  medalId?: string;
  likes: string[];
  comments: Comment[];
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  user?: User;
  content: string;
  createdAt: string;
}

// Trainer-Client Relationship
export interface TrainerClient {
  id: string;
  trainerId: string;
  clientId: string;
  client?: User;
  status: 'pending' | 'active' | 'paused' | 'ended';
  startDate: string;
  endDate?: string;
  sessionsTotal?: number;
  sessionsUsed?: number;
  goals?: string[];
  injuryHistory?: string;
  exercisePreferences?: string;
  notes?: string;
  onboardingComplete: boolean;
  // Decoupled lifetime counters — editable, not controlled by packages
  totalSessions?: number;  // Stored counter — +1 on workout complete, or manual inline edit
  totalPaid?: number;       // Stored counter — only changes on explicit user action (log payment, inline edit, paid toggle)
  // DEPRECATED — no longer used, kept for backwards compat
  totalSessionsOffset?: number;
  totalPaidOffset?: number;
}

// Client Group (for group fitness classes)
export interface ClientGroup {
  id: string;
  trainerId: string;
  name: string;
  description?: string;
  memberIds: string[];  // Array of client IDs
  color?: string;  // For visual identification
  pricePerSession?: number;  // Group class price per person
  schedule?: {
    dayOfWeek: number;  // 0-6 (Sunday-Saturday)
    time: string;  // e.g., "09:00"
    duration: number;  // minutes
  }[];
  createdAt: string;
  status: 'active' | 'paused' | 'archived';
}

// Client Onboarding
export interface ClientOnboarding {
  id: string;
  clientId: string;
  trainerId: string;
  goals: string[];
  injuryHistory: string;
  medicalConditions?: string;
  exerciseLikes: string[];
  exerciseDislikes: string[];
  availability: {
    days: string[];
    preferredTimes: string[];
  };
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  submittedAt: string;
}

// Training Program
export interface TrainingProgram {
  id: string;
  name: string;
  description?: string;
  trainerId: string;
  clientId: string;
  startDate: string;
  endDate?: string;
  weeks: number;
  workouts: {
    weekNumber: number;
    dayOfWeek: number;
    templateId: string;
    completed: boolean;
    completedAt?: string;
  }[];
  status: 'active' | 'completed' | 'paused';
}

// Calendar Event
export interface CalendarEvent {
  id: string;
  title: string;
  type: 'workout' | 'session' | 'consultation' | 'assessment' | 'rest';
  date: string;
  startTime?: string;
  endTime?: string;
  duration?: number; // in minutes
  clientId?: string;
  trainerId?: string;
  workoutId?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  color?: string;
  clientConfirmed?: boolean; // Client has confirmed this session
  clientConfirmedAt?: string;
  recurrenceGroup?: string; // Links recurring events for bulk delete
  contactName?: string; // Name for consultations without a registered client
  programId?: string; // Links to a ClientProgram — distinguishes program workouts from PT sessions
  programDayIndex?: number; // Which day in the program this workout corresponds to
  ownerUserId?: string; // Who sees this in their personal calendar
  eventScope?: 'trainer_personal' | 'client_assigned' | 'shared_session';
}

// Booking Request (for trainer-client scheduling)
export interface BookingRequest {
  id: string;
  trainerId: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'pt_session' | 'consultation' | 'assessment';
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  requestedBy: 'trainer' | 'client';
  confirmedBy?: 'trainer' | 'client' | 'auto';
  notes?: string;
  location?: string;
  createdAt: string;
  respondedAt?: string;
  calendarEventId?: string; // Links to CalendarEvent when confirmed
}

// Weekly Report
export interface WeeklyReport {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number; // minutes
  volumeByMuscleGroup: Record<MuscleGroup, number>;
  volumeChangeFromLastWeek: Record<MuscleGroup, number>; // percentage
  newPBs: PersonalBest[];
  consistencyScore: number; // 0-100
  generatedAt: string;
}

// Notifications
export type NotificationType = 
  | 'weekly_report' | 'workout_assigned' | 'friend_request' 
  | 'trainer_request' | 'achievement' | 'pb_achieved' | 'comment' | 'like' | 'system'
  | 'program_assigned' | 'session_booked';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  link?: string;
  // Optional references that let a notification deep-link into a specific
  // entity. Both stay optional so legacy rows (pre-fix) parse cleanly and
  // any consumer must null-check before using them.
  programId?: string;
  senderId?: string;
  createdAt: string;
}

// Timer State
export interface TimerState {
  isRunning: boolean;
  seconds: number;
  type: 'workout' | 'rest';
  exerciseId?: string;
  startTimestamp?: number; // Unix timestamp when timer started (for background persistence)
  accumulatedSeconds?: number; // Seconds accumulated before last pause
}

// ============ CLIENT SESSION & PAYMENT TRACKING ============

// Individual training session record
export interface ClientSession {
  id: string;
  trainerId: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  type: 'pt_session' | 'assessment' | 'consultation' | 'group';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  workoutId?: string;
  notes?: string;
  rating?: number; // Client rating 1-5
  feedback?: string;
  paid: boolean;
  paymentId?: string;
}

// Payment record
export interface ClientPayment {
  id: string;
  trainerId: string;
  clientId: string;
  amount: number;
  currency: string;
  type: 'session_pack' | 'single_session' | 'monthly' | 'other';
  sessionsIncluded?: number;
  description: string;
  status: 'pending' | 'paid' | 'overdue' | 'refunded';
  dueDate?: string;
  paidAt?: string;
  method?: 'cash' | 'card' | 'bank_transfer' | 'other';
  invoiceNumber?: string;
  createdAt: string;
}

// Session package (e.g., "10 sessions for $500" or continuous/unlimited)
export interface SessionPackage {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  totalSessions: number;  // -1 for unlimited/continuous
  usedSessions: number;
  paidSessions: number;  // How many sessions have been paid for
  remainingSessions: number;  // -1 for unlimited
  priceTotal: number;
  pricePerSession: number;
  purchaseDate: string;
  expiryDate?: string;
  paymentId: string;
  status: 'active' | 'expired' | 'completed';
  isContinuous?: boolean;  // true for ongoing/unlimited packages
  // Payment plan settings
  sessionsPerWeek?: number;  // e.g., 2 sessions per week
  paymentFrequency?: 'per_session' | 'weekly' | 'fortnightly' | 'monthly' | 'upfront';  // when payment is due
  sessionsPerPaymentCycle?: number;  // e.g., 4 sessions before payment due (auto-calculated or manual)
  lastPaymentDate?: string;  // track when last payment was made
}

// ============ TRAINER PROGRAMMING SYSTEM ============

// Training Phases
export type TrainingPhase = 'foundation' | 'strength' | 'performance' | 'return';

// Goal types for filtering
export type TrainingGoal = 
  | 'fat_loss' 
  | 'hypertrophy' 
  | 'strength' 
  | 'conditioning' 
  | 'mobility' 
  | 'general'
  | 'powerlifting'
  | 'athletic_performance'
  | 'pain_reduction';

// Injury/limitation flags
export type InjuryFlag = 'shoulder' | 'knee' | 'back' | 'hip' | 'ankle' | 'wrist' | 'neck' | 'none';

// Experience levels
export type ExperienceLevel = 'new' | 'some' | 'confident' | 'advanced';

// Movement patterns
export type MovementPattern = 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'core' | 'lunge' | 'rotation';

// Template structure types
export type TemplateStructure = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'split' | 'circuit';

// Block types for workout structure
export type BlockType = 'warmup' | 'work' | 'cooldown' | 'cardio' | 'circuit';

// Block color scheme
export const BLOCK_COLORS: Record<BlockType, { bg: string; border: string; text: string }> = {
  warmup: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500' },
  work: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary' },
  cooldown: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500' },
  cardio: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-500' },
  circuit: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-500' },
};

// ============ CARDIO BLOCK TYPES ============

// Cardio block modes
export type CardioMode = 'steady' | 'intervals' | 'circuit' | 'emom' | 'amrap' | 'for_time';

// Activity types for steady cardio
export type CardioActivityType = 'walk' | 'run' | 'bike' | 'row' | 'swim' | 'yoga' | 'stretching' | 'other';

// Intensity levels
export type IntensityLevel = 'easy' | 'moderate' | 'hard';

// HR Zone (1-5)
export type HRZone = 1 | 2 | 3 | 4 | 5;

// Steady state cardio config
export interface SteadyCardioConfig {
  activityType: CardioActivityType;
  duration?: number; // seconds
  distance?: number; // meters
  distanceUnit?: 'km' | 'miles' | 'meters';
  intensity: IntensityLevel;
  hrZone?: HRZone;
  notes?: string;
}

// Interval training config
export interface IntervalConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
  notes?: string;
}

// Circuit exercise (for circuit mode)
export interface CircuitExercise {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  duration?: number; // seconds (time-based)
  reps?: number; // rep-based
  notes?: string;
}

// Circuit training config
export interface CircuitConfig {
  rounds: number;
  exercises: CircuitExercise[];
  restBetweenStations: number; // seconds
  restBetweenRounds: number; // seconds
  notes?: string;
}

// EMOM config
export interface EMOMConfig {
  totalMinutes: number;
  exercises: CircuitExercise[]; // rotate through these each minute
  notes?: string;
}

// AMRAP config
export interface AMRAPConfig {
  totalMinutes: number;
  exercises: CircuitExercise[];
  notes?: string;
}

// For Time config
export interface ForTimeConfig {
  exercises: CircuitExercise[];
  timeCap?: number; // seconds
  notes?: string;
}

// Timer state for cardio blocks
export interface CardioTimerState {
  status: 'idle' | 'running' | 'paused' | 'completed';
  elapsedSeconds: number;
  currentRound?: number;
  currentStation?: number;
  workPhase?: boolean; // For intervals: true = work, false = rest
}

// Complete Cardio Block
export interface CardioBlock {
  id: string;
  mode: CardioMode;
  name: string;
  
  // Config based on mode
  steadyConfig?: SteadyCardioConfig;
  intervalConfig?: IntervalConfig;
  circuitConfig?: CircuitConfig;
  emomConfig?: EMOMConfig;
  amrapConfig?: AMRAPConfig;
  forTimeConfig?: ForTimeConfig;
  
  // Timer state
  timerState: CardioTimerState;
  
  // Completion data
  completedAt?: string;
  actualDuration?: number; // seconds
  completedRounds?: number;
  notes?: string;
}

// Gym (user-generated)
export interface Gym {
  id: string;
  name: string;
  location?: string;
  createdBy: string;
  memberCount?: number;
  createdAt: string;
}

// Calendar Activity (non-gym activities like Yoga, Walk, Run)
export interface CalendarActivity {
  id: string;
  userId: string;
  trainerId?: string;
  activityType: CardioActivityType;
  scheduledDate: string;
  scheduledTime?: string;
  cardioBlock: CardioBlock;
  status: 'scheduled' | 'completed' | 'skipped';
  completedAt?: string;
  notes?: string;
}

// Extended Client Onboarding for programming
export interface ClientProgrammingProfile {
  id: string;
  clientId: string;
  trainerId: string;
  
  // Goals
  primaryGoal: TrainingGoal;
  secondaryGoal?: TrainingGoal;
  customGoalText?: string;
  
  // Training preferences
  trainingPreference: '1:1' | 'group' | 'solo' | 'mixed';
  experienceLevel: ExperienceLevel;
  
  // Injury/pain flags
  injuryFlags: InjuryFlag[];
  injuryNotes?: string;
  
  // Availability
  daysPerWeek: number;
  availableDays?: string[]; // e.g. ['Monday', 'Wednesday', 'Friday']
  scheduleNotes?: string; // e.g. 'Afternoons only', 'Before 3pm on Wednesdays'
  sessionLength: number; // minutes
  trainAloneOutsidePT: 'yes' | 'maybe' | 'no';
  
  // Movement confidence (1-5)
  movementConfidence: {
    squat: number;
    hinge: number;
    push: number;
    pull: number;
    core: number;
  };
  
  // Class readiness
  wantsClasses: 'yes_asap' | 'later' | 'maybe' | 'no';
  classReady: boolean;
  
  // Lifestyle
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  jobActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  
  // Current phase (trainer-selected)
  currentPhase: TrainingPhase;
  
  // Progression plan
  progressionPlan?: {
    weeks: number;
    phases: { phase: TrainingPhase; startWeek: number; endWeek: number }[];
  };
  
  createdAt: string;
  updatedAt: string;
}

// Program Template (the ~20 base templates)
export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  
  // Filtering tags
  phases: TrainingPhase[];
  goals: TrainingGoal[];
  frequencyOptions: number[];
  structure: TemplateStructure;
  classSafe: boolean;
  
  // Workout days
  days: TemplateDay[];
}

// A day within a template
export interface TemplateDay {
  id: string;
  dayLabel: string; // "Day A", "Upper", "Push"
  dayNumber: number;
  blocks: TemplateBlock[];
}

// A block within a workout day
export interface TemplateBlock {
  id: string;
  type: BlockType;
  name: string; // "Activation", "Main Lifts", "Accessory", "Finisher"
  exercises: TemplateExercise[];
}

// An exercise slot within a block
export interface TemplateExercise {
  id: string;
  slot: string; // "Squat Pattern", "Horizontal Push" — movement pattern placeholder
  defaultExerciseId: string; // The suggested default exercise
  defaultExerciseName: string;
  movementPattern: MovementPattern;
  sets: number;
  reps: string; // "8-12" or "3-5"
  rest: string; // "90s" or "60s"
  tempo?: string; // "3010" etc
  notes?: string;
  injuryFlags: InjuryFlag[]; // Which injuries this exercise may aggravate
}

// Client's assigned program (instance of a template)
export interface ClientProgram {
  id: string;
  clientId: string;
  trainerId: string;
  templateId: string;
  templateName: string;
  
  phase: TrainingPhase;
  goal: TrainingGoal;
  
  // Customized weekly plan
  weeklyPlan: ClientWorkoutDay[];
  
  // Scheduling configuration
  scheduleMode?: 'fixed' | 'flexible';
  trainingDaysPerWeek?: number;
  selectedDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  cycleAcrossWeeks?: boolean; // When days > workouts, cycle workouts across weeks
  sessionPTMap?: Record<number, 'pt' | 'personal'>; // Per-session-slot PT marking (key = session index 0..trainingDaysPerWeek-1)
  nextWorkoutIndex?: number; // Tracks cycling position (which workout day is next)
  sessionType?: 'pt' | 'solo' | 'mixed';
  
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
  autoRepeat?: boolean;
  
  createdAt: string;
  updatedAt: string;
}

// A workout day in the client's program
export interface ClientWorkoutDay {
  id: string;
  dayLabel: string;
  scheduledDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  blocks: ClientWorkoutBlock[];
  lastEditedAt?: string; // ISO timestamp — last time this day's blocks were edited
  lastEditedBy?: 'trainer' | 'client'; // Who made the most recent edit to this day
}

// A block in the client's workout
export interface ClientWorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: ClientProgramExercise[];
}

// An exercise in the client's program (fully specified, not just a slot)
export interface ClientProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  sets: number;
  reps: string;
  rest: string;
  tempo?: string;
  notes?: string;
  trainerNotes?: string;
}

// Exercise with regressions/progressions
export interface ExerciseVariation {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  phases: TrainingPhase[];
  injuryFlags: InjuryFlag[]; // Which injuries this exercise may aggravate
  classSafe: boolean;
  
  regressions: {
    exerciseId: string;
    exerciseName: string;
    whenToUse: string;
    coachingCue: string;
  }[];
  
  progressions: {
    exerciseId: string;
    exerciseName: string;
    whenToUse: string;
    coachingCue: string;
  }[];
}
