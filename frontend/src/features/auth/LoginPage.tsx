/**
 * S-02 ログイン画面（05 画面設計書 5章）。
 */
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import { FIELD_ERROR, LOADING, TOAST } from '../../messages.ts'
import styles from './AuthForm.module.css'
import { useLogin } from './useAuth.ts'
import { validatePassword, validateUsername } from './validation.ts'

type Props = {
  /** 「新規登録はこちら」を押したとき */
  onSwitchToSignup: () => void
  /** セッション切れで戻されてきたときに true。期限切れのお知らせを出す */
  sessionExpired: boolean
}

export function LoginPage({ onSwitchToSignup, sessionExpired }: Props) {
  const login = useLogin()
  const usernameId = useId()
  const passwordId = useId()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{
    username?: string
    password?: string
  }>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // 未入力のまま押したときは通信せずに知らせる（05 画面設計書 5章）
    const nextErrors = {
      username: validateUsername(username),
      password: validatePassword(password, false),
    }
    if (nextErrors.username || nextErrors.password) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    login.mutate({ username, password })
  }

  // 認証失敗（401）はどちらが違うか書かない（業務ルール 5.6）
  const formError = (() => {
    if (!login.isError) return undefined
    if (login.error instanceof ApiError && login.error.status === 401) {
      return FIELD_ERROR.loginFailed
    }
    return TOAST.saveFailed
  })()

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>タスク管理</h1>

        {sessionExpired && !formError && <p className={styles.notice}>{TOAST.sessionExpired}</p>}
        {formError && (
          <p className={styles.formError} role="alert">
            ⚠ {formError}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor={usernameId}>
            ユーザーID
          </label>
          <input
            id={usernameId}
            className={`${styles.input} ${errors.username ? styles.invalid : ''}`}
            type="text"
            value={username}
            // 画面を開いたら先頭にカーソルを置く（05 画面設計書 5章）
            autoFocus
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() =>
              setErrors((prev) => ({
                ...prev,
                username: validateUsername(username),
              }))
            }
          />
          {errors.username && <p className={styles.fieldError}>{errors.username}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={passwordId}>
            パスワード
          </label>
          <input
            id={passwordId}
            className={`${styles.input} ${errors.password ? styles.invalid : ''}`}
            // 伏せ字で表示する（業務ルール 5.1）
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() =>
              setErrors((prev) => ({
                ...prev,
                password: validatePassword(password, false),
              }))
            }
          />
          {errors.password && <p className={styles.fieldError}>{errors.password}</p>}
        </div>

        <button type="submit" className={styles.submit} disabled={login.isPending}>
          {login.isPending ? LOADING.loggingIn : 'ログイン'}
        </button>

        <p className={styles.switch}>
          アカウントをお持ちでない方は{' '}
          <button type="button" className={styles.link} onClick={onSwitchToSignup}>
            新規登録はこちら
          </button>
        </p>
      </form>
    </div>
  )
}
