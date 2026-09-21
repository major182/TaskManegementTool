// Vitest の各テストの前に読み込まれる共通設定。
// toBeInTheDocument などの DOM 向けアサーションを使えるようにする。
import '@testing-library/jest-dom/vitest'

// jsdom は <dialog> の showModal/close を実装していない（ブラウザにはある）。
// 確認ダイアログのテストが動かないだけで、本番の動きには関係しないため、
// テスト環境にだけ最小限の代わりを置く。
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show() {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(returnValue?: string) {
      this.open = false
      if (returnValue !== undefined) this.returnValue = returnValue
      this.dispatchEvent(new Event('close'))
    }
  }
}
