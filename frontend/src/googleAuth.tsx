import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { firebaseAuth, firebaseConfigured } from './firebase'

export type GoogleUser = {
  email: string
  name: string
  picture?: string
}

type GoogleAuthApi = {
  user: GoogleUser | null
  ready: boolean
  configured: boolean
  login: () => void
  logout: () => void
  /** Google OAuth access token (incl. Drive) — prompts login if needed. */
  getAccessToken: () => Promise<string>
}

const GoogleAuthContext = createContext<GoogleAuthApi | null>(null)
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

function toGoogleUser(u: User): GoogleUser {
  return {
    email: u.email || '',
    name: u.displayName || u.email || 'Google-bruker',
    picture: u.photoURL || undefined,
  }
}

export function GoogleAuthProviderView({ children }: { children: ReactNode }) {
  const configured = firebaseConfigured && Boolean(firebaseAuth)
  const [ready, setReady] = useState(!configured)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const auth = firebaseAuth
    if (!configured || !auth) return
    let unsub = () => {}
    void setPersistence(auth, browserLocalPersistence)
      .catch(() => {
        /* ignore — default persistence still applies */
      })
      .finally(() => {
        unsub = onAuthStateChanged(auth, (next) => {
          setUser(next?.email ? toGoogleUser(next) : null)
          setReady(true)
        })
      })
    return () => unsub()
  }, [configured])

  const loginWithGoogle = useCallback(async (): Promise<string> => {
    if (!firebaseAuth) {
      throw new Error(
        'Google-innlogging er ikke konfigurert. Mangler Firebase-miljøvariabler.',
      )
    }
    const provider = new FirebaseGoogleAuthProvider()
    provider.addScope(DRIVE_SCOPE)
    provider.setCustomParameters({ prompt: 'select_account' })
    const result = await signInWithPopup(firebaseAuth, provider)
    const cred = FirebaseGoogleAuthProvider.credentialFromResult(result)
    const token = cred?.accessToken
    if (!token) {
      throw new Error(
        'Fikk ikke tilgangstoken fra Google. Sjekk at Google-innlogging er aktivert i Firebase Authentication.',
      )
    }
    setAccessToken(token)
    setUser(toGoogleUser(result.user))
    return token
  }, [])

  const login = useCallback(() => {
    void loginWithGoogle().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('auth/popup-closed-by-user')) return
      console.error(err)
      window.alert(
        msg.includes('auth/operation-not-allowed')
          ? 'Google-innlogging er ikke aktivert ennå.\n\nÅpne Firebase → Authentication → Sign-in method → Google → Enable.'
          : msg,
      )
    })
  }, [loginWithGoogle])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    if (firebaseAuth) void signOut(firebaseAuth)
  }, [])

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (accessToken) return accessToken
    return loginWithGoogle()
  }, [accessToken, loginWithGoogle])

  const value = useMemo(
    () => ({
      user,
      ready,
      configured,
      login,
      logout,
      getAccessToken,
    }),
    [user, ready, configured, login, logout, getAccessToken],
  )

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  )
}

/** @deprecated use GoogleAuthProviderView — kept name for main.tsx import */
export const GoogleAuthProvider = GoogleAuthProviderView

export function useGoogleAuth(): GoogleAuthApi {
  const ctx = useContext(GoogleAuthContext)
  if (!ctx) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider')
  }
  return ctx
}

/** Upload KML to the signed-in user's Drive (app-created files only). */
export async function uploadKmlToDrive(
  accessToken: string,
  filename: string,
  kml: string,
): Promise<{ id: string; webViewLink?: string }> {
  const metadata = {
    name: filename,
    mimeType: 'application/vnd.google-earth.kml+xml',
  }
  const boundary = 'reise_kml_boundary'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/vnd.google-earth.kml+xml; charset=UTF-8',
    '',
    kml,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      text.includes('accessNotConfigured')
        ? 'Google Drive API er ikke aktivert for prosjektet.'
        : `Kunne ikke lagre til Drive (${res.status})`,
    )
  }
  return (await res.json()) as { id: string; webViewLink?: string }
}
