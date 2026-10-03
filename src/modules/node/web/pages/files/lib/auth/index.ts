import { api } from '../api'
import { createAuthClient } from './session'

/** Login, register, logout and the current user, for every page of this app. */
export const auth = createAuthClient(api)

export type { Credentials, Registration, SessionUser } from './session'
