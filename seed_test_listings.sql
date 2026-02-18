-- Seed 30 test listings using an existing user and random active categories.
-- Requires at least one user and one active category.
WITH selected_users AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM users
  WHERE email IN (
    'ericmaximan@yahoo.com',
    'maxitella@yahoo.fr',
    'sylamine@gmail.com'
  )
),
user_count AS (
  SELECT count(*)::int AS total FROM selected_users
),
data AS (
  SELECT generate_series(1, 30) AS idx
),
allowed_categories AS (
  SELECT id
  FROM categories
  WHERE "isActive" = true
    AND (
      lower(slug) IN (
        'motos',
        'vehicules',
        'colocations',
        'locations',
        'campings',
        'hotels'
      )
      OR lower(name) IN (
        'motos',
        'véhicules',
        'vehicules',
        'colocations',
        'locations',
        'campings',
        'hôtels',
        'hotels'
      )
    )
)
INSERT INTO listings (
  title,
  description,
  price,
  currency,
  location,
  contact,
  status,
  details,
  views,
  messages_count,
  category_id,
  flow,
  owner_id
)
SELECT
  format('Annonce test %s', data.idx),
  format('Annonce de test generee automatiquement (%s).', data.idx),
  (10000 + (data.idx * 150))::numeric,
  'XOF',
  jsonb_build_object(
    'city',
    'Douala',
    'address',
    format('Quartier %s', data.idx),
    'hideExact',
    false
  ),
  jsonb_build_object(
    'email',
    'test@lemeket.local',
    'phone',
    '690000000',
    'phoneHidden',
    true,
    'noSalesmen',
    true
  ),
  'published',
  '{}'::jsonb,
  (data.idx * 12),
  (data.idx % 4),
  category.id,
  (
    CASE
      WHEN data.idx % 4 = 0 THEN 'SELL'
      WHEN data.idx % 4 = 1 THEN 'BUY'
      WHEN data.idx % 4 = 2 THEN 'LET'
      ELSE 'RENT'
    END
  )::listings_flow_enum,
  chosen_user.id
FROM data
JOIN user_count ON user_count.total > 0
JOIN selected_users AS chosen_user
  ON (((data.idx - 1) % user_count.total) + 1) = chosen_user.rn
JOIN LATERAL (
  SELECT id
  FROM allowed_categories
  ORDER BY random()
  LIMIT 1
) AS category ON true;
