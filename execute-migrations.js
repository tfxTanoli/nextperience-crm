/**
 * Supabase Migration Executor
 * Reads all migration files and provides SQL for manual execution
 *
 * Usage: node execute-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');

function getMigrationFiles() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

function readMigrationFile(filename) {
  const filepath = path.join(migrationsDir, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

function generateMigrationScript() {
  const files = getMigrationFiles();
  
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SUPABASE MIGRATION SCRIPT GENERATOR');
  console.log('='.repeat(80));
  console.log(`\n📋 Found ${files.length} migration files\n`);

  let combinedSQL = '';
  let migrationCount = 0;

  files.forEach((filename, index) => {
    const fileNumber = index + 1;
    console.log(`[${fileNumber}/${files.length}] Processing: ${filename}`);
    
    try {
      const sql = readMigrationFile(filename);
      
      // Add migration header
      combinedSQL += `\n-- ============================================\n`;
      combinedSQL += `-- Migration ${fileNumber}: ${filename}\n`;
      combinedSQL += `-- ============================================\n\n`;
      
      combinedSQL += sql;
      combinedSQL += '\n\n';
      
      migrationCount++;
    } catch (error) {
      console.error(`  ❌ Error reading file: ${error.message}`);
    }
  });

  // Save combined SQL
  const outputFile = path.join(__dirname, 'all-migrations.sql');
  fs.writeFileSync(outputFile, combinedSQL);

  console.log(`\n✅ Generated combined migration script`);
  console.log(`📁 Output file: ${outputFile}`);
  console.log(`📊 Total migrations: ${migrationCount}`);
  console.log(`📏 Total SQL size: ${(combinedSQL.length / 1024).toFixed(2)} KB\n`);

  // Generate instructions
  const instructions = `
# How to Execute Migrations

## Option 1: Using Supabase Dashboard (Recommended)
1. Go to https://app.supabase.com
2. Select your project: hsftnenijlcpqbqzpyhk
3. Go to SQL Editor
4. Click "New Query"
5. Copy the entire content of all-migrations.sql
6. Paste into the SQL editor
7. Click "Run"

## Option 2: Using Supabase CLI
\`\`\`bash
supabase db push
\`\`\`

## Option 3: Using psql
\`\`\`bash
psql -h db.hsftnenijlcpqbqzpyhk.supabase.co -U postgres -d postgres -f all-migrations.sql
\`\`\`

## Verification
After running migrations, verify:
1. Check tables exist in Supabase dashboard
2. Run test queries
3. Verify default data was seeded
4. Test authentication

## Troubleshooting
- If you get "already exists" errors, that's normal - migrations are idempotent
- Check Supabase logs for detailed error messages
- Ensure you're using the correct credentials
- Verify network connectivity to Supabase

## Next Steps
1. Execute all migrations
2. Verify database schema
3. Seed initial data if needed
4. Run application tests
5. Deploy to production
`;

  const instructionsFile = path.join(__dirname, 'MIGRATION_INSTRUCTIONS.md');
  fs.writeFileSync(instructionsFile, instructions);

  console.log('📖 Generated instructions file: MIGRATION_INSTRUCTIONS.md\n');
  console.log('='.repeat(80));
  console.log('✨ SCRIPT GENERATION COMPLETE');
  console.log('='.repeat(80) + '\n');
}

// Generate the script
generateMigrationScript();

