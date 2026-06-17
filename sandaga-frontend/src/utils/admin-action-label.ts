const ACTION_LABELS: Record<string, string> = {
  'users.update': 'Mise à jour utilisateur',
  'users.promote': 'Promotion utilisateur',
  'users.delete': 'Suppression utilisateur',
  'reports.update': 'Mise à jour signalement',
  'promotions.create': 'Création promotion',
  'promotions.update': 'Mise à jour promotion',
  'promotions.status': 'Changement statut promotion',
  'promotions.payment_status': 'Mise à jour paiement promotion',
  'promotions.delete': 'Suppression promotion',
  'promotion.delete': 'Suppression promotion',
  'categories.create': 'Création catégorie',
  'categories.update': 'Mise à jour catégorie',
  'categories.delete': 'Suppression catégorie',
  'listings.status': 'Changement statut annonce'
}

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

export const getAdminActionLabel = (action?: string | null) => {
  if (!action) return 'Action inconnue'
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]

  if (action.endsWith('.export')) {
    const scope = action.slice(0, -'.export'.length)
    return `Export ${capitalize(scope)}`
  }

  if (action.includes('.')) {
    const [scope, type] = action.split('.', 2)
    return `${capitalize(scope)} · ${type.replace(/_/g, ' ')}`
  }

  return capitalize(action.replace(/_/g, ' '))
}
