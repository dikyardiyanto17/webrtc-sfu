import { useEffect, useRef, useState } from "react";
import ReactPlayer from 'react-player'
import '../assets/css/home.css'

export default function Home({ url, socket }) {
    const myStreamRef = useRef()
    const [myStream, setMyStream] = useState()
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
        })
    }
    useEffect(() => {
        initiate()
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
                        url={myStream}
                        width='100%'
                        height='100%'
                        muted={true}
                    />
                </div>
            </div>
            <div>
                <button onClick={getMyStream}>Get My Stream</button>
                <button>Get My Stream</button>
            </div>
        </>
    )
}
