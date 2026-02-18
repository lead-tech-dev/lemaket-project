import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
type MapboxMap = import('mapbox-gl').Map
type MapboxMarker = import('mapbox-gl').Marker
import { useFormContext } from 'react-hook-form'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import type { FormField as CategoryFormField } from '../../types/category'
import { useI18n } from '../../contexts/I18nContext'

import 'mapbox-gl/dist/mapbox-gl.css'

type CoordinateFieldConfig = {
  field: CategoryFormField
  path: string
}

type MapPickerProps = {
  locationField?: CoordinateFieldConfig
  latitude?: CoordinateFieldConfig
  longitude?: CoordinateFieldConfig
  address?: CoordinateFieldConfig
  basePath: string
}

const DEFAULT_CENTER: [number, number] = [-17.4375, 14.6937] // Dakar

const mapContainerStyle: CSSProperties = {
  width: '100%',
  height: '320px',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
  border: '1px solid #e2e8f0'
}

const mapWrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
}

const suggestionListStyle: CSSProperties = {
  marginTop: '10px',
  borderRadius: '18px',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(255, 255, 255, 0.95)',
  boxShadow: '0 26px 50px rgba(15, 23, 42, 0.18)',
  maxHeight: '280px',
  overflowY: 'auto',
  position: 'absolute',
  width: '100%',
  zIndex: 20,
  padding: '10px 12px',
  backdropFilter: 'blur(14px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
}

const suggestionHeaderStyle: CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748b',
  fontWeight: 600,
  padding: '0 4px'
}

const suggestionItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  background: 'rgba(255, 255, 255, 0.75)',
  cursor: 'pointer',
  transition: 'all 0.18s ease',
  borderRadius: '14px',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  boxShadow: '0 0 0 rgba(15, 23, 42, 0)',
  textAlign: 'left',
  transform: 'none'
}

const suggestionItemHoverStyle: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(59, 130, 246, 0.06))',
  border: '1px solid rgba(37, 99, 235, 0.35)',
  boxShadow: '0 16px 32px rgba(37, 99, 235, 0.12)',
  transform: 'translateY(-2px)'
}

const suggestionIconStyle: CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '12px',
  background: 'rgba(37, 99, 235, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#1d4ed8',
  fontSize: '1.1rem',
  flexShrink: 0
}

const suggestionTextStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0
}

const suggestionLabelStyle: CSSProperties = {
  fontSize: '0.98rem',
  color: '#0f172a',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

const suggestionMetaStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

const suggestionArrowStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#64748b',
  opacity: 0.8,
  flexShrink: 0
}

type Suggestion = {
  id: string
  label: string
  context: string | null
  coordinates: [number, number]
  city?: string
  zipcode?: string
}

const resolveMandatoryMessage = (field: CategoryFormField | undefined, fallback: string): string => {
  if (!field?.rules) {
    return fallback
  }
  const rules = field.rules as { err_mandatory?: unknown } | null
  const raw = rules?.err_mandatory
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }
  return fallback
}

const toHint = (field: CategoryFormField | undefined, extra: string | undefined) => {
  const hints: string[] = []
  const rawHint = (field as unknown as { hint?: string })?.hint
  if (typeof rawHint === 'string' && rawHint.trim()) {
    hints.push(rawHint.trim())
  }
  if (extra && extra.trim()) {
    hints.push(extra.trim())
  }
  return hints.length ? hints.join(' · ') : undefined
}

const toTrimmedString = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const parseCoordinate = (value: unknown, fallback: number): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export function MapPicker({ latitude, longitude, address, locationField, basePath }: MapPickerProps) {
  const { t } = useI18n()
  const {
    register,
    watch,
    setValue,
    formState: { errors }
  } = useFormContext()

  const defaultLocationError = t('forms.mapPicker.errors.locationRequired')
  const defaultAddressError = t('forms.mapPicker.errors.addressRequired')

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markerRef = useRef<MapboxMarker | null>(null)
  const mapboxLibRef = useRef<typeof import('mapbox-gl') | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number>()

  const fallbackLatitudePath = `${basePath}.latitude`
  const fallbackLongitudePath = `${basePath}.longitude`
  const fallbackAddressPath = `${basePath}.address`

  const latitudePath = latitude?.path ?? fallbackLatitudePath
  const longitudePath = longitude?.path ?? fallbackLongitudePath
  const addressPath = address?.path ?? fallbackAddressPath

  const latValue = watch(latitudePath)
  const lngValue = watch(longitudePath)
  const addressValue = watch(addressPath)

  const [searchQuery, setSearchQuery] = useState(() =>
    typeof addressValue === 'string' ? addressValue : ''
  )
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null)
  const locationObjectValue = watch(locationField?.path ?? `${basePath}.location`)

  

  const latitudeErrorMessage = resolveMandatoryMessage(latitude?.field, defaultLocationError)
  const longitudeErrorMessage = resolveMandatoryMessage(longitude?.field, defaultLocationError)
  const addressFieldForMessage = address?.field ?? locationField?.field
  const addressErrorMessage = resolveMandatoryMessage(addressFieldForMessage, defaultAddressError)

  useEffect(() => {
    if (typeof addressValue === 'string') {
      setSearchQuery(addressValue)
    }
  }, [addressValue])

  // Hydrate address/coords from location object if address is empty
  useEffect(() => {
    if (typeof addressValue === 'string' && addressValue.trim()) {
      return
    }
    if (!locationObjectValue || typeof locationObjectValue !== 'object') {
      return
    }
    const obj = locationObjectValue as { address?: unknown; city?: unknown; zipcode?: unknown; zipCode?: unknown; lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown }
    const addr =
      (typeof obj.address === 'string' && obj.address.trim()) ||
      (typeof obj.city === 'string' && obj.city.trim()
        ? [obj.city, typeof obj.zipcode === 'string' ? obj.zipcode : obj.zipCode].filter(Boolean).join(' ')
        : '')

    if (addr) {
      setSearchQuery(addr)
      setValue(addressPath, addr, { shouldDirty: false, shouldValidate: false })
    }

    const latCandidate =
      typeof obj.lat === 'number'
        ? obj.lat
        : typeof obj.latitude === 'number'
        ? obj.latitude
        : undefined
    const lngCandidate =
      typeof obj.lng === 'number'
        ? obj.lng
        : typeof obj.longitude === 'number'
        ? obj.longitude
        : undefined

    const latEmpty = latValue === undefined || latValue === null || latValue === ''
    const lngEmpty = lngValue === undefined || lngValue === null || lngValue === ''
    if (latEmpty && latCandidate !== undefined) {
      setValue(latitudePath, latCandidate, { shouldDirty: false, shouldValidate: false })
    }
    if (lngEmpty && lngCandidate !== undefined) {
      setValue(longitudePath, lngCandidate, { shouldDirty: false, shouldValidate: false })
    }
  }, [addressValue, locationObjectValue, addressPath, setValue, latValue, lngValue, latitudePath, longitudePath])

  const updateMarker = useCallback(
    (lngLat: [number, number], fly = true) => {
      if (!mapRef.current || !mapboxLibRef.current) {
        return
      }
      markerRef.current =
        markerRef.current ??
        new mapboxLibRef.current.Marker({ color: '#ff6e14' })
          .setLngLat(lngLat)
          .addTo(mapRef.current)
      markerRef.current.setLngLat(lngLat)
      if (fly) {
        mapRef.current.easeTo({ center: lngLat, zoom: Math.max(mapRef.current.getZoom(), 14) })
      }
    },
    []
  )

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token || typeof window === 'undefined') {
      return
    }

    let cancelled = false

    const initialize = async () => {
      const module = await import('mapbox-gl')
      const mapboxgl = (module.default ?? module) as unknown as typeof import('mapbox-gl')
      if (cancelled) return
      mapboxLibRef.current = mapboxgl

      if (!mapContainerRef.current) return

      ;(mapboxgl as any).accessToken = token

      const initialLng = parseCoordinate(lngValue, DEFAULT_CENTER[0]);
      const initialLat = parseCoordinate(latValue, DEFAULT_CENTER[1]);

      if (mapRef.current) return

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [initialLng, initialLat],
        zoom:
          latValue !== undefined &&
          latValue !== null &&
          latValue !== '' &&
          lngValue !== undefined &&
          lngValue !== null &&
          lngValue !== ''
            ? 13
            : 4
      })

      map.on('load', () => {
        const latStr = toTrimmedString(latValue)
        const lngStr = toTrimmedString(lngValue)
        const initialLat = Number(latStr)
        const initialLng = Number(lngStr)

        if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
          updateMarker([initialLng, initialLat], false)
        } else if (markerRef.current) {
          markerRef.current.remove()
          markerRef.current = null
        }
      })

      map.on('click', event => {
        setValue(latitudePath, Number(event.lngLat.lat), { shouldDirty: true, shouldValidate: true })
        setValue(longitudePath, Number(event.lngLat.lng), { shouldDirty: true, shouldValidate: true })
        updateMarker([event.lngLat.lng, event.lngLat.lat])
        setSuggestions([])
        const tokenInner = import.meta.env.VITE_MAPBOX_TOKEN
        if (!tokenInner) return
        void fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${event.lngLat.lng},${event.lngLat.lat}.json?access_token=${tokenInner}&limit=1`
        )
          .then(res => (res.ok ? res.json() : null))
          .then(data => {
            const feature = data?.features?.[0]
            if (feature) {
              setSearchQuery(feature.place_name)
              setValue(addressPath, feature.place_name, { shouldDirty: true, shouldValidate: true })
              const city =
                feature.context?.find((ctx: any) => typeof ctx.id === 'string' && ctx.id.startsWith('place'))
                  ?.text ?? undefined
              const zipcode =
                feature.context?.find((ctx: any) => typeof ctx.id === 'string' && ctx.id.startsWith('postcode'))
                  ?.text ?? undefined
              if (city) {
                setValue('city', city, { shouldDirty: true, shouldValidate: false })
              }
              if (zipcode) {
                setValue(`${basePath}.zipcode`, zipcode, { shouldDirty: true, shouldValidate: false })
              }
            }
          })
          .catch(() => {
            /* ignore reverse geocode errors */
          })
      })

      mapRef.current = map
    }

    void initialize()

    return () => {
      cancelled = true
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markerRef.current = null
      mapboxLibRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !mapboxLibRef.current) {
      return
    }
    const latStr = toTrimmedString(latValue)
    const lngStr = toTrimmedString(lngValue)
    if (!latStr || !lngStr) {
      return
    }
    const latNum = Number(latStr)
    const lngNum = Number(lngStr)
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      updateMarker([lngNum, latNum], false)
    }
  }, [latValue, lngValue, updateMarker])

  const accessToken = import.meta.env.VITE_MAPBOX_TOKEN
  if (!accessToken) {
    return (
      <div className="alert alert--warning">
        <strong>{t('forms.mapPicker.errors.missingTokenTitle')}</strong>{' '}
        {t('forms.mapPicker.errors.missingTokenMessage', { envVar: 'VITE_MAPBOX_TOKEN' })}
      </div>
    )
  }

  const getFieldError = useCallback(
    (path: string | undefined) => {
      if (!path) return undefined
      const segments = path.split('.')
      let current: any = errors
      for (const segment of segments) {
        if (!current) {
          return undefined
        }
        current = current[segment as keyof typeof current]
      }
      if (!current) return undefined
      if (typeof current === 'string') return current
      if (Array.isArray(current)) {
        return current.map(entry => String(entry)).join(', ')
      }
      if (typeof current === 'object' && 'message' in current) {
        return String((current as { message: unknown }).message)
      }
      return undefined
    },
    [errors]
  )

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }

    const query = searchQuery.trim()
    if (query.length < 3) {
      setSuggestions([])
      setHoveredSuggestionId(null)
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const controller = new AbortController()
        searchAbortRef.current = controller
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${accessToken}&autocomplete=true&limit=6&country=cm`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error(t('forms.mapPicker.errors.mapbox', { status: response.status }))
        }
        const data = await response.json()
        const items: Suggestion[] = (data.features ?? []).map((feature: any) => ({
          id: feature.id,
          label: feature.place_name,
          context:
            feature.context
              ?.map((ctx: any) => ctx.text)
              .filter(Boolean)
              .join(' · ') ?? null,
          coordinates: feature.center,
          city:
            feature.context?.find((ctx: any) => typeof ctx.id === 'string' && ctx.id.startsWith('place'))
              ?.text ?? undefined,
          zipcode:
            feature.context?.find((ctx: any) => typeof ctx.id === 'string' && ctx.id.startsWith('postcode'))
              ?.text ?? undefined
        }))
        setSuggestions(items)
        setHoveredSuggestionId(items.length ? items[0].id : null)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSearchError(t('forms.mapPicker.errors.loadAddresses'))
        }
      } finally {
        setIsSearching(false)
      }
    }, 350)

    debounceRef.current = timeoutId

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchQuery, accessToken])

  const handleSuggestionSelect = useCallback(
    (suggestion: Suggestion) => {
      setSuggestions([])
      setHoveredSuggestionId(null)
      setSearchQuery(suggestion.label)
      setValue(addressPath, suggestion.label, { shouldDirty: true, shouldValidate: true })
      setValue(latitudePath, suggestion.coordinates[1], { shouldDirty: true, shouldValidate: true })
      setValue(longitudePath, suggestion.coordinates[0], { shouldDirty: true, shouldValidate: true })
      updateMarker(suggestion.coordinates)
      if (suggestion.city) {
        setValue('city', suggestion.city, { shouldDirty: true, shouldValidate: false })
      }
      if (suggestion.zipcode) {
        setValue(`${basePath}.zipcode`, suggestion.zipcode, { shouldDirty: true, shouldValidate: false })
      }
    },
    [addressPath, basePath, latitudePath, longitudePath, setValue, updateMarker]
  )

  const latRegister = register(latitudePath, {
    valueAsNumber: true,
    validate: value => {
      if (value === undefined || value === null || value === '') {
        return latitudeErrorMessage
      }
      const numeric = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(numeric) ? true : latitudeErrorMessage
    }
  })
  const lngRegister = register(longitudePath, {
    valueAsNumber: true,
    validate: value => {
      if (value === undefined || value === null || value === '') {
        return longitudeErrorMessage
      }
      const numeric = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(numeric) ? true : longitudeErrorMessage
    }
  })
  const addressRegister = register(addressPath, {
    validate: value => {
      const normalized = typeof value === 'string' ? value.trim() : ''
      return normalized.length > 0 ? true : addressErrorMessage
    }
  })

  return (
    <div style={mapWrapperStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>{t('forms.mapPicker.title')}</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          {t('forms.mapPicker.subtitle')}
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <FormField
          label={address?.field.label ?? locationField?.field.label ?? t('forms.mapPicker.addressLabel')}
          htmlFor={`map-search-${addressPath}`}
          error={searchError ?? getFieldError(addressPath)}
          hint={toHint(address?.field ?? locationField?.field, t('forms.mapPicker.hint'))}
        >
          <div style={{ position: 'relative' }}>
            <Input
              id={`map-search-${addressPath}`}
              value={searchQuery}
              onChange={event => {
                const value = event.target.value
                setSearchQuery(value)
                setValue(addressPath, value, { shouldDirty: true, shouldValidate: true })
                if (!value.trim()) {
                  setValue(latitudePath, null, { shouldDirty: true, shouldValidate: true })
                  setValue(longitudePath, null, { shouldDirty: true, shouldValidate: true })
                  if (markerRef.current) {
                    markerRef.current.remove()
                    markerRef.current = null
                  }
                }
              }}
              placeholder={t('forms.mapPicker.placeholder')}
              autoComplete="off"
            />
            {isSearching ? (
              <span
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.78rem',
                  color: '#64748b'
                }}
              >
                {t('forms.mapPicker.searching')}
              </span>
            ) : null}
          </div>
        </FormField>
        {suggestions.length ? (
          <div style={suggestionListStyle}>
            <span style={suggestionHeaderStyle}>{t('forms.mapPicker.suggestions')}</span>
            {suggestions.map((suggestion, index) => {
              const parts = suggestion.label.split(',')
              const primary = parts[0]?.trim() ?? suggestion.label
              const secondaryFromLabel = parts.slice(1).join(',').trim()
              const meta =
                secondaryFromLabel.length > 0
                  ? secondaryFromLabel
                  : suggestion.context ?? ''
              const isHovered = hoveredSuggestionId === suggestion.id
              const isFirst = index === 0
              const combinedStyle: CSSProperties = {
                ...suggestionItemStyle,
                ...(isHovered ? suggestionItemHoverStyle : {}),
                ...(isFirst && !isHovered
                  ? { border: '1px solid rgba(37, 99, 235, 0.28)' }
                  : {})
              }

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  style={combinedStyle}
                  onMouseEnter={() => setHoveredSuggestionId(suggestion.id)}
                  onMouseLeave={() => setHoveredSuggestionId(null)}
                  onFocus={() => setHoveredSuggestionId(suggestion.id)}
                  onBlur={() => setHoveredSuggestionId(null)}
                >
                  <div style={suggestionIconStyle}>📍</div>
                  <div style={suggestionTextStyle}>
                    <span style={suggestionLabelStyle} title={primary}>
                      {primary}
                    </span>
                    {meta ? (
                      <span style={suggestionMetaStyle} title={meta}>
                        {meta}
                      </span>
                    ) : null}
                  </div>
                  <span style={suggestionArrowStyle}>↵</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div ref={mapContainerRef} style={mapContainerStyle} aria-label={t('forms.mapPicker.mapAria')} />

      <input
        type="hidden"
        {...latRegister}
        value={toTrimmedString(latValue)}
        readOnly
      />
      <input
        type="hidden"
        {...lngRegister}
        value={toTrimmedString(lngValue)}
        readOnly
      />
      <input
        type="hidden"
        {...addressRegister}
        value={searchQuery}
        readOnly
      />
    </div>
  )
}
