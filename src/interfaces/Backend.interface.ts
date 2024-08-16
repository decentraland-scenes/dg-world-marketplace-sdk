export type BackendBalanceData = {
  iceBalance: number
  maticBalance: number
  status: string
}

export type BackendBalance = {
  message: string
  data: BackendBalanceData
  status: number
}
