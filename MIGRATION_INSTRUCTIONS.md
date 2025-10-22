
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
```bash
supabase db push
```

## Option 3: Using psql
```bash
psql -h db.hsftnenijlcpqbqzpyhk.supabase.co -U postgres -d postgres -f all-migrations.sql
```

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
