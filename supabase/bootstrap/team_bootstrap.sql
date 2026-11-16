-- Team bootstrap. NOT a migration. Run once, by hand, in the SQL editor of the project it is meant for.
--
-- Before you run it, replace the placeholders below in your own copy. Do not commit real email addresses.
--   REPLACE_TEAM_NAME      the team's name, e.g. 'ContentForge Team'
--   REPLACE_ADMIN_EMAIL    your sign-in email (you become an admin)
--   REPLACE_CREATOR_EMAIL  one line per creator; delete unused lines
--
-- It is safe to run twice: each insert ignores rows that already exist.
-- It needs the users to have signed up first, because it looks them up in auth.users by email.

-- 1. The team (created once; its id is kept in a variable for the steps below)
INSERT INTO public.teams (name)
SELECT 'REPLACE_TEAM_NAME'
WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE name = 'REPLACE_TEAM_NAME');

-- 2. You, as an admin
INSERT INTO public.team_members (team_id, user_id, role)
SELECT t.id, u.id, 'admin'
FROM public.teams t
JOIN auth.users u ON u.email = 'REPLACE_ADMIN_EMAIL'
WHERE t.name = 'REPLACE_TEAM_NAME'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- 3. Creators you name (one line each; delete the lines you do not need)
INSERT INTO public.team_members (team_id, user_id, role)
SELECT t.id, u.id, 'creator'
FROM public.teams t
JOIN auth.users u ON u.email IN (
  'REPLACE_CREATOR_EMAIL'
)
WHERE t.name = 'REPLACE_TEAM_NAME'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- 4. Check: who is in the team and with which role (emails are shown only in your own editor)
SELECT t.name, m.role, u.email
FROM public.team_members m
JOIN public.teams t ON t.id = m.team_id
JOIN auth.users u ON u.id = m.user_id
WHERE t.name = 'REPLACE_TEAM_NAME'
ORDER BY m.role;
