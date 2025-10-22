// Script to fix access control issues
// This script removes has_all_access from luqman.haider001@gmail.com

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsftnenijlcpqbqzpyhk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZnRuZW5pamxjcHFicXpweWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0OTk4NzQsImV4cCI6MjA0NTA3NTg3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAccessControl() {
  try {
    console.log('Starting access control fix...');
    
    // Remove has_all_access from luqman.haider001@gmail.com
    const { data, error } = await supabase
      .from('users')
      .update({ has_all_access: false })
      .eq('email', 'luqman.haider001@gmail.com');
    
    if (error) {
      console.error('Error updating user:', error);
      return;
    }
    
    console.log('Successfully removed all access from luqman.haider001@gmail.com');
    console.log('Updated data:', data);
    
    // Verify the change
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('email, has_all_access')
      .eq('email', 'luqman.haider001@gmail.com')
      .single();
    
    if (fetchError) {
      console.error('Error fetching user data:', fetchError);
      return;
    }
    
    console.log('Verification - User data:', userData);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

fixAccessControl();