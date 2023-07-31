const cors = require('cors');
const express = require('express');
const https = require('https'); // Use https module instead of http for SSL support
const fs = require('fs'); // Require the 'fs' module to read SSL certificates
const { Server } = require("socket.io");

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
const server = https.createServer(credentials, app); // Use 'https' with the SSL credentials

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ['GET', "POST", "PUT"],
    },
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', async (req, res) => {
    try {
        return res.status(200).json({ message: "What The Fuck" });
    } catch (error) {
        console.log(error)
    }
});

io.on('connection', (socket) => {
    console.log(socket.id, "IS CONNECTED")
    socket.on("disconnect", () => {
        console.log(socket.id, " is disconnected")
    });
});

server.listen(port, () => {
    console.log("App on port " + port);
});
