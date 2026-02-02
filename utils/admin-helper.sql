-- Helper script to promote a user to administrator
-- Run this in your Supabase SQL Editor

-- Replace 'EMAIL_OF_USER' with the actual email of the user you want to promote
-- Example: update public.profiles set role = 'administrador' where email = 'admin@pizzapos.com';

UPDATE public.profiles
SET role = 'administrador'
WHERE email = 'YOUR_USER_EMAIL_HERE';

-- To check current roles:
-- SELECT email, role FROM public.profiles;
