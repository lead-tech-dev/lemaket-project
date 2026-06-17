-- Import helper: OSM (planet_osm_*) -> app tables (geo_cities / geo_neighborhoods)
-- Prerequisites:
-- 1) osm2pgsql import done into same DB (tables planet_osm_point / planet_osm_polygon)
-- 2) migration 20260226170000 already applied
-- Notes:
-- - No ON CONFLICT usage: this script uses UPDATE + INSERT to avoid dependency on
--   local unique constraint naming differences.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- 1) CITIES FROM OSM
-- =========================
CREATE TEMP TABLE tmp_osm_cities ON COMMIT DROP AS
WITH raw_cities AS (
  SELECT
    p.osm_id,
    COALESCE(NULLIF(BTRIM(p.name), ''), NULLIF(BTRIM(p.tags -> 'name'), '')) AS name,
    LOWER(COALESCE(NULLIF(BTRIM(p.place), ''), NULLIF(BTRIM(p.tags -> 'place'), ''))) AS place_type,
    LOWER(COALESCE(NULLIF(BTRIM(p.boundary), ''), NULLIF(BTRIM(p.tags -> 'boundary'), ''))) AS boundary,
    COALESCE(NULLIF(BTRIM(p.tags -> 'admin_level'), ''), NULLIF(BTRIM(p.admin_level::text), '')) AS admin_level,
    NULLIF(
      COALESCE(
        p.tags -> 'addr:state',
        p.tags -> 'state',
        p.tags -> 'is_in:state',
        p.tags -> 'addr:region',
        p.tags -> 'region'
      ),
      ''
    ) AS region,
    ST_Y(ST_Transform(p.way, 4326)) AS lat,
    ST_X(ST_Transform(p.way, 4326)) AS lng,
    1 AS source_priority
  FROM planet_osm_point p

  UNION ALL

  SELECT
    p.osm_id,
    COALESCE(NULLIF(BTRIM(p.name), ''), NULLIF(BTRIM(p.tags -> 'name'), '')) AS name,
    LOWER(COALESCE(NULLIF(BTRIM(p.place), ''), NULLIF(BTRIM(p.tags -> 'place'), ''))) AS place_type,
    LOWER(COALESCE(NULLIF(BTRIM(p.boundary), ''), NULLIF(BTRIM(p.tags -> 'boundary'), ''))) AS boundary,
    COALESCE(NULLIF(BTRIM(p.tags -> 'admin_level'), ''), NULLIF(BTRIM(p.admin_level::text), '')) AS admin_level,
    NULLIF(
      COALESCE(
        p.tags -> 'addr:state',
        p.tags -> 'state',
        p.tags -> 'is_in:state',
        p.tags -> 'addr:region',
        p.tags -> 'region'
      ),
      ''
    ) AS region,
    ST_Y(ST_PointOnSurface(ST_Transform(p.way, 4326))) AS lat,
    ST_X(ST_PointOnSurface(ST_Transform(p.way, 4326))) AS lng,
    2 AS source_priority
  FROM planet_osm_polygon p
),
candidate_cities AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY BTRIM(LOWER(REGEXP_REPLACE(UNACCENT(name), '\s+', ' ', 'g')))
      ORDER BY source_priority ASC
    ) AS rn
  FROM raw_cities
  WHERE name IS NOT NULL
    AND BTRIM(name) <> ''
    AND UNACCENT(BTRIM(name)) !~ '^[0-9]+$'
    AND (
      place_type IN ('city', 'town', 'municipality', 'borough', 'village', 'locality')
      OR admin_level IN ('6', '7', '8')
      OR (boundary = 'administrative' AND admin_level IN ('4', '5', '6', '7', '8'))
    )
)
SELECT
  c.name,
  BTRIM(LOWER(REGEXP_REPLACE(UNACCENT(c.name), '\s+', ' ', 'g'))) AS normalized_name,
  LOWER(REGEXP_REPLACE(UNACCENT(c.name), '[^a-zA-Z0-9]+', '-', 'g')) ||
    '-' || SUBSTRING(MD5(c.name || c.osm_id::text) FROM 1 FOR 6) AS slug,
  c.region,
  c.lat,
  c.lng,
  COALESCE(NULLIF(c.place_type, ''), 'city') AS place_type
FROM candidate_cities c
WHERE c.rn = 1;

UPDATE geo_cities city
SET
  name = src.name,
  normalized_name = src.normalized_name,
  region = COALESCE(src.region, city.region),
  lat = src.lat,
  lng = src.lng,
  place_type = src.place_type,
  is_active = TRUE,
  "updatedAt" = NOW()
FROM tmp_osm_cities src
WHERE city.slug = src.slug;

INSERT INTO geo_cities (
  id,
  created_at,
  "updatedAt",
  name,
  slug,
  normalized_name,
  region,
  country_code,
  lat,
  lng,
  place_type,
  is_active,
  is_popular
)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  src.name,
  src.slug,
  src.normalized_name,
  src.region,
  'CM',
  src.lat,
  src.lng,
  src.place_type,
  TRUE,
  FALSE
FROM tmp_osm_cities src
WHERE NOT EXISTS (
  SELECT 1
  FROM geo_cities city
  WHERE city.slug = src.slug
);

-- Fallback: cities from existing listings if OSM place tags are sparse.
WITH listing_cities AS (
  SELECT
    LOWER(BTRIM(location->>'city')) AS normalized_name,
    INITCAP(LOWER(BTRIM(location->>'city'))) AS name,
    AVG(
      COALESCE(
        NULLIF(location->>'lat', ''),
        NULLIF(location->>'latitude', '')
      )::double precision
    ) AS lat,
    AVG(
      COALESCE(
        NULLIF(location->>'lng', ''),
        NULLIF(location->>'lon', ''),
        NULLIF(location->>'longitude', '')
      )::double precision
    ) AS lng
  FROM listings
  WHERE location IS NOT NULL
    AND COALESCE(BTRIM(location->>'city'), '') <> ''
    AND COALESCE(location->>'lat', location->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    AND COALESCE(location->>'lng', location->>'lon', location->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
  GROUP BY LOWER(BTRIM(location->>'city'))
)
INSERT INTO geo_cities (
  id,
  created_at,
  "updatedAt",
  name,
  slug,
  normalized_name,
  region,
  country_code,
  lat,
  lng,
  place_type,
  is_active,
  is_popular
)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  c.name,
  LOWER(REGEXP_REPLACE(UNACCENT(c.name), '[^a-zA-Z0-9]+', '-', 'g')) ||
    '-' || SUBSTRING(MD5(c.normalized_name || '-listing') FROM 1 FOR 6),
  c.normalized_name,
  NULL,
  'CM',
  c.lat,
  c.lng,
  'city',
  TRUE,
  FALSE
FROM listing_cities c
WHERE c.lat IS NOT NULL
  AND c.lng IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM geo_cities city
    WHERE city.normalized_name = c.normalized_name
  );

-- Hard fallback for main cities to avoid empty geo data in dev.
WITH seed(name, normalized_name, region, lat, lng) AS (
  VALUES
    ('Douala', 'douala', 'Littoral', 4.0511, 9.7679),
    ('Yaounde', 'yaounde', 'Centre', 3.8480, 11.5021),
    ('Bafoussam', 'bafoussam', 'Ouest', 5.4781, 10.4170),
    ('Bamenda', 'bamenda', 'Nord-Ouest', 5.9631, 10.1591),
    ('Garoua', 'garoua', 'Nord', 9.3014, 13.3977),
    ('Maroua', 'maroua', 'Extreme-Nord', 10.5913, 14.3159)
)
INSERT INTO geo_cities (
  id,
  created_at,
  "updatedAt",
  name,
  slug,
  normalized_name,
  region,
  country_code,
  lat,
  lng,
  place_type,
  is_active,
  is_popular
)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  s.name,
  s.normalized_name || '-' || SUBSTRING(MD5(s.normalized_name || '-seed') FROM 1 FOR 6),
  s.normalized_name,
  s.region,
  'CM',
  s.lat,
  s.lng,
  'city',
  TRUE,
  TRUE
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM geo_cities city
  WHERE city.normalized_name = s.normalized_name
);

-- =========================
-- 2) NEIGHBORHOODS FROM OSM
-- =========================
CREATE TEMP TABLE tmp_osm_neighborhoods ON COMMIT DROP AS
WITH raw_neighborhoods AS (
  SELECT
    p.osm_id,
    COALESCE(NULLIF(BTRIM(p.name), ''), NULLIF(BTRIM(p.tags -> 'name'), '')) AS name,
    LOWER(COALESCE(NULLIF(BTRIM(p.place), ''), NULLIF(BTRIM(p.tags -> 'place'), ''))) AS place_type,
    ST_Y(ST_Transform(p.way, 4326)) AS lat,
    ST_X(ST_Transform(p.way, 4326)) AS lng,
    1 AS source_priority
  FROM planet_osm_point p

  UNION ALL

  SELECT
    p.osm_id,
    COALESCE(NULLIF(BTRIM(p.name), ''), NULLIF(BTRIM(p.tags -> 'name'), '')) AS name,
    LOWER(COALESCE(NULLIF(BTRIM(p.place), ''), NULLIF(BTRIM(p.tags -> 'place'), ''))) AS place_type,
    ST_Y(ST_PointOnSurface(ST_Transform(p.way, 4326))) AS lat,
    ST_X(ST_PointOnSurface(ST_Transform(p.way, 4326))) AS lng,
    2 AS source_priority
  FROM planet_osm_polygon p
),
candidate_neighborhoods AS (
  SELECT
    osm_id,
    name,
    lat,
    lng,
    ROW_NUMBER() OVER (
      PARTITION BY BTRIM(LOWER(REGEXP_REPLACE(UNACCENT(name), '\s+', ' ', 'g'))), ROUND(lat::numeric, 4), ROUND(lng::numeric, 4)
      ORDER BY source_priority ASC
    ) AS rn
  FROM raw_neighborhoods
  WHERE name IS NOT NULL
    AND BTRIM(name) <> ''
    AND UNACCENT(BTRIM(name)) !~ '^[0-9]+$'
    AND place_type IN ('suburb', 'neighbourhood', 'quarter', 'village', 'hamlet')
),
matched AS (
  SELECT
    n.*,
    c.id AS city_id
  FROM candidate_neighborhoods n
  JOIN LATERAL (
    SELECT city.id
    FROM geo_cities city
    WHERE (
      111.045 * DEGREES(
        ACOS(
          LEAST(
            1.0,
            COS(RADIANS(n.lat)) * COS(RADIANS(city.lat))
            * COS(RADIANS(city.lng) - RADIANS(n.lng))
            + SIN(RADIANS(n.lat)) * SIN(RADIANS(city.lat))
          )
        )
      )
    ) <= 35
    ORDER BY
      POWER(city.lat - n.lat, 2) + POWER(city.lng - n.lng, 2) ASC
    LIMIT 1
  ) c ON TRUE
  WHERE n.rn = 1
)
SELECT
  m.name,
  BTRIM(LOWER(REGEXP_REPLACE(UNACCENT(m.name), '\s+', ' ', 'g'))) AS normalized_name,
  LOWER(REGEXP_REPLACE(UNACCENT(m.name), '[^a-zA-Z0-9]+', '-', 'g')) ||
    '-' || SUBSTRING(MD5(m.name || m.city_id::text) FROM 1 FOR 6) AS slug,
  m.city_id,
  m.lat,
  m.lng
FROM matched m;

UPDATE geo_neighborhoods n
SET
  name = src.name,
  normalized_name = src.normalized_name,
  lat = src.lat,
  lng = src.lng,
  is_active = TRUE,
  "updatedAt" = NOW()
FROM tmp_osm_neighborhoods src
WHERE n.city_id = src.city_id
  AND n.slug = src.slug;

INSERT INTO geo_neighborhoods (
  id,
  created_at,
  "updatedAt",
  name,
  slug,
  normalized_name,
  city_id,
  lat,
  lng,
  is_active
)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  src.name,
  src.slug,
  src.normalized_name,
  src.city_id,
  src.lat,
  src.lng,
  TRUE
FROM tmp_osm_neighborhoods src
WHERE NOT EXISTS (
  SELECT 1
  FROM geo_neighborhoods n
  WHERE n.city_id = src.city_id
    AND n.slug = src.slug
);

-- Fallback: neighborhoods from listing payload (address/neighborhood).
WITH listing_neighborhoods AS (
  SELECT
    LOWER(BTRIM(location->>'city')) AS city_normalized_name,
    NULLIF(
      LOWER(
        BTRIM(
          COALESCE(
            location->>'neighborhood',
            SPLIT_PART(COALESCE(location->>'address', location->>'label', ''), ',', 1)
          )
        )
      ),
      ''
    ) AS normalized_name,
    INITCAP(
      LOWER(
        BTRIM(
          COALESCE(
            location->>'neighborhood',
            SPLIT_PART(COALESCE(location->>'address', location->>'label', ''), ',', 1)
          )
        )
      )
    ) AS name,
    AVG(
      COALESCE(
        NULLIF(location->>'lat', ''),
        NULLIF(location->>'latitude', '')
      )::double precision
    ) AS lat,
    AVG(
      COALESCE(
        NULLIF(location->>'lng', ''),
        NULLIF(location->>'lon', ''),
        NULLIF(location->>'longitude', '')
      )::double precision
    ) AS lng
  FROM listings
  WHERE location IS NOT NULL
    AND COALESCE(BTRIM(location->>'city'), '') <> ''
    AND COALESCE(
      BTRIM(location->>'neighborhood'),
      BTRIM(SPLIT_PART(COALESCE(location->>'address', location->>'label', ''), ',', 1)),
      ''
    ) <> ''
    AND COALESCE(location->>'lat', location->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    AND COALESCE(location->>'lng', location->>'lon', location->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
  GROUP BY
    LOWER(BTRIM(location->>'city')),
    LOWER(
      BTRIM(
        COALESCE(
          location->>'neighborhood',
          SPLIT_PART(COALESCE(location->>'address', location->>'label', ''), ',', 1)
        )
      )
    )
),
resolved AS (
  SELECT
    ln.name,
    ln.normalized_name,
    city.id AS city_id,
    ln.lat,
    ln.lng
  FROM listing_neighborhoods ln
  JOIN geo_cities city
    ON city.normalized_name = ln.city_normalized_name
  WHERE ln.normalized_name IS NOT NULL
)
INSERT INTO geo_neighborhoods (
  id,
  created_at,
  "updatedAt",
  name,
  slug,
  normalized_name,
  city_id,
  lat,
  lng,
  is_active
)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  r.name,
  LOWER(REGEXP_REPLACE(UNACCENT(r.name), '[^a-zA-Z0-9]+', '-', 'g')) ||
    '-' || SUBSTRING(MD5(r.normalized_name || r.city_id::text || '-listing') FROM 1 FOR 6),
  r.normalized_name,
  r.city_id,
  r.lat,
  r.lng,
  TRUE
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM geo_neighborhoods n
  WHERE n.city_id = r.city_id
    AND n.normalized_name = r.normalized_name
);

-- Mark popular cities for UI boost logic.
UPDATE geo_cities
SET
  is_popular = TRUE,
  is_active = TRUE,
  "updatedAt" = NOW()
WHERE normalized_name IN (
  'douala',
  'yaounde',
  'bafoussam',
  'bamenda',
  'garoua',
  'maroua'
);

COMMIT;
