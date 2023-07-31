import { combineReducers } from "redux";
import streamReducer from ".";

const rootReducer = combineReducers({
    streams: streamReducer,
})

export default rootReducer