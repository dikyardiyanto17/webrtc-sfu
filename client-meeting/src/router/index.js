import { createBrowserRouter } from "react-router-dom";
// import { redirect } from "react-router-dom";
import socketIO from 'socket.io-client';
import NotFound from "../views/NotFound";
import Home from "../views/Home";
// import Home2 from "../views/Home2";
const url = 'https://127.0.0.1:2222/'
const socket = socketIO("https://127.0.0.1:2222/mediasoup");
// const socket = socketIO.connect("https://127.0.0.1:2222/");

const router = createBrowserRouter([
    {
        path: "/",
        children: [
            {
                path: "",
                element: <Home url={url} socket={socket}/>
            },
            {
                path: '*',
                element: <NotFound />
            }
        ]
    }
]);

export default router;