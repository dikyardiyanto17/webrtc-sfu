# webrtc-sfu
## Media Soup Scheme (one to one, on server there are only one producer and one consumer)
### Detailed Scheme
- If there are 2 user (A and B) and A click publish first, then if user A or B click consume, remote video will contain video A.
- Get RTP Capabilities (on client side emit.something) from server, and in server side create a worker then save the worker
```js
const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
    })
    console.log(`worker pid ${worker.pid}`)

    worker.on('died', error => {
        console.error('mediasoup worker has died')
        setTimeout(() => process.exit(1), 2000) 
    })

    return worker
}
let worker
worker = createWorker()
```
- Then create router in socket connection (server side)
```js
const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000,
        },
    },
]

peers.on('connection', async socket => {
    socket.emit('connection-success', {
        socketId: socket.id
    })

    socket.on('disconnect', () => {
        console.log('peer disconnected')
    })

    router = await worker.createRouter({ mediaCodecs })

    socket.on('getRtpCapabilities', (callback) => {
        const rtpCapabilities = router.rtpCapabilities
        callback({ rtpCapabilities })
    })
    ...
})
```
- Make a device based on RTPCapabilities on serverside, then save it on clientside by emiting signal

Client Side
```js
    const getRtpCapabilities = (e) => {
        e.preventDefault()
        socket.emit('getRtpCapabilities', (data) => {
            console.log('- RTP Capabilities : ', data.rtpCapabilities)
            rtpCapabilitiesRef.current = data.rtpCapabilities
            setRtpCapabilities(data.rtpCapabilities)
        })
    }
```

Server Side
```js
    socket.on('getRtpCapabilities', (callback) => {
        const rtpCapabilities = router.rtpCapabilities
        callback({ rtpCapabilities })
    })
```

- After saving it on clientside then create device to save mediasoupClient and get a stream then save ourstream

Client Side
```js
import * as mediasoupClient from "mediasoup-client";

export default function blabla (){
    const createDevices = async (e) => {
        e.preventDefault()
        try {
            deviceRef.current = new mediasoupClient.Device()
            setDevice(deviceRef.current)

            await deviceRef.current.load({
                routerRtpCapabilities: rtpCapabilities
            })
            console.log("- Devices Ref : ", deviceRef.current.rtpCapabilities)
        } catch (error) {
            console.log(error)
        }
    }
    return(
        <div>
        Blabla
        </div>
    )
}
```

- Then, createSendTransport in client side and emitting signal sender: true
```js
socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {blablabla})
```

- In server side, after getting signal from client side, it will create transport and will responding to client side with transport id, iceParameters, iceCandidates and dtlsParameters

```js
const createWebRtcTransport = async (callback) => {
    try {
        const webRtcTransport_options = {
            listenIps: [
                {
                    ip: '192.168.206.123'
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        }

        let transport = await router.createWebRtcTransport(webRtcTransport_options)
        console.log(`transport id: ${transport.id}`)

        transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') {
                transport.close()
            }
        })

        transport.on('close', () => {
            console.log('transport closed')
        })

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }
        })
        return transport
    } catch (error) {
        console.log(error)
        callback({
            params: {
                error: error
            }
        })
    }
}

let producerTransport
let customerTransport

peers.on('connection', async socket => {
    ...
    socket.on('createWebRtcTransport', async ({ sender }, callback) => {
        console.log(`Is this a sender request? ${sender}`)
        if (sender)
            producerTransport = await createWebRtcTransport(callback)
        else
            consumerTransport = await createWebRtcTransport(callback)
    })

})
```

- After getting transport data from server side, make a producerTransport function on as needed

```js
    const createSendTransport = (e) => {
        e.preventDefault()
        socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {
            if (params.error) {
                console.log(params.error)
                return
            }

            console.log(params)

            producerTransportRef.current = deviceRef.current.createSendTransport(params)

            producerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await socket.emit('transport-connect', {
                        dtlsParameters,
                    })

                    callback()

                } catch (error) {
                    errback(error)
                }
            })

            producerTransportRef.current.on('produce', async (parameters, callback, errback) => {
                console.log(parameters)

                try {
                    await socket.emit('transport-produce', {
                        kind: parameters.kind,
                        rtpParameters: parameters.rtpParameters,
                        appData: parameters.appData,
                    }, ({ id }) => {
                        callback({ id })
                    })
                } catch (error) {
                    errback(error)
                }
            })
        })
    }
```

- On producerTransport.on.connect, take a dltsParameters and emit signal to server side and connecting to producer transport based on dltsParameters

```js
    socket.on('transport-connect', async ({ dtlsParameters }) => {
        console.log('DTLS PARAMS... ', { dtlsParameters })
        await producerTransport.connect({ dtlsParameters })
    })
```

- When producer transport function on product triggered, it will producing parameter and emitting signal to server side with produced parameters. On server side, take a kind, rtpParameters, app data from dltsParameters then produce a producer transport with kind and rtpParameters

```js

    const connectSendTransport = async (e) => {
        e.preventDefault()
        try {
            producerRef.current = await producerTransportRef.current.produce(paramsRef.current)
            setUsProducer(producerRef.current)

            producerRef.current.on('trackended', () => {
                console.log("TRACK ENDED")
            })

            producerRef.current.on('transportclose', () => {
                console.log("TRANSPORT ENDED")
            })

        } catch (error) {
            console.log(error)
        }
    }

    producerTransportRef.current.on('produce', async (parameters, callback, errback) => {
        console.log(parameters)
        try {
            await socket.emit('transport-produce', {
                kind: parameters.kind,
                rtpParameters: parameters.rtpParameters,
                appData: parameters.appData,
                }, 
                ({ id }) => {
                    callback({ id })
                    })}
        catch (error) {
            errback(error)
            }
         })
```

- For creating receiving transport, its the same as producing transport. First, Get Capabilities, createDevices, and the rest is the same with a bit twist

Client Side
```js
    const createRecvTransport = async (e) => {
        e.preventDefault()
        await socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {
            if (params.error) {
                console.log(params.error)
                return
            }

            console.log("- Params : ", params)

            consumerTransportRef.current = device.createRecvTransport(params)

            consumerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await socket.emit('transport-recv-connect', {
                        dtlsParameters,
                    })

                    callback()
                } catch (error) {
                    errback(error)
                }
            })
        })
    }

    const connectRecvTransport = async (e) => {
        e.preventDefault()
        await socket.emit('consume', {
            rtpCapabilities: deviceRef.current.rtpCapabilities,
        }, async ({ params }) => {
            if (params.error) {
                console.log('Cannot Consume')
                return
            }

            console.log(params)
            consumerRef.current = await consumerTransportRef.current.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters
            })

            const { track } = consumerRef.current

            remoteStreamRef.current = new MediaStream([track])
            setRemoteStream(remoteStreamRef.current)

            socket.emit('consumer-resume')
        })
    }
```

Server Side
```js
    socket.on('createWebRtcTransport', async ({ sender }, callback) => {
        console.log(`Is this a sender request? ${sender}`)
        if (sender)
            producerTransport = await createWebRtcTransport(callback)
        else
            consumerTransport = await createWebRtcTransport(callback)
    })


    socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
        console.log(`DTLS PARAMS: ${dtlsParameters}`)
        await consumerTransport.connect({ dtlsParameters })
    })

    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        try {
            if (router.canConsume({
                producerId: producer.id,
                rtpCapabilities
            })) {
                consumer = await consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                })

                consumer.on('transportclose', () => {
                    console.log('transport close from consumer')
                })

                consumer.on('producerclose', () => {
                    console.log('producer of consumer closed')
                })

                const params = {
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                }

                callback({ params })
            }
        } catch (error) {
            console.log(error.message)
            callback({
                params: {
                    error: error
                }
            })
        }
    })

    socket.on('consumer-resume', async () => {
        console.log('consumer resume')
        await consumer.resume()
    })

```

### Simplified Scheme
#### Producer Side
- Get Local Video [Client Side]
- Creating Router [Server Side]
```js
let router = worker.createRouter({ mediaCodecs })
```
- Get RTPCapabilities from server and and save it in Client Side
```js
const rtpCapabilities = router.rtpCapabilities
```
- Create Device [Client Side] and load the routerRtpCapabilities on devices
```js
deviceRef.current = new mediasoupClient.Device()
await deviceRef.current.load({
    routerRtpCapabilities: rtpCapabilitiesRef.current
})
```
- Create Send Transport. First, create variable in Server Side producerTransport, then create webrtctransport with option parameters and send the created webrtctransport to Client Side

Client Side Signaling the server to get parameter.
```js
socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {})
```
Server Side creating transport variable
```js
socket.on('createWebRtcTransport', async ({ sender }, callback) => {
    console.log(`Is this a sender request? ${sender}`)
    if (sender)
        producerTransport = await createWebRtcTransport(callback)
    else
        consumerTransport = await createWebRtcTransport(callback)
})
```
Creating WEBRTC TRANSPORT and sending back parameters to Client Side
```js
const createWebRtcTransport = async (callback) => {
    const webRtcTransport_options = {
        listenIps: [{ ip: '192.168.206.123' }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        }
        let transport = await router.createWebRtcTransport(webRtcTransport_options)
        console.log(`transport id: ${transport.id}`)

        transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') {
                transport.close()
            }
        })

        transport.on('close', () => {
            console.log('transport closed')
        })

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }
        })
        return transport
}
```
- Assign / Create send Transport from device to Producer Transport
```js
const producerTransportRef = useRef()

producerTransportRef.current = deviceRef.current.createSendTransport(params)
```

- Assign Producer Transport on connect and on produce function

Client Side ProducerTransport On Connect to get dlts parameters and send it to Server Side
```js
producerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
        await socket.emit('transport-connect', {dtlsParameters })
        callback()
    } catch (error) {
        errback(error)
    }
})
```
Server Side Producer Transport On Connect and receiver dltsparameters from Client Side, then Connecting Producer Transport with dlts option from Client Side
```js
socket.on('transport-connect', async ({ dtlsParameters }) => {
    await producerTransport.connect({ dtlsParameters })
})
```
Client Side ProducerTransport On Produce to get parameters and send it to Server Side
```js
producerTransportRef.current.on('produce', async (parameters, callback, errback) => {
    console.log(parameters)

    try {
        await socket.emit('transport-produce', {
            kind: parameters.kind,
            rtpParameters: parameters.rtpParameters,
            appData: parameters.appData,
        }, ({ id }) => {
            callback({ id })
        })
    } catch (error) {
        errback(error)
    }
})
```
Server Side Producing Transport Produce with parameters from Client Side
```js
socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
    producer = await producerTransport.produce({
        kind,
        rtpParameters,
    })

    console.log('Producer ID: ', producer.id, producer.kind)

    producer.on('transportclose', () => {
        console.log('transport for this producer closed ')
        producer.close()
    })

    callback({
        id: producer.id
    })
})
```

- On Client Side triggering Producer Transport on produce function to create producer
```js
const connectSendTransport = async () => {
    try {
        producerRef.current = await producerTransportRef.current.produce(paramsRef.current)
        setUsProducer(producerRef.current)

        producerRef.current.on('trackended', () => {
            console.log("TRACK ENDED")
        })

        producerRef.current.on('transportclose', () => {
            console.log("TRANSPORT ENDED")
        })

    } catch (error) {
        console.log(error)
    }
}
```

#### Consumer Side
- Get Local Video [Client Side]
- Creating Router if there is no router[Server Side]
```js
let router = worker.createRouter({ mediaCodecs })
```
- Get RTPCapabilities from server and and save it in Client Side
```js
const rtpCapabilities = router.rtpCapabilities
```
- Create Device [Client Side] and load the routerRtpCapabilities on devices
```js
deviceRef.current = new mediasoupClient.Device()
await deviceRef.current.load({
    routerRtpCapabilities: rtpCapabilitiesRef.current
})
```
- Create Receive Transport. First, create variable in Server Side Receive Transport, then create webrtctransport with option parameters and send the created webrtctransport to Client Side

Client Side Signaling the server to get parameter.
```js
socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {})
```
Server Side creating transport variable
```js
socket.on('createWebRtcTransport', async ({ sender }, callback) => {
    console.log(`Is this a sender request? ${sender}`)
    if (sender)
        producerTransport = await createWebRtcTransport(callback)
    else
        consumerTransport = await createWebRtcTransport(callback)
})
```
Creating WEBRTC TRANSPORT and sending back parameters to Client Side
```js
const createWebRtcTransport = async (callback) => {
    const webRtcTransport_options = {
        listenIps: [{ ip: '192.168.206.123' }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        }
        let transport = await router.createWebRtcTransport(webRtcTransport_options)
        console.log(`transport id: ${transport.id}`)

        transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') {
                transport.close()
            }
        })

        transport.on('close', () => {
            console.log('transport closed')
        })

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }
        })
        return transport
}
```
- Assign / Create Receive Transport from device to Consumer Transport
```js
const consumerTransportRef = useRef()

consumerTransportRef.current = deviceRef.current.createRecvTransport(params)
```

- Assign Consumer Transport on connect

Client Side ProducerTransport On Connect to get dlts parameters and send it to Server Side
```js
consumerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
        await socket.emit('transport-recv-connect', {
            dtlsParameters,
        })

        callback()
    } catch (error) {
        errback(error)
    }
})
```
Server Side Consumer Transport On Connect and received dltsparameters from Client Side, then Connecting Consumer Transport with dlts option from Client Side
```js
socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
    await consumerTransport.connect({ dtlsParameters })
})
```
- After that send signal to server with rtpCapabilities data from device variable, then getting parameters from server side, then trigger Consumer Transport Consume

Client Side emitting signal with rtpCapabilities and triggering Consumer Transport Consume with data from server
```js
await socket.emit('consume', {
    rtpCapabilities: deviceRef.current.rtpCapabilities,
}, async ({ params }) => {
    if (params.error) {
        console.log('Cannot Consume')
        return
    }

    consumerRef.current = await consumerTransportRef.current.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters
    })

    const { track } = consumerRef.current

    remoteStreamRef.current = new MediaStream([track])
    setRemoteStream(remoteStreamRef.current)

    socket.emit('consumer-resume')
})
```

Server Side received rtpCapabilities from Client Side and producing consume from router.canConsume. After that triggering Consumer Transport consume with rtpCapabilities received from Client Side and sending parameters to Client Side and Continue Video.
```js
socket.on('consume', async ({ rtpCapabilities }, callback) => {
    try {
        if (router.canConsume({
            producerId: producer.id,
            rtpCapabilities
        })) {
            consumer = await consumerTransport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: true,
            })

            consumer.on('transportclose', () => {
                console.log('transport close from consumer')
            })

            consumer.on('producerclose', () => {
                console.log('producer of consumer closed')
            })

            const params = {
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            }

            callback({ params })
        }
    } catch (error) {
        console.log(error.message)
        callback({
            params: {
                error: error
            }
        })
    }
})

socket.on('consumer-resume', async () => {
    console.log('consumer resume')
    await consumer.resume()
})
```