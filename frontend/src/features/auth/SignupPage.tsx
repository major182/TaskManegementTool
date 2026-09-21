/**
 * S-03 新規登録画面（05 画面設計書 6章）。
 * 成功するとそのままログイン状態になり、メイン画面（S-01）へ進む（業務ルール 5.6）。
 */
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import { FIELD_ERROR, LOADING, TOAST } from '../../messages.ts'
import styles from './AuthForm.module.css'
import { useSignup } from './useAuth.ts'
import { validatePassword, validatePasswordConfirmation, validateUsername } from './validation.ts'

type Props = {
  /** 「ログインはこちら」を押したとき */
  onSwitchToLogin: () => void
}

type Errors = {
  username?: string
  password?: string
  confirmation?: string
}

export function SignupPage({ onSwitchToLogin }: Props) {
  const signup = useSignup()
  const usernameId = useId()
  const passwordId = useId()
  const confirmationId = useId()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const nextErrors: Errors = {
      username: validateUsername(username),
      password: validatePassword(password, true),
      confirmation: validatePasswordConfirmation(password, confirmation),
    }
    if (nextErrors.username || nextErrors.password || nextErrors.confirmation) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    // 確認用パスワードは画面側だけで照合し、API には送らない（05 画面設計書 6章）
    signup.mutate({ username, password })
  }

  // ユーザーID の重複は登録を押すまで分からない（409）。該当の欄に出す
  const duplicateUsername =
    signup.error instanceof ApiError && signup.error.status === 409
      ? FIELD_ERROR.usernameTaken
      : undefined

  const formError = signup.isError && !duplicateUsername ? TOAST.saveFailed : undefined

  const usernameError = errors.username ?? duplicateUsername

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>新規登録</h1>

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
            className={`${styles.input} ${usernameError ? styles.invalid : ''}`}
            type="text"
            value={username}
            autoFocus
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            // 入力チェックは入力欄を離れたときに行う（業務ルール 5.1）
            onBlur={() =>
              setErrors((prev) => ({
                ...prev,
                username: validateUsername(username),
              }))
            }
          />
          <p className={styles.hint}>
            半角英数字とアンダースコアで4〜20文字。あとから変更できません
          </p>
          {usernameError && <p className={styles.fieldError}>{usernameError}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={passwordId}>
            パスワード
          </label>
          <input
            id={passwordId}
            className={`${styles.input} ${errors.password ? styles.invalid : ''}`}
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() =>
              setErrors((prev) => ({
                ...prev,
                password: validatePassword(password, true),
              }))
            }
          />
          <p className={styles.hint}>英字と数字を含む8文字以上</p>
          {errors.password && <p className={styles.fieldError}>{errors.password}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={confirmationId}>
            パスワード（確認用）
          </label>
          <input
            id={confirmationId}
            className={`${styles.input} ${errors.confirmation ? styles.invalid : ''}`}
            type="password"
            value={confirmation}
            autoComplete="new-password"
            onChange={(e) => setConfirmation(e.target.value)}
            onBlur={() =>
              setErrors((prev) => ({
                ...prev,
                confirmation: validatePasswordConfirmation(password, confirmation),
              }))
            }
          />
          {errors.confirmation && <p className={styles.fieldError}>{errors.confirmation}</p>}
        </div>

        {/* 登録ボタンの上に常時表示する（業務ルール 5.6） */}
        <p className={styles.warning}>
          <strong>パスワードを忘れるとデータを開けなくなります。</strong>
          再設定はできません
        </p>

        <button type="submit" className={styles.submit} disabled={signup.isPending}>
          {signup.isPending ? LOADING.signingUp : '登録する'}
        </button>

        <p className={styles.switch}>
          すでにアカウントをお持ちの方は{' '}
          <button type="button" className={styles.link} onClick={onSwitchToLogin}>
            ログインはこちら
          </button>
        </p>
      </form>
    </div>
  )
}
