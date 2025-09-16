import path from 'node:path'
import { getObsClient } from './connectToOBSWebsocket'

/**
 * Requests OBS to exit via obs-shutdown-plugin vendor API using shared client.
 * The function races the vendor request against a timeout and resolves to true on success.
 */
export async function exitOBS(): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false

  const force = true
  const timeoutMs = 3000

  const requestData = {
    reason: `requested by ${path.basename(process.execPath)}`,
    support_url: 'https://github.com/norihiro/obs-shutdown-plugin/issues',
    force,
    exit_timeout: 0.0,
  }

  const vendorCall = obs.call('CallVendorRequest', {
    vendorName: 'obs-shutdown-plugin',
    requestType: 'shutdown',
    requestData,
  } as any)

  const timeout = new Promise<never>((_, reject) => {
    const t = setTimeout(() => {
      clearTimeout(t)
      reject(new Error('exitOBS timed out'))
    }, timeoutMs)
  })

  try {
    await Promise.race([vendorCall, timeout])
    return true
  } catch (err) {
    // Vendor plugin missing or OBS refused; treat as failure
    return false
  }
}


