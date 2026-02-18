
-- ===========
-- VOITURES 
-- ===========


-- ===========
-- VEHECULES 
-- ===========
INSERT INTO categories (
  id, name, slug, description, icon, color, gradient,
  "isActive", position, "extraFields", "parentId"
)
VALUES (
  '1a1b6a30-43dd-478b-8b79-b8bf169147d1',
  'Véhicules',
  'vehicules',
  'Transport, autos, motos, caravaning et nautisme.',
  '🚗',
  '#0070DD',
  'linear-gradient(135deg, rgba(0,175,255,.25), rgba(0,68,204,.25))',
  true,
  2,
  '[{"label":"VÉHICULES","channel":"_vehicules_","img":"Cars","ad_types":null}]'::jsonb,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  slug=EXCLUDED.slug,
  description=EXCLUDED.description,
  icon=EXCLUDED.icon,
  color=EXCLUDED.color,
  gradient=EXCLUDED.gradient,
  "isActive"=EXCLUDED."isActive",
  position=EXCLUDED.position,
  "extraFields"=EXCLUDED."extraFields",
  "parentId"=EXCLUDED."parentId";


-- ===========
-- VEHICULE FORM STEP AND FORM FIELDS
-- ===========
WITH cat AS (
  SELECT id FROM categories WHERE id = 'c498bd03-32a7-4381-95f2-cdd2ce03373d'
),

-- ===========
-- 1) CREATE STEPS (sell flow)
--    ✅ flow est une colonne de form_steps
--    ✅ info ne contient plus "flow"
-- ===========
steps_def AS (
  SELECT * FROM (VALUES
    ('ad_params',    'Dites-nous en plus',      1, 'sell', '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('description',  'Décrivez votre bien !',   2, 'sell', '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('price',        'Quel est votre prix ?',   3, 'sell', '{"info":["Le prix est important. Soyez juste, et gardez une marge de négociation si besoin"]}'::jsonb),
    ('coordinates',  'Où se situe votre bien ?',4, 'sell', '{"info":["Complétez votre adresse pour améliorer la recherche autour de soi. Si vous ne souhaitez pas donner le numéro, indiquez la rue."]}'::jsonb),
    ('contact',      'Vos coordonnées',         5, 'sell', '{"info":["Pour plus de sécurité, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(name, label, ord, flow, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1 FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id, name
),

all_steps AS (
  SELECT fs.id AS step_id, fs.name AS step_name
  FROM form_steps fs
  WHERE fs."categoryId" = (SELECT id FROM cat)
    AND fs.flow = 'sell'
    AND fs.name IN ('ad_params','description','price','coordinates','contact')
),

-- ===========
-- 2) FIELDS DEFINITION (sell)
--    ✅ form_fields.type = UI type (select/text/textarea/boolean)
-- ===========
fields_def AS (
  SELECT * FROM (VALUES
    -- ---- ad_params
    ('ad_params','argus_car_brand','Marque','select',NULL,
      NULL::jsonb,
      '{"grouped_values":[{"label":"Marques courantes","values":[{"value":"AUDI","label":"AUDI"},{"value":"BMW","label":"BMW"},{"value":"CITROEN","label":"CITROEN"},{"value":"FIAT","label":"FIAT"},{"value":"FORD","label":"FORD"},{"value":"MERCEDES-BENZ","label":"MERCEDES-BENZ"},{"value":"OPEL","label":"OPEL"},{"value":"PEUGEOT","label":"PEUGEOT"},{"value":"RENAULT","label":"RENAULT"},{"value":"VOLKSWAGEN","label":"VOLKSWAGEN"}]},{"label":"Autres marques","values":[{"value":"ABARTH","label":"ABARTH"},{"value":"AC","label":"AC"},{"value":"AIWAYS","label":"AIWAYS"},{"value":"AIXAM","label":"AIXAM"},{"value":"ALFA ROMEO","label":"ALFA ROMEO"},{"value":"ALPINE","label":"ALPINE"},{"value":"ASTON MARTIN","label":"ASTON MARTIN"},{"value":"AUDI","label":"AUDI"},{"value":"BMW","label":"BMW"},{"value":"TESLA","label":"TESLA"},{"value":"TOYOTA","label":"TOYOTA"},{"value":"VOLVO","label":"VOLVO"},{"value":"AUTRES","label":"Autre"}]}]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir une marque"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','argus_car_model','Modèle','select',NULL,
      NULL::jsonb,
      '{"depends_on":"argus_car_brand","conditional_values":{"ABARTH":[{"value":"ABARTH_124 Spider","label":"124 Spider"},{"value":"ABARTH_500","label":"500"},{"value":"ABARTH_autres","label":"Autre"}],"AC":[{"value":"AC_Cobra","label":"Cobra"},{"value":"AC_autres","label":"Autre"}]}}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir un modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','regdate','Année modèle','select',NULL,
      NULL::jsonb,
      '{"values":[{"value":"2023","label":"2023"},{"value":"2022","label":"2022"},{"value":"2021","label":"2021"},{"value":"2020","label":"2020"},{"value":"2019","label":"2019"},{"value":"2018","label":"2018"},{"value":"2017","label":"2017"},{"value":"2016","label":"2016"},{"value":"2015","label":"2015"},{"value":"2014","label":"2014"},{"value":"2013","label":"2013"},{"value":"2012","label":"2012"},{"value":"2011","label":"2011"},{"value":"2010","label":"2010"},{"value":"2009","label":"2009"},{"value":"2008","label":"2008"},{"value":"2007","label":"2007"},{"value":"2006","label":"2006"},{"value":"2005","label":"2005"},{"value":"2004","label":"2004"},{"value":"2003","label":"2003"},{"value":"2002","label":"2002"},{"value":"2001","label":"2001"},{"value":"2000","label":"2000"},{"value":"1999","label":"1999"},{"value":"1998","label":"1998"},{"value":"1997","label":"1997"},{"value":"1996","label":"1996"},{"value":"1995","label":"1995"},{"value":"1994","label":"1994"},{"value":"1993","label":"1993"},{"value":"1992","label":"1992"},{"value":"1991","label":"1991"},{"value":"1990","label":"1990"},{"value":"1989","label":"1989"},{"value":"1988","label":"1988"},{"value":"1987","label":"1987"},{"value":"1986","label":"1986"},{"value":"1985","label":"1985"},{"value":"1984","label":"1984"},{"value":"1983","label":"1983"},{"value":"1982","label":"1982"},{"value":"1981","label":"1981"},{"value":"1980","label":"1980"},{"value":"1979","label":"1979"},{"value":"1978","label":"1978"},{"value":"1977","label":"1977"},{"value":"1976","label":"1976"},{"value":"1975","label":"1975"},{"value":"1974","label":"1974"},{"value":"1973","label":"1973"},{"value":"1972","label":"1972"},{"value":"1971","label":"1971"},{"value":"1970","label":"1970"},{"value":"1969","label":"1969"},{"value":"1968","label":"1968"},{"value":"1967","label":"1967"},{"value":"1966","label":"1966"},{"value":"1965","label":"1965"},{"value":"1964","label":"1964"},{"value":"1963","label":"1963"},{"value":"1962","label":"1962"},{"value":"1961","label":"1961"},{"value":"1960","label":"1960 ou avant"}]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir l''année modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','issuance_date','Date de première mise en circulation','text',NULL,
      '{"info":["Mention obligatoire dans le cadre de la vente de véhicule d’occasion"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":7,"regexp":"^(0[1-9]|1[0-2])/[0-9]{4}$","err_regexp":"Merci d''indiquer une date valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','fuel','Carburant','select',NULL,
      NULL::jsonb,
      '{"values":[{"value":"1","label":"Essence"},{"value":"2","label":"Diesel"},{"value":"6","label":"Hybride"},{"value":"4","label":"Electrique"},{"value":"3","label":"GPL"},{"value":"5","label":"Autre"}]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir le carburant"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','gearbox','Boîte de vitesse','select',NULL,
      NULL::jsonb,
      '{"values":[{"value":"1","label":"Manuelle"},{"value":"2","label":"Automatique"}]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Merci de choisir un type de boite de vitesse"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('ad_params','mileage','Kilométrage','text','km',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":6,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez préciser le kilométrage","err_regexp":"La vente de véhicule neuf est interdite. Merci de préciser le kilométrage réel du véhicule"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- ---- description
    ('description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Veuillez préciser le mois et l’année de 1ère mise en circulation, la marque, le modèle et le type du véhicule.","Indiquez si vous proposez un droit de rétractation."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent, les chiffres, - _ . / (sans espaces)"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- ---- price
    ('price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":8,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez indiquer le prix correspondant à votre annonce","err_regexp":"Veuillez saisir un prix valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('price','vehicle_price_reco','vehicle_price_reco','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- ---- contact
    ('contact','email','Email','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('contact','phone','Téléphone','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres (ou +..)"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    )
  ) AS t(step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  s.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM all_steps s
JOIN fields_def f ON f.step_name = s.step_name
WHERE NOT EXISTS (
  SELECT 1 FROM form_fields ff
  WHERE ff."stepId" = s.step_id AND ff.name = f.name
);

-- ===========
-- MOTOS categoryId = 1ab09d75-b4e2-4618-94eb-2d9dc9deca36
-- form_steps.flow = sell / buy
-- form_fields.type = UI type (select/text/textarea/boolean)
-- ===========

WITH cat AS (
  SELECT id FROM categories WHERE id = '1ab09d75-b4e2-4618-94eb-2d9dc9deca36'
),

-- ===========
-- 1) CREATE STEPS (sell + buy)
-- ===========
steps_def AS (
  SELECT * FROM (VALUES
    -- ---- SELL
    ('sell','ad_params',    'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description',  'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',        'Quel est votre prix ?',    3, '{"info":["Vous le savez, le prix est important. Soyez juste, et gardez une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates',  'Où se situe votre bien ?', 4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',      'Vos coordonnées',          5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- ---- BUY
    ('buy','ad_params',     'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('buy','description',   'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',   'Où se situe votre bien ?', 3, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',       'Vos coordonnées',          4, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id, name, flow
),

all_steps AS (
  SELECT fs.id AS step_id, fs.name AS step_name, fs.flow AS step_flow
  FROM form_steps fs
  WHERE fs."categoryId" = (SELECT id FROM cat)
    AND (
      (fs.flow='sell' AND fs.name IN ('ad_params','description','price','coordinates','contact'))
      OR
      (fs.flow='buy'  AND fs.name IN ('ad_params','description','coordinates','contact'))
    )
),

-- ===========
-- 2) FIELDS DEFINITIONS (sell + buy)
-- ===========
fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','argus_moto_brand','Marque','select',NULL,
      NULL::jsonb,
      '{
        "grouped_values":[
          {
            "label":"Marques courantes",
            "values":[
              {"value":"BMW","label":"BMW"},
              {"value":"HONDA","label":"HONDA"},
              {"value":"KAWASAKI","label":"KAWASAKI"},
              {"value":"SUZUKI","label":"SUZUKI"},
              {"value":"YAMAHA","label":"YAMAHA"},
              {"value":"DUCATI","label":"DUCATI"},
              {"value":"HARLEY-DAVIDSON","label":"HARLEY-DAVIDSON"},
              {"value":"KTM","label":"KTM"},
              {"value":"TRIUMPH","label":"TRIUMPH"},
              {"value":"PIAGGIO","label":"PIAGGIO"},
              {"value":"APRILIA","label":"APRILIA"}
            ]
          },
          {
            "label":"Autres marques",
            "values":[
              {"value":"2TWENTY","label":"2TWENTY"},
              {"value":"ACCESS MOTOR","label":"ACCESS MOTOR"},
              {"value":"ACMA","label":"ACMA"},
              {"value":"ADIVA","label":"ADIVA"},
              {"value":"ADLY","label":"ADLY"},
              {"value":"AEON","label":"AEON"},
              {"value":"AJP","label":"AJP"},
              {"value":"ALPINA","label":"ALPINA"},
              {"value":"AMERICAN IRONHORSE","label":"AMERICAN IRONHORSE"},
              {"value":"ARCTIC CAT","label":"ARCTIC CAT"},
              {"value":"ASKOLL","label":"ASKOLL"},
              {"value":"AURORA","label":"AURORA"},
              {"value":"AVINTON","label":"AVINTON"},
              {"value":"BENELLI","label":"BENELLI"},
              {"value":"BETA","label":"BETA"},
              {"value":"BIMOTA","label":"BIMOTA"},
              {"value":"BORN FREE","label":"BORN FREE"},
              {"value":"BOSS HOSS","label":"BOSS HOSS"},
              {"value":"BRIXTON","label":"BRIXTON"},
              {"value":"BUELL","label":"BUELL"},
              {"value":"CAGIVA","label":"CAGIVA"},
              {"value":"CAN-AM","label":"CAN-AM"},
              {"value":"CFMOTO","label":"CFMOTO"},
              {"value":"CHANGJIANG","label":"CHANGJIANG"},
              {"value":"DAELIM","label":"DAELIM"},
              {"value":"DERBI","label":"DERBI"},
              {"value":"ELECTRIC MOTION","label":"ELECTRIC MOTION"},
              {"value":"FANTIC","label":"FANTIC"},
              {"value":"FB MONDIAL","label":"FB MONDIAL"},
              {"value":"GASGAS","label":"GASGAS"},
              {"value":"GILERA","label":"GILERA"},
              {"value":"GIMBAL","label":"GIMBAL"},
              {"value":"GOVECS","label":"GOVECS"},
              {"value":"HUSABERG","label":"HUSABERG"},
              {"value":"HUSQVARNA","label":"HUSQVARNA"},
              {"value":"HYOSUNG","label":"HYOSUNG"},
              {"value":"INDIAN","label":"INDIAN"},
              {"value":"ITALJET","label":"ITALJET"},
              {"value":"JAWA","label":"JAWA"},
              {"value":"KYMCO","label":"KYMCO"},
              {"value":"LAMBRETTA","label":"LAMBRETTA"},
              {"value":"LAVERDA","label":"LAVERDA"},
              {"value":"LEXMOTO","label":"LEXMOTO"},
              {"value":"LINHAI","label":"LINHAI"},
              {"value":"MALAGUTI","label":"MALAGUTI"},
              {"value":"MASH","label":"MASH"},
              {"value":"MBK","label":"MBK"},
              {"value":"MOTO GUZZI","label":"MOTO GUZZI"},
              {"value":"MV AGUSTA","label":"MV AGUSTA"},
              {"value":"NIU","label":"NIU"},
              {"value":"NORTON","label":"NORTON"},
              {"value":"PEUGEOT","label":"PEUGEOT"},
              {"value":"POLARIS","label":"POLARIS"},
              {"value":"RIEJU","label":"RIEJU"},
              {"value":"ROYAL ENFIELD","label":"ROYAL ENFIELD"},
              {"value":"RVM","label":"RVM"},
              {"value":"SACHS","label":"SACHS"},
              {"value":"SHERCO","label":"SHERCO"},
              {"value":"SYM","label":"SYM"},
              {"value":"TGB","label":"TGB"},
              {"value":"TM RACING","label":"TM RACING"},
              {"value":"VESPA","label":"VESPA"},
              {"value":"VICTORY","label":"VICTORY"},
              {"value":"VOGE","label":"VOGE"},
              {"value":"YCF","label":"YCF"},
              {"value":"ZERO","label":"ZERO"},
              {"value":"ZONTES","label":"ZONTES"},
              {"value":"AUTRES","label":"Autre"}
            ]
          }
        ]
      }'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir une marque"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','regdate','Année modèle','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"2023","label":"2023"},{"value":"2022","label":"2022"},{"value":"2021","label":"2021"},{"value":"2020","label":"2020"},
        {"value":"2019","label":"2019"},{"value":"2018","label":"2018"},{"value":"2017","label":"2017"},{"value":"2016","label":"2016"},
        {"value":"2015","label":"2015"},{"value":"2014","label":"2014"},{"value":"2013","label":"2013"},{"value":"2012","label":"2012"},
        {"value":"2011","label":"2011"},{"value":"2010","label":"2010"},{"value":"2009","label":"2009"},{"value":"2008","label":"2008"},
        {"value":"2007","label":"2007"},{"value":"2006","label":"2006"},{"value":"2005","label":"2005"},{"value":"2004","label":"2004"},
        {"value":"2003","label":"2003"},{"value":"2002","label":"2002"},{"value":"2001","label":"2001"},{"value":"2000","label":"2000"},
        {"value":"1999","label":"1999"},{"value":"1998","label":"1998"},{"value":"1997","label":"1997"},{"value":"1996","label":"1996"},
        {"value":"1995","label":"1995"},{"value":"1994","label":"1994"},{"value":"1993","label":"1993"},{"value":"1992","label":"1992"},
        {"value":"1991","label":"1991"},{"value":"1990","label":"1990"},{"value":"1989","label":"1989"},{"value":"1988","label":"1988"},
        {"value":"1987","label":"1987"},{"value":"1986","label":"1986"},{"value":"1985","label":"1985"},{"value":"1984","label":"1984"},
        {"value":"1983","label":"1983"},{"value":"1982","label":"1982"},{"value":"1981","label":"1981"},{"value":"1980","label":"1980"},
        {"value":"1979","label":"1979"},{"value":"1978","label":"1978"},{"value":"1977","label":"1977"},{"value":"1976","label":"1976"},
        {"value":"1975","label":"1975"},{"value":"1974","label":"1974"},{"value":"1973","label":"1973"},{"value":"1972","label":"1972"},
        {"value":"1971","label":"1971"},{"value":"1970","label":"1970"},{"value":"1969","label":"1969"},{"value":"1968","label":"1968"},
        {"value":"1967","label":"1967"},{"value":"1966","label":"1966"},{"value":"1965","label":"1965"},{"value":"1964","label":"1964"},
        {"value":"1963","label":"1963"},{"value":"1962","label":"1962"},{"value":"1961","label":"1961"},{"value":"1960","label":"1960 ou avant"}
      ]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir l''année modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','issuance_date','Date de première mise en circulation','text',NULL,
      '{"info":["Mention obligatoire dans le cadre de la vente de véhicule d’occasion"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":7,"regexp":"^(0[1-9]|1[0-2])/[0-9]{4}$","err_regexp":"Merci d''indiquer une date valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','argus_moto_finition','Finition','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','argus_moto_version','Version','text',NULL,
      '{"depends_on":"argus_moto_finition"}'::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','mileage','Kilométrage','text','km',
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":6,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez préciser le kilométrage","err_regexp":"La vente de véhicule neuf est interdite. Merci de préciser le kilométrage réel du véhicule"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','cubic_capacity','Cylindrée','text','cm³',
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false,"max_length":4,"regexp":"^[1-9]\\\\d*$","err_regexp":"Merci de préciser une valeur de cylindrée correcte"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','vehicule_color','Couleur','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"argent","label":"Argent"},{"value":"beige","label":"Beige"},{"value":"blanc","label":"Blanc"},{"value":"bleu","label":"Bleu"},
        {"value":"bordeaux","label":"Bordeaux"},{"value":"gris","label":"Gris"},{"value":"ivoire","label":"Ivoire"},{"value":"jaune","label":"Jaune"},
        {"value":"marron","label":"Marron"},{"value":"noir","label":"Noir"},{"value":"orange","label":"Orange"},{"value":"rose","label":"Rose"},
        {"value":"rouge","label":"Rouge"},{"value":"vert","label":"Vert"},{"value":"violet","label":"Violet"},{"value":"autre","label":"Autre"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','cycle_type','Type','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"moto","label":"Moto"},
        {"value":"scooter","label":"Scooter"},
        {"value":"quad","label":"Quad"},
        {"value":"autre","label":"Autre"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','cycle_licence','Type de permis','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"permisa","label":"Permis A"},
        {"value":"permisal","label":"Permis AL"},
        {"value":"sanspermis","label":"Sans permis"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{"info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]}'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','critair','Crit''Air','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"0","label":"0"},{"value":"1","label":"1"},{"value":"2","label":"2"},
        {"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"6","label":"Non classé"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Pensez à préciser la marque et le modèle de votre moto.","Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":8,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez indiquer le prix correspondant à votre annonce","err_regexp":"Veuillez saisir un prix valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    ),

    -- =========================================================
    -- BUY / ad_params
    -- =========================================================
    ('buy','ad_params','cubic_capacity','Cylindrée','text','cm³',
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false,"max_length":4,"regexp":"^[1-9]\\\\d*$","err_regexp":"Merci de préciser une valeur de cylindrée correcte"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Pensez à préciser la marque et le modèle de votre moto.","Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

-- ===========
-- 3) INSERT FIELDS
-- ===========
INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  s.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM all_steps s
JOIN fields_def f
  ON f.step_name = s.step_name
 AND f.flow      = s.step_flow
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = s.step_id
    AND ff.name = f.name
);

-- ===========
-- CARAVANING categoryId = 68af1171-265d-4c85-9c0c-b454d9ffa7b9
-- form_steps.flow = sell / buy
-- ===========

WITH cat AS (
  SELECT id FROM categories WHERE id = '68af1171-265d-4c85-9c0c-b454d9ffa7b9'
),

-- ===========
-- 1) CREATE STEPS (sell + buy)
-- ===========
steps_def AS (
  SELECT * FROM (VALUES
    -- ---- SELL
    ('sell','ad_params',    'Dites-nous en plus',        1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description',  'Décrivez votre bien !',     2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',        'Quel est votre prix ?',     3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates',  'Où se situe votre bien ?',  4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',      'Vos coordonnées',           5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- ---- BUY
    ('buy','description',   'Décrivez votre bien !',     1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',   'Où se situe votre bien ?',  2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',       'Vos coordonnées',           3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id, name, flow
),

all_steps AS (
  SELECT fs.id AS step_id, fs.name AS step_name, fs.flow AS step_flow
  FROM form_steps fs
  WHERE fs."categoryId" = (SELECT id FROM cat)
    AND (
      (fs.flow='sell' AND fs.name IN ('ad_params','description','price','coordinates','contact'))
      OR
      (fs.flow='buy'  AND fs.name IN ('description','coordinates','contact'))
    )
),

-- ===========
-- 2) FIELDS DEFINITIONS
-- ===========
fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','regdate','Année modèle','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"2023","label":"2023"},{"value":"2022","label":"2022"},{"value":"2021","label":"2021"},{"value":"2020","label":"2020"},
        {"value":"2019","label":"2019"},{"value":"2018","label":"2018"},{"value":"2017","label":"2017"},{"value":"2016","label":"2016"},
        {"value":"2015","label":"2015"},{"value":"2014","label":"2014"},{"value":"2013","label":"2013"},{"value":"2012","label":"2012"},
        {"value":"2011","label":"2011"},{"value":"2010","label":"2010"},{"value":"2009","label":"2009"},{"value":"2008","label":"2008"},
        {"value":"2007","label":"2007"},{"value":"2006","label":"2006"},{"value":"2005","label":"2005"},{"value":"2004","label":"2004"},
        {"value":"2003","label":"2003"},{"value":"2002","label":"2002"},{"value":"2001","label":"2001"},{"value":"2000","label":"2000"},
        {"value":"1999","label":"1999"},{"value":"1998","label":"1998"},{"value":"1997","label":"1997"},{"value":"1996","label":"1996"},
        {"value":"1995","label":"1995"},{"value":"1994","label":"1994"},{"value":"1993","label":"1993"},{"value":"1992","label":"1992"},
        {"value":"1991","label":"1991"},{"value":"1990","label":"1990"},{"value":"1989","label":"1989"},{"value":"1988","label":"1988"},
        {"value":"1987","label":"1987"},{"value":"1986","label":"1986"},{"value":"1985","label":"1985"},{"value":"1984","label":"1984"},
        {"value":"1983","label":"1983"},{"value":"1982","label":"1982"},{"value":"1981","label":"1981"},{"value":"1980","label":"1980"},
        {"value":"1979","label":"1979"},{"value":"1978","label":"1978"},{"value":"1977","label":"1977"},{"value":"1976","label":"1976"},
        {"value":"1975","label":"1975"},{"value":"1974","label":"1974"},{"value":"1973","label":"1973"},{"value":"1972","label":"1972"},
        {"value":"1971","label":"1971"},{"value":"1970","label":"1970"},{"value":"1969","label":"1969"},{"value":"1968","label":"1968"},
        {"value":"1967","label":"1967"},{"value":"1966","label":"1966"},{"value":"1965","label":"1965"},{"value":"1964","label":"1964"},
        {"value":"1963","label":"1963"},{"value":"1962","label":"1962"},{"value":"1961","label":"1961"},{"value":"1960","label":"1960 ou avant"}
      ]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir l''année modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','mileage','Kilométrage','text','km',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":6,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez préciser le kilométrage","err_regexp":"La vente de véhicule neuf est interdite. Merci de préciser le kilométrage réel du véhicule"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','issuance_date','Date de première mise en circulation','text',NULL,
      '{"info":["Mention obligatoire dans le cadre de la vente de véhicule d’occasion"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":7,"regexp":"^(0[1-9]|1[0-2])/[0-9]{4}$","err_regexp":"Merci d''indiquer une date valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":8,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez indiquer le prix correspondant à votre annonce","err_regexp":"Veuillez saisir un prix valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

-- ===========
-- 3) INSERT FIELDS
-- ===========
INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  s.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM all_steps s
JOIN fields_def f
  ON f.step_name = s.step_name
 AND f.flow      = s.step_flow
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = s.step_id
    AND ff.name = f.name
);


-- ===========
-- ÉQUIPEMENT AUTO categoryId = f6745f18-b7c0-473a-ba28-c429de6ec300
-- form_steps.flow = sell / buy
-- ===========

WITH cat AS (
  SELECT id FROM categories WHERE id = 'f6745f18-b7c0-473a-ba28-c429de6ec300'
),

-- ===========
-- 1) CREATE STEPS (sell + buy)
-- ===========
steps_def AS (
  SELECT * FROM (VALUES
    -- ---- SELL
    ('sell','ad_params',    'Dites-nous en plus',        1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description',  'Décrivez votre bien !',     2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',        'Quel est votre prix ?',     3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates',  'Où se situe votre bien ?',  4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',      'Vos coordonnées',           5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- ---- BUY
    ('buy','description',   'Décrivez votre bien !',     1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',   'Où se situe votre bien ?',  2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',       'Vos coordonnées',           3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id, name, flow
),

all_steps AS (
  SELECT fs.id AS step_id, fs.name AS step_name, fs.flow AS step_flow
  FROM form_steps fs
  WHERE fs."categoryId" = (SELECT id FROM cat)
    AND (
      (fs.flow='sell' AND fs.name IN ('ad_params','description','price','coordinates','contact'))
      OR
      (fs.flow='buy'  AND fs.name IN ('description','coordinates','contact'))
    )
),

-- ===========
-- 2) FIELDS DEFINITIONS
-- ===========
fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":9,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez spécifier le prix de l''annonce","err_regexp":"Le prix doit être un entier positif"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','price','new_item_price','Prix neuf','text','€',
      '{"info":["Maximisez vos chances de vendre en montrant à vos acheteurs potentiels le prix neuf de l’article"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":10,"regexp":"^([1-9]\\\\d*|0)$","err_regexp":"Merci d''indiquer un prix neuf valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

-- ===========
-- 3) INSERT FIELDS
-- ===========
INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  s.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM all_steps s
JOIN fields_def f
  ON f.step_name = s.step_name
 AND f.flow      = s.step_flow
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = s.step_id
    AND ff.name = f.name
);

-- ===========
-- ÉQUIPEMENT MOTO categoryId = 46ea945d-d5c8-4f06-be59-af169d47dc65
-- form_steps.flow = sell / buy
-- ===========

WITH cat AS (
  SELECT id FROM categories WHERE id = '46ea945d-d5c8-4f06-be59-af169d47dc65'
),

-- ===========
-- 1) CREATE STEPS (sell + buy)
-- ===========
steps_def AS (
  SELECT * FROM (VALUES
    -- ---- SELL
    ('sell','ad_params',    'Dites-nous en plus',        1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description',  'Décrivez votre bien !',     2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',        'Quel est votre prix ?',     3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates',  'Où se situe votre bien ?',  4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',      'Vos coordonnées',           5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- ---- BUY
    ('buy','description',   'Décrivez votre bien !',     1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',   'Où se situe votre bien ?',  2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',       'Vos coordonnées',           3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id, name, flow
),

all_steps AS (
  SELECT fs.id AS step_id, fs.name AS step_name, fs.flow AS step_flow
  FROM form_steps fs
  WHERE fs."categoryId" = (SELECT id FROM cat)
    AND (
      (fs.flow='sell' AND fs.name IN ('ad_params','description','price','coordinates','contact'))
      OR
      (fs.flow='buy'  AND fs.name IN ('description','coordinates','contact'))
    )
),

-- ===========
-- 2) FIELDS DEFINITIONS
-- ===========
fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":9,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez spécifier le prix de l''annonce","err_regexp":"Le prix doit être un entier positif"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','price','new_item_price','Prix neuf','text','€',
      '{"info":["Maximisez vos chances de vendre en montrant à vos acheteurs potentiels le prix neuf de l’article"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":10,"regexp":"^([1-9]\\\\d*|0)$","err_regexp":"Merci d''indiquer un prix neuf valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb, NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, true, false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

-- ===========
-- 3) INSERT FIELDS
-- ===========
INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  s.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM all_steps s
JOIN fields_def f
  ON f.step_name = s.step_name
 AND f.flow      = s.step_flow
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = s.step_id
    AND ff.name = f.name
);

-- ==========================
-- UTILITAIRES categoryId = b266ef13-8e59-4261-9a2d-fe171a5ae5b7
-- ==========================
WITH cat AS (
  SELECT id FROM categories WHERE id = 'b266ef13-8e59-4261-9a2d-fe171a5ae5b7'
),

steps_def AS (
  SELECT * FROM (VALUES
    -- SELL
    ('sell','ad_params',   'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description', 'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',       'Quel est votre prix ?',    3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates', 'Où se situe votre bien ?', 4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',     'Vos coordonnées',          5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- BUY
    ('buy','description',  'Décrivez votre bien !',    1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',  'Où se situe votre bien ?', 2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',      'Vos coordonnées',          3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id
),

steps_map AS (
  SELECT fs.id AS step_id, sd.flow, sd.name AS step_name
  FROM steps_def sd
  JOIN form_steps fs
    ON fs."categoryId" = (SELECT id FROM cat)
   AND fs.flow = sd.flow
   AND fs.name = sd.name
),

fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================

    -- Marque (grouped_values)
    ('sell','ad_params','argus_utility_brand','Marque','select',NULL,
      NULL::jsonb,
      '{
        "grouped_values":[
          {
            "label":"Marques courantes",
            "values":[
              {"value":"CITROEN","label":"CITROEN"},
              {"value":"FIAT","label":"FIAT"},
              {"value":"MERCEDES-BENZ","label":"MERCEDES-BENZ"},
              {"value":"PEUGEOT","label":"PEUGEOT"},
              {"value":"RENAULT","label":"RENAULT"}
            ]
          },
          {
            "label":"Autres marques",
            "values":[
              {"value":"AIXAM","label":"AIXAM"},
              {"value":"ARO","label":"ARO"},
              {"value":"AUDI","label":"AUDI"},
              {"value":"AUSTIN","label":"AUSTIN"},
              {"value":"AUVERLAND","label":"AUVERLAND"},
              {"value":"AVIA","label":"AVIA"},
              {"value":"BELLIER","label":"BELLIER"},
              {"value":"BLUECAR","label":"BLUECAR"},
              {"value":"DACIA","label":"DACIA"},
              {"value":"DAF","label":"DAF"},
              {"value":"DAIHATSU","label":"DAIHATSU"},
              {"value":"DALLAS","label":"DALLAS"},
              {"value":"DANGEL","label":"DANGEL"},
              {"value":"DFSK","label":"DFSK"},
              {"value":"FORD","label":"FORD"},
              {"value":"FSO","label":"FSO"},
              {"value":"FUSO","label":"FUSO"},
              {"value":"GME","label":"GME"},
              {"value":"HONDA","label":"HONDA"},
              {"value":"HYUNDAI","label":"HYUNDAI"},
              {"value":"INEOS","label":"INEOS"},
              {"value":"ISUZU","label":"ISUZU"},
              {"value":"IVECO","label":"IVECO"},
              {"value":"JDM SIMPA","label":"JDM SIMPA"},
              {"value":"JEEP","label":"JEEP"},
              {"value":"KIA","label":"KIA"},
              {"value":"LADA","label":"LADA"},
              {"value":"LAND-ROVER","label":"LAND-ROVER"},
              {"value":"LDV","label":"LDV"},
              {"value":"LEVC","label":"LEVC"},
              {"value":"LEYLAND","label":"LEYLAND"},
              {"value":"MAHINDRA","label":"MAHINDRA"},
              {"value":"MAN","label":"MAN"},
              {"value":"MAXUS","label":"MAXUS"},
              {"value":"MAZDA","label":"MAZDA"},
              {"value":"MEGA","label":"MEGA"},
              {"value":"MINI","label":"MINI"},
              {"value":"MITSUBISHI","label":"MITSUBISHI"},
              {"value":"NISSAN","label":"NISSAN"},
              {"value":"OPEL","label":"OPEL"},
              {"value":"PIAGGIO","label":"PIAGGIO"},
              {"value":"RENAULT TRUCKS","label":"RENAULT TRUCKS"},
              {"value":"ROVER","label":"ROVER"},
              {"value":"SANTANA","label":"SANTANA"},
              {"value":"SEAT","label":"SEAT"},
              {"value":"SKODA","label":"SKODA"},
              {"value":"SMART","label":"SMART"},
              {"value":"SSANGYONG","label":"SSANGYONG"},
              {"value":"SUZUKI","label":"SUZUKI"},
              {"value":"TALBOT","label":"TALBOT"},
              {"value":"TATA","label":"TATA"},
              {"value":"TOYOTA","label":"TOYOTA"},
              {"value":"UMM","label":"UMM"},
              {"value":"VOLKSWAGEN","label":"VOLKSWAGEN"},
              {"value":"VOLVO","label":"VOLVO"},
              {"value":"AUTRES","label":"Autre"}
            ]
          }
        ]
      }'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir une marque"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- Modèle (depends_on + conditional_values)
    -- IMPORTANT: je mets un EXEMPLE (AIXAM, ARO, AUDI, AUTRES) -> colle ensuite ton JSON complet ici.
    ('sell','ad_params','argus_utility_model','Modèle','select',NULL,
      NULL::jsonb,
      '{
        "depends_on":"argus_utility_brand",
        "conditional_values":{
          "AIXAM":[
            {"value":"AIXAM_D-Truck 400","label":"D-Truck 400"},
            {"value":"AIXAM_autres","label":"Autre"}
          ],
          "ARO":[
            {"value":"ARO_10-1","label":"10-1"},
            {"value":"ARO_10-4","label":"10-4"},
            {"value":"ARO_PICK-UP","label":"PICK-UP"},
            {"value":"ARO_autres","label":"Autre"}
          ],
          "AUDI":[
            {"value":"AUDI_A4 Allroad N1","label":"A4 Allroad N1"},
            {"value":"AUDI_A4 Avant N1","label":"A4 Avant N1"},
            {"value":"AUDI_A6 Avant N1","label":"A6 Avant N1"},
            {"value":"AUDI_Q7 N1","label":"Q7 N1"},
            {"value":"AUDI_autres","label":"Autre"}
          ],
          "AUTRES":[
            {"value":"AUTRES_autres","label":"Autre"}
          ]
        }
      }'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir un modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- Année modèle
    ('sell','ad_params','regdate','Année modèle','select',NULL,
      NULL::jsonb,
      '{
        "values":[
          {"value":"2023","label":"2023"},{"value":"2022","label":"2022"},{"value":"2021","label":"2021"},{"value":"2020","label":"2020"},{"value":"2019","label":"2019"},
          {"value":"2018","label":"2018"},{"value":"2017","label":"2017"},{"value":"2016","label":"2016"},{"value":"2015","label":"2015"},{"value":"2014","label":"2014"},
          {"value":"2013","label":"2013"},{"value":"2012","label":"2012"},{"value":"2011","label":"2011"},{"value":"2010","label":"2010"},{"value":"2009","label":"2009"},
          {"value":"2008","label":"2008"},{"value":"2007","label":"2007"},{"value":"2006","label":"2006"},{"value":"2005","label":"2005"},{"value":"2004","label":"2004"},
          {"value":"2003","label":"2003"},{"value":"2002","label":"2002"},{"value":"2001","label":"2001"},{"value":"2000","label":"2000"},{"value":"1999","label":"1999"},
          {"value":"1998","label":"1998"},{"value":"1997","label":"1997"},{"value":"1996","label":"1996"},{"value":"1995","label":"1995"},{"value":"1994","label":"1994"},
          {"value":"1993","label":"1993"},{"value":"1992","label":"1992"},{"value":"1991","label":"1991"},{"value":"1990","label":"1990"},{"value":"1989","label":"1989"},
          {"value":"1988","label":"1988"},{"value":"1987","label":"1987"},{"value":"1986","label":"1986"},{"value":"1985","label":"1985"},{"value":"1984","label":"1984"},
          {"value":"1983","label":"1983"},{"value":"1982","label":"1982"},{"value":"1981","label":"1981"},{"value":"1980","label":"1980"},{"value":"1979","label":"1979"},
          {"value":"1978","label":"1978"},{"value":"1977","label":"1977"},{"value":"1976","label":"1976"},{"value":"1975","label":"1975"},{"value":"1974","label":"1974"},
          {"value":"1973","label":"1973"},{"value":"1972","label":"1972"},{"value":"1971","label":"1971"},{"value":"1970","label":"1970"},{"value":"1969","label":"1969"},
          {"value":"1968","label":"1968"},{"value":"1967","label":"1967"},{"value":"1966","label":"1966"},{"value":"1965","label":"1965"},{"value":"1964","label":"1964"},
          {"value":"1963","label":"1963"},{"value":"1962","label":"1962"},{"value":"1961","label":"1961"},{"value":"1960","label":"1960 ou avant"}
        ]
      }'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir l''année modèle"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- Date première mise en circulation
    ('sell','ad_params','issuance_date','Date de première mise en circulation','text',NULL,
      '{"info":["Mention obligatoire dans le cadre de la vente de véhicule d’occasion"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":7,"regexp":"^(0[1-9]|1[0-2])/[0-9]{4}$","err_regexp":"Merci d''indiquer une date valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- Finition
    ('sell','ad_params','argus_utility_finition','Finition','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Version (depends_on finition)
    ('sell','ad_params','argus_utility_version','Version','text',NULL,
      NULL::jsonb,
      '{"depends_on":"argus_utility_finition"}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Carburant
    ('sell','ad_params','fuel','Carburant','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"1","label":"Essence"},
        {"value":"2","label":"Diesel"},
        {"value":"6","label":"Hybride"},
        {"value":"4","label":"Electrique"},
        {"value":"3","label":"GPL"},
        {"value":"5","label":"Autre"}
      ]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir le carburant"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Boîte de vitesse
    ('sell','ad_params','gearbox','Boîte de vitesse','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"1","label":"Manuelle"},
        {"value":"2","label":"Automatique"}
      ]}'::jsonb,
      '{"mandatory":true,"err_mandatory":"Veuillez choisir un type de boite de vitesse"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Couleur
    ('sell','ad_params','vehicule_color','Couleur','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"argent","label":"Argent"},{"value":"beige","label":"Beige"},{"value":"blanc","label":"Blanc"},{"value":"bleu","label":"Bleu"},
        {"value":"bordeaux","label":"Bordeaux"},{"value":"gris","label":"Gris"},{"value":"ivoire","label":"Ivoire"},{"value":"jaune","label":"Jaune"},
        {"value":"marron","label":"Marron"},{"value":"noir","label":"Noir"},{"value":"orange","label":"Orange"},{"value":"rose","label":"Rose"},
        {"value":"rouge","label":"Rouge"},{"value":"vert","label":"Vert"},{"value":"violet","label":"Violet"},{"value":"autre","label":"Autre"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Portes
    ('sell','ad_params','doors','Nombre de portes','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"2","label":"2"},{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"999999","label":"6 ou plus"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Places
    ('sell','ad_params','seats','Nombre de place(s)','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"1","label":"1"},{"value":"2","label":"2"},{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"6","label":"6"},
        {"value":"999999","label":"7 ou plus"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Puissance fiscale
    ('sell','ad_params','horse_power','Puissance fiscale','text','Cv',
      '{"tooltip":["Il s''agit de la puissance fiscale de votre véhicule. Elle est située sur la droite de votre carte grise sous P.6"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":2,"regexp":"^[1-9]\\\\d*$","err_regexp":"Merci d''indiquer une puissance fiscale valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Puissance DIN
    ('sell','ad_params','horse_power_din','Puissance DIN','text','Ch',
      '{"tooltip":["Il s''agit de la puissance moteur (exprimée en chevaux DIN ou Kw) de votre véhicule. Elle est située au centre de votre carte grise sous P.2"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":3,"regexp":"^[1-9]\\\\d*$","err_regexp":"Merci d''indiquer une puissance DIN valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Kilométrage
    ('sell','ad_params','mileage','Kilométrage','text','km',
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":6,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez préciser le kilométrage","err_regexp":"La vente de véhicule neuf est interdite. Merci de préciser le kilométrage réel du véhicule"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Disponibilité pièces
    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- Crit'air
    ('sell','ad_params','critair','Crit''Air','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"0","label":"0"},{"value":"1","label":"1"},{"value":"2","label":"2"},{"value":"3","label":"3"},
        {"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"6","label":"Non classé"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Pensez à préciser la marque et le modèle de votre véhicule.","Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":8,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez indiquer le prix correspondant à votre annonce","err_regexp":"Veuillez saisir un prix valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Pensez à préciser la marque et le modèle de votre véhicule.","Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  sm.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM steps_map sm
JOIN fields_def f
  ON f.flow = sm.flow
 AND f.step_name = sm.step_name
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = sm.step_id
    AND ff.name = f.name
);

-- ==========================
-- NAUTISME categoryId = 2eab135e-188c-44da-b68d-3e0f469edce9
-- ==========================
WITH cat AS (
  SELECT id FROM categories WHERE id = '2eab135e-188c-44da-b68d-3e0f469edce9'
),

steps_def AS (
  SELECT * FROM (VALUES
    -- SELL
    ('sell','ad_params',   'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description', 'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',       'Quel est votre prix ?',    3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates', 'Où se situe votre bien ?', 4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',     'Vos coordonnées',          5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- BUY
    ('buy','description',  'Décrivez votre bien !',    1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',  'Où se situe votre bien ?', 2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',      'Vos coordonnées',          3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id
),

steps_map AS (
  SELECT fs.id AS step_id, sd.flow, sd.name AS step_name
  FROM steps_def sd
  JOIN form_steps fs
    ON fs."categoryId" = (SELECT id FROM cat)
   AND fs.flow = sd.flow
   AND fs.name = sd.name
),

fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','boat_type','Type','select',NULL,
      NULL::jsonb,
      '{"values":[
        {"value":"barques","label":"Barques"},
        {"value":"bateauxamoteur","label":"Bateaux à moteur"},
        {"value":"jetsskiscooters","label":"Jets skis, scooters"},
        {"value":"pneumatiquessemirigides","label":"Pneumatiques, semi-rigides"},
        {"value":"voiliermonocoque","label":"Voiliers monocoques"},
        {"value":"voiliermulticoques","label":"Voiliers multicoques"},
        {"value":"yacht","label":"Yachts"},
        {"value":"autre","label":"Autre"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    -- Nautisme: mandatory false + max_length 8 (pas de regexp dans ton JSON)
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":8}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  sm.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM steps_map sm
JOIN fields_def f
  ON f.flow = sm.flow
 AND f.step_name = sm.step_name
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = sm.step_id
    AND ff.name = f.name
);

-- ============================================
-- EQUIPEMENTS CARAVANING categoryId = a20f3354-c095-4f1c-807a-d8fb797dce48
-- ============================================
WITH cat AS (
  SELECT id FROM categories WHERE id = 'a20f3354-c095-4f1c-807a-d8fb797dce48'
),

steps_def AS (
  SELECT * FROM (VALUES
    -- SELL
    ('sell','ad_params',   'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description', 'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',       'Quel est votre prix ?',    3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates', 'Où se situe votre bien ?', 4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',     'Vos coordonnées',          5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- BUY
    ('buy','description',  'Décrivez votre bien !',    1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',  'Où se situe votre bien ?', 2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',      'Vos coordonnées',          3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id
),

steps_map AS (
  SELECT fs.id AS step_id, sd.flow, sd.name AS step_name
  FROM steps_def sd
  JOIN form_steps fs
    ON fs."categoryId" = (SELECT id FROM cat)
   AND fs.flow = sd.flow
   AND fs.name = sd.name
),

fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":9,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez spécifier le prix de l''annonce","err_regexp":"Le prix doit être un entier positif"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','price','new_item_price','Prix neuf','text','€',
      '{"info":["Maximisez vos chances de vendre en montrant à vos acheteurs potentiels le prix neuf de l’article"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":10,"regexp":"^([1-9]\\\\d*|0)$","err_regexp":"Merci d''indiquer un prix neuf valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  sm.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM steps_map sm
JOIN fields_def f
  ON f.flow = sm.flow
 AND f.step_name = sm.step_name
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = sm.step_id
    AND ff.name = f.name
);

-- ============================================
-- EQUIPEMENTS NAUTISME categoryId = 384fe5da-89ec-45c7-a275-01f6f87c6e9c
-- ============================================
WITH cat AS (
  SELECT id FROM categories WHERE id = '384fe5da-89ec-45c7-a275-01f6f87c6e9c'
),

steps_def AS (
  SELECT * FROM (VALUES
    -- SELL
    ('sell','ad_params',   'Dites-nous en plus',       1, '{"info":["Mettez en valeur votre annonce ! Plus il y a de détails, plus votre futur acheteur vous trouvera rapidement"]}'::jsonb),
    ('sell','description', 'Décrivez votre bien !',    2, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('sell','price',       'Quel est votre prix ?',    3, '{"info":["Vous le savez, le prix est important, autant pour vous que pour l''acheteur. Soyez juste, mais ayez en tête une marge de négociation si besoin"]}'::jsonb),
    ('sell','coordinates', 'Où se situe votre bien ?', 4, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('sell','contact',     'Vos coordonnées',          5, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb),

    -- BUY
    ('buy','description',  'Décrivez votre bien !',    1, '{"info":["Mettez en valeur votre bien ! Plus il y a de détails, plus votre annonce sera de qualité. Détaillez ici ce qui a de l''importance et ajoutera de la valeur"]}'::jsonb),
    ('buy','coordinates',  'Où se situe votre bien ?', 2, '{"info":["Complétez votre adresse et les personnes utilisant la recherche autour de soi trouveront plus facilement votre annonce. Si vous ne souhaitez pas renseigner votre adresse exacte, indiquez votre rue sans donner le numéro. Cette information ne sera conservée que le temps de la publication de votre annonce."]}'::jsonb),
    ('buy','contact',      'Vos coordonnées',          3, '{"info":["Pour plus de sécurité et faciliter vos échanges avec vos futurs contacts, merci d’entrer un numéro de téléphone valide"]}'::jsonb)
  ) AS t(flow, name, label, ord, info)
),

insert_steps AS (
  INSERT INTO form_steps ("categoryId", name, label, "order", flow, info)
  SELECT (SELECT id FROM cat), sd.name, sd.label, sd.ord, sd.flow, sd.info
  FROM steps_def sd
  WHERE NOT EXISTS (
    SELECT 1
    FROM form_steps fs
    WHERE fs."categoryId" = (SELECT id FROM cat)
      AND fs.name = sd.name
      AND fs.flow = sd.flow
  )
  RETURNING id
),

steps_map AS (
  SELECT fs.id AS step_id, sd.flow, sd.name AS step_name
  FROM steps_def sd
  JOIN form_steps fs
    ON fs."categoryId" = (SELECT id FROM cat)
   AND fs.flow = sd.flow
   AND fs.name = sd.name
),

fields_def AS (
  SELECT * FROM (VALUES

    -- =========================================================
    -- SELL / ad_params
    -- =========================================================
    ('sell','ad_params','spare_parts_availability','Durée de disponibilité des pièces détachées','select',NULL,
      '{
        "info":["Conformément à la loi, les professionnels ont l''obligation d''informer les consommateurs sur la durée de disponibilité des pièces détachées."],
        "tooltip":["Cette information peut être obtenue auprès des fabricants et importateurs des biens."]
      }'::jsonb,
      '{"values":[
        {"value":"non_disponible","label":"Non disponible"},
        {"value":"1","label":"1 an"},{"value":"2","label":"2 ans"},{"value":"3","label":"3 ans"},{"value":"4","label":"4 ans"},{"value":"5","label":"5 ans"},
        {"value":"6","label":"6 ans"},{"value":"7","label":"7 ans"},{"value":"8","label":"8 ans"},{"value":"9","label":"9 ans"},{"value":"10","label":"10 ans"},
        {"value":"11","label":"11 ans"},{"value":"12","label":"12 ans"},{"value":"13","label":"13 ans"},{"value":"14","label":"14 ans"},{"value":"15","label":"15 ans"},
        {"value":"16","label":"16 ans"},{"value":"17","label":"17 ans"},{"value":"18","label":"18 ans"},{"value":"19","label":"19 ans"},{"value":"20","label":"20 ans"},
        {"value":"21","label":"21 ans"},{"value":"22","label":"22 ans"},{"value":"23","label":"23 ans"},{"value":"24","label":"24 ans"},{"value":"25","label":"25 ans"},
        {"value":"26","label":"26 ans"},{"value":"27","label":"27 ans"},{"value":"28","label":"28 ans"},{"value":"29","label":"29 ans"},{"value":"30","label":"30 ans"}
      ]}'::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / description
    -- =========================================================
    ('sell','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / price
    -- =========================================================
    ('sell','price','price','Votre prix de vente','text','€',
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":9,"regexp":"^[1-9]\\\\d*$","err_mandatory":"Veuillez spécifier le prix de l''annonce","err_regexp":"Le prix doit être un entier positif"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('sell','price','new_item_price','Prix neuf','text','€',
      '{"info":["Maximisez vos chances de vendre en montrant à vos acheteurs potentiels le prix neuf de l’article"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":10,"regexp":"^([1-9]\\\\d*|0)$","err_regexp":"Merci d''indiquer un prix neuf valide"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- SELL / contact
    -- =========================================================
    ('sell','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('sell','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    ),

    -- =========================================================
    -- BUY / description
    -- =========================================================
    ('buy','description','subject','Titre de l''annonce','text',NULL,
      '{"info":["Vous n''avez pas besoin de mentionner « Achat » ou « Vente » ici."]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":100,"regexp":"[^\\\\s].*[^\\\\s]","err_mandatory":"Veuillez donner un titre à votre annonce","err_regexp":"Votre titre doit contenir au moins 2 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','body','Description de l''annonce','textarea',NULL,
      '{"info":["Indiquez dans le texte de l’annonce si vous proposez un droit de rétractation à l’acheteur. En l’absence de toute mention, l’acheteur n’en bénéficiera pas et ne pourra pas demander le remboursement ou l’échange du bien ou service proposé"]}'::jsonb,
      NULL::jsonb,
      '{"mandatory":true,"max_length":4000,"regexp":"[^\\\\s](.|\\\\n){13,}[^\\\\s]","err_mandatory":"Veuillez rédiger un texte d''annonce","err_regexp":"Votre annonce doit contenir au moins 15 caractères"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),
    ('buy','description','custom_ref','Référence','text',NULL,
      NULL::jsonb,
      NULL::jsonb,
      '{"mandatory":false,"max_length":30,"regexp":"^[a-zA-Z0-9_\\\\/\\\\.-]{1,30}$","err_regexp":"Les caractères autorisés sont les lettres sans accent ni cédille, les chiffres, - _ . / Les espaces ne sont pas autorisés"}'::jsonb,
      NULL::jsonb, NULL::jsonb, false, false
    ),

    -- =========================================================
    -- BUY / contact
    -- =========================================================
    ('buy','contact','email','Email','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"regexp":"^\\\\S+@\\\\S+\\\\.\\\\S+$","err_mandatory":"Veuillez insérer une adresse email","err_regexp":"Vérifiez l''adresse email, son format n''est pas valide"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone','Téléphone','text',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":true,"max_length":13,"regexp":"^(\\\\d{10}|\\\\+\\\\d\\\\d\\\\|\\\\d{8,9})$","err_mandatory":"Veuillez insérer un numéro de téléphone","err_regexp":"Votre numéro de téléphone doit comporter 10 chiffres, sans espace ni séparateur"}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','phone_hidden','Masquer le numéro','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,false,false
    ),
    ('buy','contact','no_salesmen','Refuser tout démarchage commercial','boolean',NULL,
      NULL::jsonb,NULL::jsonb,
      '{"mandatory":false}'::jsonb,
      NULL::jsonb,NULL::jsonb,true,false
    )

  ) AS t(flow, step_name, name, label, type, unit, info, "values", rules, modal_for_info, modals_for_info, default_checked, disabled)
)

INSERT INTO form_fields (
  "stepId", name, label, type, unit,
  info, "values", rules, modal_for_info, modals_for_info,
  default_checked, disabled
)
SELECT
  sm.step_id,
  f.name,
  f.label,
  f.type,
  f.unit,
  f.info,
  f."values",
  f.rules,
  f.modal_for_info,
  f.modals_for_info,
  f.default_checked,
  f.disabled
FROM steps_map sm
JOIN fields_def f
  ON f.flow = sm.flow
 AND f.step_name = sm.step_name
WHERE NOT EXISTS (
  SELECT 1
  FROM form_fields ff
  WHERE ff."stepId" = sm.step_id
    AND ff.name = f.name
);
