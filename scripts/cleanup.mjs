import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ozfoqjwsvimbcimvgqxi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Zm9xandzdmltYmNpbXZncXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNjk3NzcsImV4cCI6MjA1MTg0NTc3N30.5ZaSaq5axIRGxA9P0PtuMHw2ORUHv_qjYQx1E7MGiH8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllData() {
  console.log('=== Deleting all Apex Fitness data from Supabase ===\n');

  // Delete workouts
  console.log('Deleting workouts...');
  const { error: workoutsError, count: workoutsCount } = await supabase
    .from('workouts')
    .delete()
    .neq('id', '')
    .select('*', { count: 'exact' });
  console.log(workoutsError ? `  Error: ${workoutsError.message}` : `  Done`);

  // Delete personal_bests
  console.log('Deleting personal_bests...');
  const { error: pbError } = await supabase
    .from('personal_bests')
    .delete()
    .neq('id', '');
  console.log(pbError ? `  Error: ${pbError.message}` : `  Done`);

  // Delete medals
  console.log('Deleting medals...');
  const { error: medalsError } = await supabase
    .from('medals')
    .delete()
    .neq('id', '');
  console.log(medalsError ? `  Error: ${medalsError.message}` : `  Done`);

  // Delete users
  console.log('Deleting users...');
  const { data: deletedUsers, error: usersError } = await supabase
    .from('users')
    .delete()
    .neq('id', '')
    .select();
  
  if (usersError) {
    console.log(`  Error: ${usersError.message}`);
  } else {
    console.log(`  Deleted ${deletedUsers?.length || 0} users`);
  }

  console.log('\n=== Cleanup complete! ===');
}

deleteAllData();
