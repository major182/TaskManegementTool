/**
 * アプリの入り口。05 画面設計書 3章の画面遷移をここで組み立てる。
 *
 *   アプリを開く → GET /api/auth/me
 *     401 → S-02 ログイン画面
 *     200 → S-01 メイン画面
 */
import { useEffect, useRef, useState } from 'react'
import { FullScreenLoader } from './components/FullScreenLoader.tsx'
import { LoadFailedScreen } from './components/LoadFailedScreen.tsx'
import { LoginPage } from './features/auth/LoginPage.tsx'
import { SignupPage } from './features/auth/SignupPage.tsx'
import { useCurrentUser, useSessionExpired } from './features/auth/useAuth.ts'
import { MainScreen } from './features/board/MainScreen.tsx'

/** 履歴に残す目印。新規登録画面を開いているときだけ付ける */
const SIGNUP_HISTORY_STATE = { screen: 'signup' }
/** 履歴に残す目印。ログインしてメイン画面（S-01）にいるときに付ける */
const BOARD_HISTORY_STATE = { screen: 'board' }

function screenInHistory(): string | undefined {
  return (window.history.state as { screen?: string } | null)?.screen
}

function isSignupInHistory(): boolean {
  return screenInHistory() === 'signup'
}

function isBoardInHistory(): boolean {
  return screenInHistory() === 'board'
}

export default function App() {
  const { data: user, isPending, isError, refetch } = useCurrentUser()
  const sessionExpired = useSessionExpired()
  const [showSignup, setShowSignup] = useState(false)

  // 「戻る」が押された時点でログイン中かどうかを知りたいが、
  // 購読をやり直さずに済むよう、最新の値を箱に入れて参照する
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  /**
   * ブラウザの「戻る」に対応する（05 画面設計書 3章）。
   *
   * 画面はルーターを使わず state だけで切り替えているため、そのままでは
   * 戻るを押すとアプリの外へ出てしまい、画面が真っ白になる。
   * そこで画面ごとに履歴の目印を積み、戻るでアプリ内に留まるようにする。
   *
   *   新規登録画面（S-03）で戻る → ログイン画面（S-02）へ
   *   メイン画面（S-01）で戻る   → メイン画面のまま（目印を積み直す）
   */
  useEffect(() => {
    function handlePopState() {
      // ログイン中は出ていかない。目印を積み直して、今の画面に留まる
      if (userRef.current) {
        window.history.pushState(BOARD_HISTORY_STATE, '')
        return
      }
      setShowSignup(isSignupInHistory())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ログイン・登録に成功したら、メイン画面の目印に置き換える。
  // 新規登録の目印が残っていると、戻ったときに新規登録画面へ行ってしまう
  useEffect(() => {
    if (!user || isBoardInHistory()) return

    if (isSignupInHistory()) {
      window.history.replaceState(BOARD_HISTORY_STATE, '')
    } else {
      window.history.pushState(BOARD_HISTORY_STATE, '')
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
