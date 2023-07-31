import { FETCHINGMYSTREAM } from "../action/actionType"

const initialState = {
    stream: null
}

export default function streamReducer(state = initialState, action) {
    switch (action.type) {
        case FETCHINGMYSTREAM:
            return { ...state, stream: action.payload }
        default:
            return state
    }
}