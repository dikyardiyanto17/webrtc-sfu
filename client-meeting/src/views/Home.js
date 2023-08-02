import { useEffect, useRef, useState } from "react";
import ReactPlayer from 'react-player'
import '../assets/css/home.css'
import * as mediasoupClient from "mediasoup-client";

export default function Home({ url, socket }) {
    const myStreamRef = useRef()
    const [myStream, setMyStream] = useState()

    const remoteStreamRef = useRef()
    const [remoteStream, setRemoteStream] = useState()

    const [device, setDevice] = useState()
    const deviceRef = useRef()

    const [rtpCapabilities, setRtpCapabilities] = useState()
    const rtpCapabilitiesRef = useRef()

    const producerTransportRef = useRef()
    const [usProducerTransport, setUsProducerTransport] = useState()

    const consumerTransportRef = useRef()
    const [usCustomerTransport, setUsCustomerTransport] = useState()

    const producerRef = useRef()
    const [usProducer, setUsProducer] = useState()

    const consumerRef = useRef()
    const [usConsumer, setUsConsumer] = useState()

    const isProducerRef = useRef(false)
    const [isProducer, setIsProducer] = useState(false)

    const paramsRef = useRef({
        encodings: [
            {
                rid: 'r0',
                maxBitrate: 100000,
                scalabilityMode: 'S1T3',
            },
            {
                rid: 'r1',
                maxBitrate: 300000,
                scalabilityMode: 'S1T3',
            },
            {
                rid: 'r2',
                maxBitrate: 900000,
                scalabilityMode: 'S1T3',
            },
        ],
        codecOptions: {
            videoGoogleStartBitrate: 1000
        }
    })



    const initiate = async () => {
        try {
            console.log(socket.id)
            const response = await fetch(url);
            const data = await response.json();
            setTimeout(() => {
                console.log(socket.id)
            }, 100);
            console.log(data)
        } catch (error) {
            console.log(error)
        }
    }

    const getMyStream = (e) => {
        e.preventDefault()
        console.log('- My Socket : ', socket.id)
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            setMyStream(stream)
            myStreamRef.current = stream
            const track = stream.getVideoTracks()[0]
            paramsRef.current = { ...paramsRef.current, track }
            goConnect(true)
        })
    }

    const goConsume = () => {
        try {
            goConnect(false)
        } catch (error) {
            console.log(error)
        }
    }

    const goConnect = (producerOrConsumer) => {
        try {
            isProducerRef.current = producerOrConsumer
            setIsProducer(isProducerRef.current)
            deviceRef.current === undefined ? getRtpCapabilities() : goCreateTransport()
        } catch (error) {
            console.log(error)
        }
    }

    const goCreateTransport = () => {
        try {
            isProducerRef.current ? createSendTransport() : createRecvTransport()
        } catch (error) {
            console.log(error)
        }
    }

    const createDevices = async () => {
        try {
            deviceRef.current = new mediasoupClient.Device()
            setDevice(deviceRef.current)

            await deviceRef.current.load({
                routerRtpCapabilities: rtpCapabilitiesRef.current
            })
            console.log("- Devices Ref : ", deviceRef.current.rtpCapabilities)
            goCreateTransport()
        } catch (error) {
            console.log(error)
        }
    }

    const getRtpCapabilities = () => {
        socket.emit('createRoom', (data) => {
            console.log('- RTP Capabilities : ', data.rtpCapabilities)
            rtpCapabilitiesRef.current = data.rtpCapabilities
            setRtpCapabilities(data.rtpCapabilities)
            createDevices()
        })
    }

    const createSendTransport = () => {
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
            connectSendTransport()
        })
    }

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

    const createRecvTransport = async () => {
        await socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {
            if (params.error) {
                console.log(params.error)
                return
            }

            console.log("- Params : ", params)

            consumerTransportRef.current = deviceRef.current.createRecvTransport(params)

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
            connectRecvTransport()
        })
    }

    const connectRecvTransport = async () => {
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

    useEffect(() => {
        initiate()
        socket.on('connection-success', ({ socketId, isProducerExist }) => {
            console.log('- My Socket Id : ', socketId, " - Is Producer Exist : ", isProducerExist)
        })
    }, [])
    return (
        <>
            <div className="video-container-container">
                <div className="video-container">
                    <ReactPlayer
                        className='react-player'
                        id="my-video"
                        playing
                        url={myStream}
                        width='100%'
                        height='100%'
                        muted={true}
                    />
                </div>
                <div className="video-container">
                    <ReactPlayer
                        className='react-player'
                        id="my-video"
                        playing
                        url={remoteStream}
                        width='100%'
                        height='100%'
                        muted={true}
                    />
                </div>
            </div>
            <div>
                <button onClick={getMyStream}>Publish</button>
                <button onClick={goConsume}>Consume</button>
            </div>
        </>
    )
}
