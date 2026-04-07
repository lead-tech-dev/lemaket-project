import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getListingImageSource } from '@/core/utils/listing-image'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import type { ListingItem } from '@/features/listings/listings.api'

type ListingCardProps = {
  item: ListingItem
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

const formatPrice = (price: string, currency: string) => {
  const value = Number(price)
  if (!Number.isFinite(value)) {
    return `${price} ${currency}`
  }
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: currency || 'XAF',
    maximumFractionDigits: 0
  }).format(value)
}

export function ListingCard({ item, onPress, style }: ListingCardProps) {
  const city = item.location?.city || item.location?.address || 'Localisation inconnue'
  const zip = item.location?.zipcode?.trim()
  const locationLine = zip ? `${city} ${zip}` : city
  const imageSource = getListingImageSource(item)
  const category = item.category?.name ?? 'Catégorie'

  return (
    <Pressable style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.media}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" />
        <Pressable style={styles.favoriteFab} onPress={event => event.stopPropagation()}>
          <Ionicons name="heart-outline" size={21} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.price}>{formatPrice(item.price, item.currency || 'XAF')}</Text>
        <Text style={styles.meta} numberOfLines={2}>
          {category} · {locationLine}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent'
  },
  cardPressed: {
    opacity: 0.92
  },
  media: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  favoriteFab: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft
  },
  body: {
    paddingTop: spacing.sm
  },
  title: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm,
    lineHeight: 19
  },
  price: {
    marginTop: spacing.xs,
    color: colors.text,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.body,
    lineHeight: 20
  },
  meta: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.bodyXs,
    lineHeight: 18
  }
})
