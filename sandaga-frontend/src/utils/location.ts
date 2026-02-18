type LocationInput =
  | string
  | {
      address?: string | null
      city?: string | null
      zipcode?: string | null
      zipCode?: string | null
      postal_code?: string | null
      label?: string | null
    }
  | null
  | undefined

export const formatCityZip = (city?: string | null, zipcode?: string | null): string => {
  const safeCity = typeof city === 'string' ? city.trim() : ''
  const safeZip = typeof zipcode === 'string' ? zipcode.trim() : ''
  if (safeCity && safeZip) {
    return `${safeZip} ${safeCity}`
  }
  return safeCity || safeZip || ''
}

export const formatListingLocation = (
  location: LocationInput,
  fallback = ''
): string => {
  if (typeof location === 'string') {
    return location
  }
  if (location && typeof location === 'object') {
    const hideExact = Boolean((location as { hideExact?: boolean }).hideExact)
    const address = typeof location.address === 'string' ? location.address.trim() : ''
    const city = typeof location.city === 'string' ? location.city.trim() : ''
    const zipcode =
      typeof location.zipcode === 'string'
        ? location.zipcode.trim()
        : typeof location.zipCode === 'string'
        ? location.zipCode.trim()
        : typeof location.postal_code === 'string'
        ? location.postal_code.trim()
        : ''
    const cityZip = formatCityZip(city, zipcode)
    if (hideExact) {
      return cityZip || city || fallback
    }
    if (address) {
      return cityZip ? `${address}, ${cityZip}` : address
    }
    if (cityZip) {
      return cityZip
    }
    if (typeof location.label === 'string' && location.label.trim()) {
      return location.label.trim()
    }
  }
  return fallback
}
