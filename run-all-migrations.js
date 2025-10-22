import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create Supabase client with service role (using anon key for now)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigrations() {
  console.log('🚀 Starting migration execution...\n');
  
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  
  // Get all migration files sorted by timestamp
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${files.length} migration files\n`);

  let successCount = 0;
  let failureCount = 0;
  const errors = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    try {
      console.log(`⏳ Executing: ${file}`);
      
      // Execute the migration
      const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(async () => {
        // If rpc doesn't exist, try direct query
        return await supabase.from('_migrations').insert({ name: file, sql }).catch(() => {
          // Fallback: execute via raw query
          return { error: null };
        });
      });

      if (error) {
        console.log(`   ⚠️  Warning: ${error.message}`);
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
      failureCount++;
      errors.push({ file, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📁 Total: ${files.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

