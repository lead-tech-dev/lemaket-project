-- Crée un compte administrateur par défaut si l'email n'existe pas déjà.
-- Mot de passe : Admin123!
INSERT INTO "users" (
  "email",
  "firstName",
  "lastName",
  "password",
  "role",
  "isVerified",
  "isPro",
  "isActive",
  "created_at",
  "updatedAt"
) VALUES (
  'admin@sandaga.local',
  'Admin',
  'Sandaga',
  '$2b$12$e/Sz7/qJnBbMzrIZdHB.heLFGOGxGGRXyabC91AS7d5RPtddhBeMW',
  'admin',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT ("email") DO NOTHING;
