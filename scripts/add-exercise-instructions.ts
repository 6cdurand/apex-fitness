/**
 * Add instructions to all exercises missing them in exercises.ts
 * Usage: npx tsx scripts/add-exercise-instructions.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Comprehensive instructions for every exercise
const instructions: Record<string, string> = {
  // CHEST
  'decline-bench-press': 'Lie on a decline bench, grip the bar slightly wider than shoulder width, lower to lower chest, press up to full extension.',
  'dumbbell-bench-press': 'Lie on a flat bench holding dumbbells at chest level, press up until arms are extended, lower with control.',
  'incline-dumbbell-press': 'Set bench to 30-45 degrees, press dumbbells up from shoulder level to full extension overhead.',
  'dumbbell-flyes': 'Lie on a flat bench, hold dumbbells above chest with slight elbow bend, lower arms out to sides in an arc, squeeze chest to return.',
  'cable-flyes': 'Stand between cable pulleys set at shoulder height, step forward, bring handles together in front of chest with a hugging motion.',
  'chest-dips': 'Lean forward on parallel bars, lower body by bending arms until chest is stretched, press back up.',
  'push-ups': 'Start in a high plank, lower chest to the floor by bending elbows, push back up to full arm extension.',
  'machine-chest-press': 'Sit in the machine, grip handles at chest level, press forward to full extension, return slowly.',
  'pec-deck': 'Sit in the machine with forearms on pads, bring arms together in front of chest, squeeze, then slowly return.',

  // BACK
  'sumo-deadlift': 'Take a wide stance with toes pointed out, grip the bar between your legs, drive through your heels to stand up.',
  'romanian-deadlift': 'Hold bar at hip height, hinge at hips pushing them back, lower bar along legs keeping back flat, return to standing.',
  'dumbbell-rdl': 'Hold dumbbells in front of thighs, hinge at hips keeping back flat, lower dumbbells along legs, drive hips forward to stand.',
  'barbell-row': 'Hinge forward at hips, grip bar wider than shoulder width, pull bar to lower chest, squeeze shoulder blades together.',
  'pendlay-row': 'Hinge forward until torso is parallel to floor, bar rests on ground each rep, explosively row bar to lower chest.',
  'dumbbell-row': 'Place one hand and knee on a bench, row the dumbbell to your hip with the other arm, squeeze shoulder blade at top.',
  'pull-ups': 'Hang from a bar with overhand grip wider than shoulders, pull chin above bar, lower with control.',
  'chin-ups': 'Hang from a bar with underhand grip at shoulder width, pull chin above bar, lower with control.',
  'lat-pulldown': 'Sit at the machine, grip the wide bar overhead, pull bar down to upper chest, squeeze lats, return slowly.',
  'close-grip-pulldown': 'Sit at the lat pulldown machine, use a close-grip handle, pull down to upper chest, squeeze lats.',
  'cable-row': 'Sit upright at the cable row machine, pull handle to lower chest, squeeze shoulder blades together, return with control.',
  't-bar-row': 'Straddle the T-bar, hinge forward, grip handle, row weight to chest while keeping back flat.',
  'machine-row': 'Sit at the row machine, grip handles, pull toward torso squeezing shoulder blades, return slowly.',
  'face-pulls': 'Attach rope to high cable, pull toward face with elbows high, externally rotate at the end, squeeze rear delts.',
  'straight-arm-pulldown': 'Stand at a cable machine, arms straight, push the bar down in an arc to your thighs, squeezing lats.',
  'hyperextensions': 'Position yourself face-down on the hyperextension bench, lower torso down, raise back up by extending the lower back.',

  // SHOULDERS
  'seated-overhead-press': 'Sit on a bench with back support, press barbell from shoulder level overhead to full extension.',
  'dumbbell-shoulder-press': 'Sit or stand, hold dumbbells at shoulder height, press overhead to full extension, lower with control.',
  'arnold-press': 'Start with dumbbells at chin height palms facing you, press up while rotating palms to face forward at top.',
  'lateral-raises': 'Stand with dumbbells at sides, raise arms out to sides until parallel with floor, lower with control.',
  'cable-lateral-raises': 'Stand sideways to a low cable pulley, raise the handle out to the side until arm is parallel with floor.',
  'front-raises': 'Stand holding dumbbells in front of thighs, raise one or both arms forward to shoulder height, lower slowly.',
  'rear-delt-flyes': 'Bend forward at hips, hold dumbbells below chest, raise arms out to sides squeezing rear delts.',
  'reverse-pec-deck': 'Sit facing the pec deck machine, push handles apart by squeezing shoulder blades and rear delts.',
  'upright-rows': 'Hold barbell with narrow grip, pull bar up along your body to chin height, leading with elbows.',
  'shrugs': 'Hold barbell at arms length, shrug shoulders straight up toward ears, hold briefly, lower.',
  'dumbbell-shrugs': 'Hold dumbbells at your sides, shrug shoulders straight up toward ears, hold briefly, lower.',

  // BICEPS
  'barbell-curl': 'Stand with barbell at arms length, curl up by bending elbows keeping upper arms still, lower with control.',
  'ez-bar-curl': 'Grip the EZ bar on the angled portions, curl up keeping elbows at sides, lower with control.',
  'dumbbell-curl': 'Stand or sit holding dumbbells at sides, curl up rotating palms to face shoulders, lower slowly.',
  'hammer-curls': 'Hold dumbbells with neutral grip (palms facing each other), curl up keeping wrists neutral throughout.',
  'incline-dumbbell-curl': 'Sit on an incline bench, let arms hang straight down with dumbbells, curl up, lower slowly for a deep stretch.',
  'preacher-curl': 'Rest upper arms on the preacher bench pad, curl the bar up, lower with control for a full stretch.',
  'concentration-curl': 'Sit on bench, rest elbow against inner thigh, curl dumbbell up to shoulder, squeeze at top.',
  'cable-curl': 'Stand at a low cable pulley, grip the handle, curl up keeping elbows at sides, lower with control.',
  'spider-curls': 'Lie chest-down on an incline bench, let arms hang straight, curl dumbbells up squeezing biceps.',

  // TRICEPS
  'close-grip-bench': 'Lie on bench, grip bar at shoulder width or narrower, lower to chest, press up focusing on triceps.',
  'tricep-dips': 'Support yourself on parallel bars with arms straight, lower body by bending elbows, press back up.',
  'skull-crushers': 'Lie on bench holding bar or dumbbells above chest, bend elbows to lower weight toward forehead, extend back up.',
  'tricep-pushdown': 'Stand at a high cable pulley, push the bar down by extending elbows, keep upper arms at sides.',
  'rope-pushdown': 'Attach rope to high cable, push down and spread the rope apart at the bottom, squeeze triceps.',
  'overhead-tricep-extension': 'Hold a dumbbell overhead with both hands, lower behind head by bending elbows, extend back up.',
  'cable-overhead-extension': 'Face away from a high cable, grip rope overhead, extend arms forward and up, squeeze triceps.',
  'kickbacks': 'Hinge forward, hold dumbbell with arm bent at 90 degrees, extend arm straight back, squeeze tricep.',
  'diamond-pushups': 'Place hands close together under chest forming a diamond shape, lower chest to hands, push back up.',

  // LEGS - QUADS
  'front-squat': 'Rest barbell on front delts with elbows high, squat down keeping torso upright, drive through heels to stand.',
  'goblet-squat': 'Hold a dumbbell or kettlebell at chest level, squat down keeping chest up, push through heels to stand.',
  'leg-press': 'Sit in the leg press machine, place feet shoulder-width on the platform, lower the weight by bending knees, press back up.',
  'hack-squat': 'Stand in the hack squat machine, lower body by bending knees, press back up through heels.',
  'leg-extension': 'Sit in the machine with shins behind pad, extend legs straight out, squeeze quads at top, lower slowly.',
  'lunges': 'Step forward with one leg, lower back knee toward ground, push off front foot to return. Alternate legs.',
  'walking-lunges': 'Step forward into a lunge, drive through front heel to bring back foot forward into next lunge. Continue walking.',
  'split-squat': 'Stand in a staggered stance, lower back knee toward the ground, push through front heel to stand back up.',
  'bulgarian-split-squat': 'Place rear foot on a bench behind you, lower back knee toward ground, push through front heel to stand.',
  'step-ups': 'Step onto a box or bench with one foot, drive through that foot to stand on top, step back down. Alternate legs.',
  'sissy-squat': 'Hold onto a support, lean back while bending knees, lower body with quads doing the work, push back up.',
  'reverse-lunges': 'Step one foot backward into a lunge position, lower back knee toward the ground, push off to return. Alternate legs.',
  'box-squat': 'Stand in front of a box, squat down to sit briefly on the box, then drive through heels to stand back up.',

  // LEGS - HAMSTRINGS & GLUTES
  'leg-curl': 'Lie face down on the machine, curl heels toward glutes by contracting hamstrings, lower slowly.',
  'seated-leg-curl': 'Sit in the machine with calves on the pad, curl legs down and back, squeeze hamstrings, return slowly.',
  'stiff-leg-deadlift': 'Hold barbell, keep legs nearly straight, hinge at hips lowering bar toward feet, return to standing.',
  'good-mornings': 'Place barbell on upper back, hinge forward at hips keeping back straight, return to standing.',
  'hip-thrust': 'Sit with upper back against a bench, barbell over hips, drive hips up squeezing glutes at top, lower.',
  'glute-bridge': 'Lie on back with knees bent, drive hips up squeezing glutes at the top, lower with control.',
  'cable-kickbacks': 'Attach ankle strap to low cable, face the machine, kick leg straight back squeezing glutes.',
  'glute-ham-raise': 'Lock feet in the GHD machine, lower torso forward with control, pull back up using hamstrings and glutes.',
  'nordic-curl': 'Kneel with feet anchored, slowly lower your torso forward keeping hips extended, push back up.',

  // CALVES
  'standing-calf-raise': 'Stand on a raised surface, lower heels below the platform, rise up onto toes squeezing calves.',
  'seated-calf-raise': 'Sit in the machine with knees under the pad, rise up onto toes, squeeze calves at top, lower slowly.',
  'donkey-calf-raise': 'Bend at hips with weight on lower back, lower heels below platform, rise up onto toes.',
  'leg-press-calf-raise': 'Sit in the leg press, place toes on the bottom edge of platform, push through toes extending ankles.',

  // ABS & CORE
  'crunches': 'Lie on back with knees bent, curl shoulders off the floor by contracting abs, lower with control.',
  'sit-ups': 'Lie on back with knees bent, sit all the way up by contracting abs, lower back down with control.',
  'leg-raises': 'Hang from a bar, raise legs until parallel with the ground or higher, lower with control.',
  'lying-leg-raises': 'Lie flat on back, keep legs straight, raise them to vertical, lower slowly without touching floor.',
  'plank': 'Hold a push-up position on forearms or hands, keep body in a straight line from head to heels.',
  'russian-twists': 'Sit with torso leaned back, feet off the ground, rotate torso side to side touching the floor.',
  'cable-crunches': 'Kneel below a high cable, hold rope behind head, crunch down contracting abs, return slowly.',
  'ab-wheel-rollout': 'Kneel holding the ab wheel, roll forward extending body, pull back using core to return to kneeling.',
  'bicycle-crunches': 'Lie on back, alternate bringing opposite elbow to knee while extending the other leg.',
  'dead-bug': 'Lie on back with arms up and knees at 90 degrees, extend opposite arm and leg while keeping back flat.',
  'pallof-press': 'Stand sideways to a cable, hold handle at chest, press arms straight out resisting rotation, return to chest.',
  'woodchoppers': 'Stand sideways to a cable, pull the handle diagonally across your body from high to low or low to high.',
  'mountain-climbers': 'Start in a push-up position, alternate driving knees toward chest in a running motion.',
  'shoulder-tap-plank': 'Hold a high plank position, lift one hand to tap opposite shoulder, alternate sides while keeping hips still.',
  'knee-raises': 'Hang from a bar or use a captain\'s chair, raise knees toward chest, lower with control.',

  // FOREARMS
  'wrist-curls': 'Sit with forearms resting on thighs palms up, curl the bar up by flexing wrists, lower slowly.',
  'reverse-wrist-curls': 'Sit with forearms on thighs palms down, extend wrists lifting the bar, lower slowly.',
  'farmers-walk': 'Hold heavy dumbbells at sides, walk with upright posture, keeping core tight and shoulders back.',

  // ADDITIONAL MACHINES
  'machine-shoulder-press': 'Sit in the machine, grip handles at shoulder height, press overhead to full extension, lower slowly.',
  'chest-fly-machine': 'Sit in the machine, grip handles with arms wide, bring handles together in front of chest, squeeze, return.',
  'hip-abduction': 'Sit in the machine with legs together, push knees apart against the pads, squeeze glutes, return slowly.',
  'hip-adduction': 'Sit in the machine with legs apart, bring knees together against the pads, squeeze inner thighs, return.',
  'hip-thrust-machine': 'Sit in the machine with upper back supported, drive hips up against the pad, squeeze glutes, lower.',
  'assisted-pull-up': 'Kneel or stand on the assist platform, grip the bar overhead, pull chin above bar with machine assistance.',
  'ab-crunch-machine': 'Sit in the machine, grip handles, crunch forward contracting abs against resistance, return slowly.',
  'lateral-raise-machine': 'Sit in the machine with arms under pads, raise arms out to sides to shoulder height, lower slowly.',
  'bicep-curl-machine': 'Sit in the machine, grip handles with arms extended, curl up squeezing biceps, lower slowly.',
  'tricep-extension-machine': 'Sit in the machine, grip handles, extend arms by pushing down, squeeze triceps, return slowly.',
  'incline-chest-press-machine': 'Sit in the incline machine, grip handles, press forward and up, return slowly.',
  'high-row-machine': 'Sit in the machine, grip overhead handles, pull down and back toward your chest, squeeze back.',
  'rdl-machine': 'Stand in the machine with hips against pad, hinge forward keeping back straight, drive hips to return.',
  'cable-fly-low-to-high': 'Stand between low cable pulleys, bring handles up and together in front of upper chest in an arc.',
  'seated-row-machine': 'Sit at the machine, grip handles, pull toward torso squeezing shoulder blades, return slowly.',
  'chest-supported-row-machine': 'Sit with chest against the pad, grip handles, row toward torso squeezing back.',
  'rear-delt-machine': 'Sit facing the machine, push handles apart by squeezing rear delts and shoulder blades.',
  'glute-kickback-machine': 'Stand in the machine, push one leg back against the pad squeezing glutes, return slowly.',
  'inner-thigh-machine': 'Sit with legs apart, squeeze legs together against the pads, return slowly.',
  'outer-thigh-machine': 'Sit with legs together, push knees apart against the pads, squeeze outer glutes, return.',
  'preacher-curl-machine': 'Sit with upper arms on the pad, curl handles up squeezing biceps, lower with control.',
  'tricep-dip-machine': 'Sit in the machine, grip handles, press down extending arms, squeeze triceps, return slowly.',
  'cable-crossover': 'Stand between high cable pulleys, step forward, bring handles down and together in front of chest.',

  // SMITH MACHINE
  'smith-machine-bench-press': 'Lie on bench under the Smith machine bar, unrack, lower to chest, press up.',
  'smith-machine-incline-press': 'Set bench to 30-45 degrees under Smith machine, unrack bar, lower to upper chest, press up.',
  'smith-machine-squat': 'Stand under the Smith machine bar on upper back, unrack, squat down, drive through heels to stand.',
  'smith-machine-shoulder-press': 'Sit or stand under the Smith bar at shoulder level, press overhead, lower with control.',
  'smith-machine-row': 'Hinge forward under the Smith machine, grip bar, row to lower chest, squeeze back.',
  'smith-machine-lunge': 'Stand under Smith bar, step one foot forward into a lunge, lower back knee, push back up.',
  'smith-machine-calf-raise': 'Stand under Smith bar on a raised surface, lower heels, rise onto toes squeezing calves.',
  'smith-machine-shrug': 'Stand holding Smith bar at arms length, shrug shoulders up toward ears, hold, lower.',
  'smith-machine-upright-row': 'Stand holding Smith bar with narrow grip, pull up along body to chin height leading with elbows.',
  'smith-machine-hip-thrust': 'Sit with back against a bench, Smith bar over hips, drive hips up squeezing glutes.',

  // KETTLEBELL
  'kettlebell-swing': 'Stand with feet wider than shoulders, hinge hips to swing kettlebell back between legs, thrust hips forward to swing it up to chest height.',
  'kettlebell-deadlift': 'Stand over kettlebell, hinge at hips to grip handle, drive through heels to stand keeping back flat.',
  'kettlebell-goblet-squat': 'Hold kettlebell by horns at chest level, squat down keeping chest up, push through heels to stand.',
  'kettlebell-rdl': 'Hold kettlebell with both hands, hinge at hips pushing them back, lower along legs, drive hips forward to stand.',

  // OLYMPIC LIFTS
  'power-clean': 'Start with bar on floor, pull explosively from ground, catch bar on front delts in a quarter squat.',
  'power-snatch': 'Start with bar on floor, pull explosively overhead in one motion, catch with arms locked out.',
  'clean-and-jerk': 'Clean bar to shoulders, then drive bar overhead by dipping and extending legs.',
  'hang-clean': 'Start with bar at hip height, dip and explosively pull bar to shoulders, catching in a quarter squat.',
  'hang-snatch': 'Start with bar at hip height, explosively pull bar overhead in one motion, catch with arms locked.',
  'squat-clean': 'Pull bar from floor, catch on front delts in a full front squat, stand up to complete the lift.',

  // COMPOUND / FUNCTIONAL
  'dumbbell-curl-to-press': 'Curl dumbbells to shoulders, then press overhead in one fluid motion, reverse to return.',
  'med-ball-slams': 'Lift medicine ball overhead, slam it forcefully into the ground, squat to pick it up and repeat.',
  'push-press': 'Hold barbell at shoulders, dip knees slightly, then explosively drive bar overhead using leg power.',
  'battle-ropes': 'Hold rope ends, create alternating waves by rapidly raising and lowering arms. Keep core tight.',

  // WARMUP & MOBILITY
  'banded-glute-bridge': 'Place band above knees, lie on back with knees bent, drive hips up pushing knees out, squeeze glutes.',
  'banded-clamshells': 'Lie on side with band above knees, keep feet together, open top knee against band resistance, lower slowly.',
  'banded-lateral-walk': 'Place band above ankles or knees, stand in half squat, step sideways maintaining tension on the band.',
  'banded-monster-walk': 'Place band above ankles, stand in half squat, walk forward in diagonal steps maintaining band tension.',
  'bird-dog': 'On all fours, extend opposite arm and leg simultaneously, hold briefly, return and switch sides.',
  'cat-cow-stretch': 'On all fours, alternate between arching back up (cat) and dropping belly down (cow).',
  'world-greatest-stretch': 'Lunge forward, place opposite hand on ground, rotate torso opening chest toward front leg.',
  'hip-circles': 'Stand on one leg, lift other knee and make large circles with the hip joint. Switch directions.',
  'leg-swings': 'Hold a support, swing one leg forward and backward in a controlled arc. Switch to side-to-side swings.',
  'arm-circles': 'Extend arms to sides, make small circles gradually increasing to large circles. Reverse direction.',
  'shoulder-dislocates': 'Hold a band or stick wide, raise overhead and rotate behind your back keeping arms straight.',
  'banded-pull-aparts': 'Hold a band at shoulder width and height, pull hands apart stretching the band, squeeze shoulder blades.',
  'banded-face-pulls': 'Hold a band at face height, pull apart toward your face with elbows high, externally rotate at the end.',
  'thoracic-rotations': 'On all fours or side-lying, rotate through your thoracic spine opening chest toward ceiling.',
  'foam-roll-upper-back': 'Lie on a foam roller placed under upper back, slowly roll from mid-back to shoulders, pausing on tight spots.',
  'foam-roll-quads': 'Lie face down with foam roller under thighs, roll from hip to just above knee, pausing on tight spots.',
  'foam-roll-glutes': 'Sit on foam roller, cross one ankle over opposite knee, roll over the glute muscles.',
  'ankle-circles': 'Lift one foot off ground, rotate ankle in circles clockwise then counterclockwise. Switch feet.',
  'bodyweight-squat': 'Stand with feet shoulder-width apart, squat down keeping chest up and weight in heels, stand back up.',
  'inchworm': 'Stand, bend forward to place hands on floor, walk hands out to plank, walk feet back to hands, stand up.',
  'high-knees': 'Run in place, driving knees as high as possible while pumping arms. Maintain an upright posture.',
  'butt-kicks': 'Run in place, kicking heels up toward glutes with each step. Keep a quick pace.',
  'jumping-jacks': 'Jump feet out wide while raising arms overhead, jump back to start. Maintain a steady rhythm.',
  'plank-hold': 'Hold a forearm or high plank position keeping body in a straight line. Engage core throughout.',
  '90-90-hip-stretch': 'Sit with front leg bent 90 degrees in front and back leg bent 90 degrees to the side, lean forward.',
  'hip-flexor-stretch': 'Kneel on one knee, push hips forward while keeping torso upright. Hold and switch sides.',
  'pigeon-stretch': 'From a lunge, bring front shin across the body, lower hips toward the ground, lean forward.',
  'seated-hamstring-stretch': 'Sit with one leg extended, reach toward toes hinging at hips until hamstring stretch is felt.',
  'standing-quad-stretch': 'Stand on one leg, pull opposite heel toward glutes, hold and switch sides.',
  'wall-angels': 'Stand with back flat against wall, arms in goal-post position, slide arms up and down the wall.',

  // CARDIO MACHINES
  'rowing-machine': 'Sit on the rower, strap feet in, drive with legs first then pull handle to lower chest, reverse to return.',
  'ski-erg': 'Stand at the machine, reach arms up to grab handles, pull down using lats and core in a skiing motion.',
  'assault-bike': 'Sit on the bike, pedal with legs while pushing and pulling the handles with arms.',
  'stationary-bike': 'Sit on the bike, adjust seat height, pedal at desired intensity maintaining good posture.',
  'stair-master': 'Step onto the machine, climb stairs at a steady pace, keep upright without leaning on handles.',

  // Additional warmup array exercises
  'torso-twists': 'Stand with feet shoulder-width, rotate torso left and right, letting arms swing naturally.',
  'neck-rolls': 'Slowly roll head in circles, gently stretching neck muscles. Reverse direction after several reps.',
  'inchworms': 'Stand, bend forward to place hands on floor, walk hands out to plank, walk feet back to hands, stand up.',
  'glute-bridges': 'Lie on back with knees bent, drive hips up squeezing glutes at top, lower with control.',
  'bird-dogs': 'On all fours, extend opposite arm and leg simultaneously, hold briefly, return and switch sides.',
  'dead-bugs': 'Lie on back, arms up and knees at 90 degrees, extend opposite arm and leg while keeping back flat.',
  'clamshells': 'Lie on side with knees bent, keep feet together, open top knee like a clamshell, close slowly.',
  'band-pull-aparts': 'Hold a band at shoulder width and height, pull hands apart stretching the band, squeeze shoulder blades.',
  'cat-cow': 'On all fours, alternate between arching back up (cat) and dropping belly down (cow).',
  'scapular-push-ups': 'In push-up position with arms straight, protract and retract shoulder blades without bending elbows.',

  // Cooldown stretches from warmupExercises array
  'quad-stretch': 'Stand on one leg, pull opposite heel toward glutes, keep knees together. Hold and switch sides.',
  'chest-stretch': 'Place forearm against a wall or doorframe at shoulder height, lean forward until chest stretch is felt.',
  'tricep-stretch': 'Raise one arm overhead, bend elbow, use opposite hand to gently push elbow back.',
  'pigeon-pose': 'From a lunge, bring front shin across the body, lower hips, lean forward over front leg.',
  'walking-lunges': 'Step forward into a lunge, drive through front heel to bring back foot forward into next lunge.',

  // Cardio exercises from cardioExercises array
  'running': 'Run at a steady pace with upright posture, landing midfoot, arms swinging naturally at sides.',
  'cycling': 'Pedal at desired intensity, maintain good posture, adjust resistance as needed.',
  'rowing': 'Drive with legs, lean back slightly, pull handle to lower chest. Reverse the sequence to return.',
  'swimming': 'Move through water using chosen stroke technique, maintaining steady breathing rhythm.',
  'elliptical': 'Step onto the machine, pedal in an elliptical motion while holding or pushing handles.',
  'stair-climber': 'Step onto the machine, climb stairs at a steady pace, keep upright posture.',
  'jump-rope': 'Hold rope handles, swing rope overhead, jump with both feet clearing the rope on each revolution.',
  'burpees': 'Drop to the floor into a push-up, push up, jump feet toward hands, explosively jump up with arms overhead.',
  'box-jumps': 'Stand facing a box, swing arms and jump up onto the box landing softly, step back down.',
  'sled-push': 'Grip the sled handles, lean forward, drive legs to push the sled across the floor.',
  'sprints': 'Run at maximum effort for short distances, focusing on explosive drive and arm pump.',
};

// Read the exercises file
const filePath = path.join(__dirname, '..', 'src', 'lib', 'exercises.ts');
let content = fs.readFileSync(filePath, 'utf-8');

let added = 0;
let skipped = 0;

for (const [id, instruction] of Object.entries(instructions)) {
  const idPattern = `id: '${id}'`;
  
  // Find all occurrences of this ID in the file
  let searchFrom = 0;
  while (true) {
    const idIndex = content.indexOf(idPattern, searchFrom);
    if (idIndex === -1) break;
    
    // Find the closing brace of this exercise object
    const closingBrace = content.indexOf('},', idIndex);
    if (closingBrace === -1) {
      searchFrom = idIndex + 1;
      continue;
    }
    
    // Check if instructions already exist in this block
    const block = content.substring(idIndex, closingBrace);
    if (block.includes('instructions:')) {
      searchFrom = closingBrace + 1;
      skipped++;
      continue;
    }
    
    // Escape single quotes in instructions
    const escaped = instruction.replace(/'/g, "\\'");
    
    // Find the right indentation by looking at the line before the closing brace
    const lastNewline = content.lastIndexOf('\n', closingBrace);
    const lineContent = content.substring(lastNewline + 1, closingBrace);
    const indent = lineContent.match(/^\s*/)?.[0] || '    ';
    
    // Insert instructions before the closing brace
    const instructionLine = `\n${indent}instructions: '${escaped}',`;
    content = content.substring(0, closingBrace) + instructionLine + content.substring(closingBrace);
    added++;
    
    searchFrom = closingBrace + instructionLine.length + 1;
  }
}

fs.writeFileSync(filePath, content);
console.log(`✅ Added instructions to ${added} exercise entries (skipped ${skipped} that already had them)`);
