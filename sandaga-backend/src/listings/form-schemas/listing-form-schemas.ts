import { ListingFormSchema, ListingFormStep } from './listing-form-schema.type';

// Plus de champs statiques par défaut
const BASE_STEPS: ListingFormStep[] = [];

const IMMOBILIER_STEPS: ListingFormStep[] = [
  {
    id: 'property',
    title: 'Caractéristiques du bien',
    description:
      'Ces informations permettent aux acheteurs de mieux situer et comprendre le logement.',
    fields: [
      {
        name: 'propertyType',
        type: 'select',
        label: 'Type de bien',
        placeholder: 'Sélectionnez un type',
        options: [
          { value: 'apartment', label: 'Appartement' },
          { value: 'house', label: 'Maison' },
          { value: 'room', label: 'Chambre' },
          { value: 'office', label: 'Bureau / Local' },
          { value: 'land', label: 'Terrain' }
        ],
        required: true
      },
      {
        name: 'floor',
        type: 'number',
        label: 'Étage',
        min: 0,
        max: 60
      },
      {
        name: 'hasElevator',
        type: 'switch',
        label: 'Ascenseur'
      },
      {
        name: 'furnished',
        type: 'switch',
        label: 'Meublé'
      },
      {
        name: 'energyClass',
        type: 'select',
        label: 'Classe énergétique',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
          { value: 'd', label: 'D' },
          { value: 'e', label: 'E' },
          { value: 'f', label: 'F' },
          { value: 'g', label: 'G' }
        ],
        withCustomValue: true
      },
      {
        name: 'charges',
        type: 'text',
        label: 'Charges mensuelles',
        placeholder: 'Ex: 45 000 FCFA'
      },
      {
        name: 'diagnostics',
        type: 'textarea',
        label: 'Diagnostics & conformité',
        rows: 4,
        hint: 'Indiquez les diagnostics obligatoires disponibles.'
      }
    ]
  },
  {
    id: 'amenities',
    title: 'Équipements & services',
    description:
      'Renseignez les équipements principaux. Ils apparaîtront sous forme de tags sur votre annonce.',
    fields: [
      {
        name: 'amenities',
        type: 'chips',
        label: 'Équipements disponibles',
        options: [
          { value: 'parking', label: 'Parking' },
          { value: 'security', label: 'Sécurité 24/7' },
          { value: 'pool', label: 'Piscine' },
          { value: 'water', label: 'Eau courante' },
          { value: 'electricity', label: 'Électricité' },
          { value: 'generator', label: 'Groupe électrogène' },
          { value: 'air-conditioning', label: 'Climatisation' },
          { value: 'internet', label: 'Internet haut débit' }
        ],
        multiSelect: true,
        withCustomValue: true
      },
      {
        name: 'services',
        type: 'multiselect',
        label: 'Services inclus',
        options: [
          { value: 'cleaning', label: 'Ménage' },
          { value: 'laundry', label: 'Blanchisserie' },
          { value: 'doorman', label: 'Concierge' },
          { value: 'maintenance', label: 'Maintenance' }
        ],
        multiSelect: true,
        withCustomValue: true
      }
    ]
  }
];

type SchemaMap = Record<
  string,
  {
    version: number;
    steps: ListingFormStep[];
  }
>;

const SCHEMA_BY_SLUG: SchemaMap = {
  immobilier: {
    version: 2,
    steps: [...IMMOBILIER_STEPS]
  },
  default: {
    version: 1,
    steps: BASE_STEPS
  }
};

export function getListingFormSchemaForCategory(
  categoryId: string,
  categorySlug: string
): ListingFormSchema {
  const schema = SCHEMA_BY_SLUG[categorySlug] ?? SCHEMA_BY_SLUG.default;

  return {
    categoryId,
    categorySlug,
    version: schema.version,
    steps: schema.steps,
    updatedAt: new Date().toISOString()
  };
}
