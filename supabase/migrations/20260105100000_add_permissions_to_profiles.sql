-- Add permissions field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Add comment to document permissions field
COMMENT ON COLUMN public.profiles.permissions IS 'JSONB field storing user permissions. Example: {"poker": true, "premium": true, "admin": false}';

-- Create index for faster permission queries (optional, useful for admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_permissions ON public.profiles USING GIN (permissions);
