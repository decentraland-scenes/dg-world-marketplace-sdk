// function getUserData() {

import { getUserData } from '~system/UserIdentity'

// }

export async function getUserAddress(): Promise<string> {
  const data = await getUserData({})
  return data.data?.publicKey ?? ''
}
