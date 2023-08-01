const cors = require('cors');
const express = require('express');
const https = require('https');
const fs = require('fs');
const { Server } = require("socket.io");
const mediasoup = require('mediasoup')

const app = express();
const port = 2222;

// SSL certificate paths
const privateKeyPath = './server.key';
const certificatePath = './server.crt';
const credentials = {
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(certificatePath),
};

app.use(cors());
const server = https.createServer(credentials, app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ['GET', "POST", "PUT"],
    },
});

const peers = io.of('/mediasoup')

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', async (req, res) => {
    try {
        return res.status(200).json({ message: "What The Fuck" });
    } catch (error) {
        console.log(error)
    }
});

let worker
let router
let producerTransport
let consumerTransport
let producer
let consumer

const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
    })
    console.log(`worker pid ${worker.pid}`)

    worker.on('died', error => {
        // This implies something serious happened, so kill the application
        console.error('mediasoup worker has died')
        setTimeout(() => process.exit(1), 2000) // exit in 2 seconds
    })

    return worker
}

const createWebRtcTransport = async (callback) => {
    try {
        const webRtcTransport_options = {
            listenIps: [
                {
                    ip: '127.0.0.1'
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

worker = createWorker()

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

    socket.on('createWebRtcTransport', async ({ sender }, callback) => {
        console.log(`Is this a sender request? ${sender}`)
        if (sender)
            producerTransport = await createWebRtcTransport(callback)
        else
            consumerTransport = await createWebRtcTransport(callback)
    })

    socket.on('transport-connect', async ({ dtlsParameters }) => {
        console.log('DTLS PARAMS... ', { dtlsParameters })
        await producerTransport.connect({ dtlsParameters })
    })

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

})

server.listen(port, () => {
    console.log("App on port " + port);
});
