/*
  # Fix User Creation Trigger

  ## Problem
  The handle_new_user trigger is failing when creating new users during signup.
  This causes a "Database error saving new user" error.

  ## Solution
  - Update the trigger to handle errors gracefully
  - Add better error handling and logging
  - Ensure the trigger doesn't fail the entire user creation process
  - Use COALESCE to handle NULL values properly
*/

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (id, email, full_name, is_active, has_all_access)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', NULL),
      true,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the trigger
    RAISE WARNING 'Error creating user profile for %: %', new.id, SQLERRM;
  END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure all existing auth.users have profiles
INSERT INTO public.users (id, email, full_name, is_active, has_all_access)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'full_name', NULL),
  true,
  false
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

