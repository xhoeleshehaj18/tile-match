// Notes from him and her own dates, kept encrypted (see task: filled in below).

let dates = {};

/** Her date `id` ('birthday', 'anniversary') as YYYY-MM-DD, or null when it isn't known. */
export const personalDate = id => dates[id] ?? null;
export const noteText = async id => null;
