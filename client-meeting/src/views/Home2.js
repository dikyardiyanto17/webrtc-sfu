import { useEffect, useRef, useState } from "react";
import '../assets/css/home.css'
import ReactPlayer from 'react-player'

export default function Home2({ url, socket }) {
    const myStreamRef = useRef()
    const [myStream, setMyStream] = useState()
    const initiate = async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            // Do something with the data
            console.log(data, ' - socket id : ', socket.id);
            return data; // Return the data if needed
        } catch (error) {
            console.log(error)
        }
    }
    useEffect(() => {
        initiate()
    }, [])
    return (
        <>
            <div className="video-container-2">
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
            <div className="video-container-2">
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
        </>
    )
}