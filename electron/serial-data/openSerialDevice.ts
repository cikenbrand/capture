import { SerialPort } from 'serialport'
import { EventEmitter } from 'node:events'

export type Parity = 'none' | 'even' | 'odd' | 'mark' | 'space'
export type StopBits = 1 | 2
export type DataBits = 5 | 6 | 7 | 8

export interface SerialLiveData {
  onData: (handler: (data: Buffer) => void) => void
  onError: (handler: (error: Error) => void) => void
  onClose: (handler: () => void) => void
  close: () => Promise<void>
}

export async function openSerialDevice(
  portName: string,
  baudRate: number,
  stopBits: StopBits,
  dataBits: DataBits,
  parity: Parity,
): Promise<SerialLiveData> {
  const port = new SerialPort({
    path: portName,
    baudRate,
    dataBits,
    stopBits,
    parity,
    autoOpen: false,
  })

  await new Promise<void>((resolve, reject) => {
    port.open(err => {
      if (err) return reject(err)
      resolve()
    })
  })

  const emitter = new EventEmitter()

  const handleData = (data: Buffer) => {
    emitter.emit('data', data)
  }
  const handleError = (error: Error) => {
    emitter.emit('error', error)
  }
  const handleClose = () => {
    emitter.emit('close')
  }

  port.on('data', handleData)
  port.on('error', handleError)
  port.on('close', handleClose)

  return {
    onData: (handler) => emitter.on('data', handler),
    onError: (handler) => emitter.on('error', handler),
    onClose: (handler) => emitter.on('close', handler),
    close: async () => {
      port.off('data', handleData)
      port.off('error', handleError)
      port.off('close', handleClose)
      await new Promise<void>((resolve) => {
        try {
          port.close(() => resolve())
        } catch {
          resolve()
        }
      })
    },
  }
}


