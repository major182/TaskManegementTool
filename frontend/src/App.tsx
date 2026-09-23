/**
 * アプリの入り口。05 画面設計書 3章の画面遷移をここで組み立てる。
 *
 *   アプリを開く → GET /api/auth/me
 *     401 → S-02 ログイン画面
 *     200 → S-01 メイン画面
 */
import { useEffect, useState } from 'react'
import { FullScreenLoader } from './components/FullScreenLoader.tsx'
import { LoadFailedScreen } from './components/LoadFailedScreen.tsx'
import { LoginPage } from './features/auth/LoginPage.tsx'
import { SignupPage } from './features/auth/SignupPage.tsx'
import { useCurrentUser, useSessionExpired } from './features/auth/useAuth.ts'
import { MainScreen } from './features/board/MainScreen.tsx'

/** 履歴に残す目印。新規登録画面を開いているときだけ付ける */
const SIGNUP_HISTORY_STATE = { screen: 'signup' }

function isSignupInHistory(): boolean {
  return (window.history.state as { screen?: string } | null)?.screen === 'signup'
}

export default function App() {
  const { data: user, isPending, isError, refetch } = useCurrentUser()
  const sessionExpired = useSessionExpired()
  const [showSignup, setShowSignup] = useState(false)

  /**
   * ブラウザの「戻る」に対応する。
   *
   * 画面はルーターを使わず state だけで切り替えているため、そのままだと
   * 新規登録画面で戻るを押したときにアプリの外へ出てしまい、画面が真っ白になる。
   * 新規登録画面へ移るときに履歴を1つ積んでおき、戻るでログイン画面に返す。
   */
  useEffect(() => {
    function handlePopState() {
      setShowSignup(isSignupInHistory())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ログイン・登録に成功したら、積んでおいた目印を消す。
  // 残したままだと、メイン画面で戻るを押しても何も起きないように見えるため
  useEffect(() => {
    if (user && isSignupInHistory()) {
      window.history.replaceState({}, '')
    }
  }, [user])

  // /api/auth/me の結果が出るまでは全画面ローダー。
  // ここでログイン画面を出すと、ログイン済みの人にも一瞬見えてしまう（05 画面設計書 9章）
  if (isPending) {
    return <FullScreenLoader />
  }

  if (user) {
    return <MainScreen user={user} />
  }

  // 未ログイン（401）は user が null になる。ここに来るのは
  // サーバーが落ちている・通信できないなど別の理由なので、
  // ログイン画面を出さずに読み込み失敗として伝える（05 画面設計書 9章）
  if (isError) {
    return <LoadFailedScreen onRetry={() => void refetch()} />
  }

  if (showSignup) {
    return (
      <SignupPage
        // 戻るボタンと同じ動きにして、履歴が二重に積み上がらないようにする
        onSwitchToLogin={() => window.history.back()}
      />
    )
  }

  return (
    <LoginPage
      onSwitchToSignup={() => {
        window.history.pushState(SIGNUP_HISTORY_STATE, '')
        setShowSignup(true)
      }}
      sessionExpired={sessionExpired}
    />
  )
}
