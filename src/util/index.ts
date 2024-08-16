const EXECUTE_META_TRANSACTION_FUNCTION_SELECTOR = '0c53c51c'

export const getExecuteMetaTransactionData = (
  account: string,
  fullSignature: string,
  functionSignature: string
): string => {
  const signature = fullSignature.replace('0x', '')
  const r = signature.substring(0, 64)
  const s = signature.substring(64, 128)
  const v = normalizeVersion(signature.substring(128, 130))

  const method = functionSignature.replace('0x', '')
  const signatureLength = (method.length / 2).toString(16)
  const signaturePadding = Math.ceil(method.length / 64)

  return [
    '0x',
    EXECUTE_META_TRANSACTION_FUNCTION_SELECTOR,
    to32Bytes(account),
    to32Bytes('a0'),
    r,
    s,
    to32Bytes(v),
    to32Bytes(signatureLength),
    padEnd(method, 64 * signaturePadding)
  ].join('')
}

export const normalizeVersion = (version: string): string => {
  /*
    This is a fix for an issue with Ledger, where `v` is returned as 0 or 1 and we expect it to be 27 or 28.
    See issue #26 of decentraland-transactions for more details: https://github.com/decentraland/decentraland-transactions/issues/26
  */
  let parsed = parseInt(version, 16)
  if (parsed < 27) {
    // this is because Ledger returns 0 or 1
    parsed += 27
  }
  if (parsed !== 27 && parsed !== 28) {
    throw Error(`Invalid signature version "${version}" (parsed: ${parsed})`)
  }
  return parsed.toString(16)
}

const to32Bytes = (value: number | string): string => {
  return padStart(value.toString().replace('0x', ''), 64)
}

export const padEnd = (src: string, length: number): string => {
  const len = src.length
  if (len >= length) return src
  if (len % 2 !== 0) src = '0' + src
  if (len < length)
    while (src.length < length) {
      src += '0'
    }
  return src
}
export const padStart = (src: string, length: number): string => {
  const len = src.length
  if (len >= length) return src
  if (len % 2 !== 0) src = '0' + src
  if (len < length)
    while (src.length < length) {
      src = '0' + src
    }
  return src
}
