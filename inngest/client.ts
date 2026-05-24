import { Inngest } from 'inngest'

// Single Inngest client instance shared across all function definitions.
// The app ID scopes all events and functions to this application in the
// Inngest dashboard.
export const inngest = new Inngest({ id: 'siddartha' })
