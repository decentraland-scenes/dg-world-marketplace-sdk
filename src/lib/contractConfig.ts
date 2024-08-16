class ContractConfig {
  private contractConfigs: any
  constructor() {
    void this.fetchContractConfig()
  }

  public getContractConfigByName(name: string): any {
    return this.contractConfigs[name]
  }

  private async fetchContractConfig(): Promise<any> {
    try {
      const url = `https://pub-d74340d79d8e4ff6953ce683be56feac.r2.dev/contracts-configs/config.json`
      const res: Response = await fetch(url)
      const configs = await res.json()
      this.contractConfigs = configs
      return configs
    } catch (err) {
      console.error('Error fetching contract config', err)
      throw err
    }
  }
}
const contractConfig = new ContractConfig()

export default contractConfig
