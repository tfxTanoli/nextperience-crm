import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
console.log(`📍 URL: ${supabaseUrl}\n`);

async function executeSql(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ sql_text: sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

async function executeMigrations() {
  try {
    console.log('📁 Reading migration files...\n');

    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`✅ Found ${files.length} migration files\n`);
    console.log('🚀 Starting migration execution...\n');

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        console.log(`[${i + 1}/${files.length}] ⏳ ${file}`);

        // Execute SQL via REST API
        await executeSql(sql);
        console.log(`           ✅ Success`);
        successCount++;
      } catch (err) {
        console.log(`           ❌ ${err.message}`);
        failureCount++;
        errors.push({ file, error: err.message });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION EXECUTION SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successful: ${successCount}/${files.length}`);
    console.log(`❌ Failed: ${failureCount}/${files.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(({ file, error }) => {
        console.log(`  • ${file}`);
        console.log(`    └─ ${error}`);
      });
    }

    console.log('\n✨ Migration execution complete!');

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

executeMigrations();

