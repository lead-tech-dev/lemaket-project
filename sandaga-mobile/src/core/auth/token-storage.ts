import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'lemaket.accessToken'

let accessToken: string | null = null

export const getAccessToken = (): string | null => accessToken

export const hydrateAccessToken = async (): Promise<string | null> => {
  try {
    accessToken = await SecureStore.getItemAsync(TOKEN_KEY)
    return accessToken
  } catch {
    accessToken = null
    return null
  }
}

export const persistAccessToken = async (token: string | null): Promise<void> => {
  accessToken = token
  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    return
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}
