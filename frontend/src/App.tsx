/**
 * アプリの入り口。05 画面設計書 3章の画面遷移をここで組み立てる。
 *
 *   アプリを開く → GET /api/auth/me
 *     401 → S-02 ログイン画面
 *     200 → S-01 メイン画面
 */
import { useState } from 'react'
import styles from './App.module.css'
import { FullScreenLoader } from './components/FullScreenLoader.tsx'
import { LoginPage } from './features/auth/LoginPage.tsx'
import { SignupPage } from './features/auth/SignupPage.tsx'
import { useCurrentUser, useLogout, useSessionExpired } from './features/auth/useAuth.ts'

export default function App() {
  const { data: user, isPending } = useCurrentUser()
  const sessionExpired = useSessionExpired()
  const [showSignup, setShowSignup] = useState(false)

  // /api/auth/me の結果が出るまでは全画面ローダー。
  // ここでログイン画面を出すと、ログイン済みの人にも一瞬見えてしまう（05 画面設計書 9章）
  if (isPending) {
    return <FullScreenLoader />
  }

  if (user) {
    return <MainPlaceholder username={user.username} onLoggedOut={() => setShowSignup(false)} />
  }

  if (showSignup) {
    return <SignupPage onSwitchToLogin={() => setShowSignup(false)} />
  }

  return <LoginPage onSwitchToSignup={() => setShowSignup(true)} sessionExpired={sessionExpired} />
}

/** S-01 メイン画面は次の PR で作る。それまでの動作確認用 */
function MainPlaceholder({ username, onLoggedOut }: { username: string; onLoggedOut: () => void }) {
  const logout = useLogout()
  return (
    <div className={styles.placeholder}>
      <p>{username} さんでログインしています</p>
      <p>メイン画面（S-01）は次の工程で作ります</p>
      <button
        type="button"
        className={styles.logout}
        onClick={() => logout.mutate(undefined, { onSettled: onLoggedOut })}
        disabled={logout.isPending}
      >
        ログアウト
      </button>
    </div>
  )
}
