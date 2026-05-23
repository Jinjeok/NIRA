import { getStateValue, setStateValue } from '../storage/appStore.js';

function messageKey(key) {
    return `messageId:${key}`;
}

export async function getMessageId(key) {
    return getStateValue(messageKey(key), null);
}

export async function setMessageId(key, id) {
    setStateValue(messageKey(key), id);
}
