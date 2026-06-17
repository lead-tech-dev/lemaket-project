import { useLocalSearchParams } from 'expo-router'
import { ListingEditor } from '@/features/listings/ListingEditor'

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ListingEditor mode="edit" listingId={id} />
}
