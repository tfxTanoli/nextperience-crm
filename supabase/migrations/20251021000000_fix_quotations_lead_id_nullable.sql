/*
  # Fix quotations table - make lead_id nullable
  
  The quotations table currently has lead_id as NOT NULL, but the application
  needs to support direct quotations without a lead. This migration makes
  lead_id nullable to allow quotations to be created without an associated lead.
*/

-- Make lead_id nullable in quotations table
ALTER TABLE quotations ALTER COLUMN lead_id DROP NOT NULL;
