import { createBrowserRouter } from "react-router-dom";
// import { redirect } from "react-router-dom";
import socketIO from 'socket.io-client';
import NotFound from "../views/NotFound";
import Home from "../views/Home";
// import Home2 from "../views/Home2";
const url = 'https://192.168.206.123:2222/'
const socket = socketIO("https://192.168.206.123:2222/mediasoup", { rejectUnauthorized: false });

const router = createBrowserRouter([
    {
        path: "/",
        children: [
            {
                path: "",
                element: <Home url={url} socket={socket} />
            },
            {
                path: '*',
                element: <NotFound />
            }
        ]
    }
]);

export default router;