import { FETCHINGMYSTREAM } from "./actionType"

export const fetchMyStream = (payload) => {
    return { type: FETCHINGMYSTREAM, payload }
}

export const MyStream = (theStream) => {
    return (dispatch) => {
        dispatch(fetchMyStream(theStream))
    };
};