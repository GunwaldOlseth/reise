import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/** Public Firebase web config for project homey-376215 (overrides via VITE_*). */
const firebaseConfig = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string) ||
    'AIzaSyCKdF6f1wTrrDqCeti7NLKZ6QQ6ZnoUebg',
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ||
    'homey-376215.firebaseapp.com',
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) ||
    'homey-376215',
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string) ||
    '1:624978663833:web:650e2ae3a61736055d5b08',
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

export const firebaseApp = firebaseConfigured
  ? initializeApp(firebaseConfig)
  : null

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
