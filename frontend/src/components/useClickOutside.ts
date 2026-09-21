import { useEffect, useRef, type RefObject } from 'react'

/**
 * 自分の外側が押されたときに知らせる。
 *
 * 入力欄の blur だけに頼らない理由：
 * 押した先が焦点を持てない場所だったり、ドラッグ＆ドロップの処理が既定の動作を
 * 止めていたりすると、入力欄から焦点が外れず、編集状態が開いたままになるため。
 * 押された場所そのものを見れば、焦点がどうなろうと確実に閉じられる（業務ルール 5.5）。
 *
 * pointerdown を見るのは、押した時点で閉じたいから。click まで待つと、
 * 押した先のボタンが反応したあとに閉じることになり、順番が入れ替わる。
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled = true,
) {
  // 1回押しただけで pointerdown と mousedown の両方が届くため、
  // 二重に知らせて保存が2回走らないようにする目印
  const alreadyFired = useRef(false)

  useEffect(() => {
    if (!enabled) return

    function handle(event: Event) {
      const element = ref.current
      if (!element) return
      if (event.target instanceof Node && element.contains(event.target)) return
      if (alreadyFired.current) return

      alreadyFired.current = true
      // 同じ操作で続けて届くイベントを飛ばしたあとに戻す
      setTimeout(() => {
        alreadyFired.current = false
      }, 0)
      onOutside()
    }

    // capture: true にして、途中で伝播が止められても受け取れるようにする。
    // mousedown も見ているのは、pointerdown が使えない場面で取りこぼさないため
    document.addEventListener('pointerdown', handle, true)
    document.addEventListener('mousedown', handle, true)
    return () => {
      document.removeEventListener('pointerdown', handle, true)
      document.removeEventListener('mousedown', handle, true)
    }
  }, [ref, onOutside, enabled])
}
