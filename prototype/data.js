// ダミーデータ（保存はしない。再読み込みでこの状態に戻る）
// 並び順は配列の順番で表す
const data = {
  boards: [
    {
      id: 'b1',
      name: '課題制作',
      lists: [
        {
          id: 'l1',
          name: '未着手',
          cards: [
            { id: 'c1', title: '画面設計書を書く', description: 'メイン画面とカード詳細のレイアウトを決める。' },
            { id: 'c2', title: 'テスト項目を洗い出す', description: '' },
            { id: 'c3', title: '公開先を決める', description: 'GitHub Pages と Vercel を比べる。' },
          ],
        },
        {
          id: 'l2',
          name: '作業中',
          cards: [
            { id: 'c4', title: 'プロトタイプを作る', description: 'HTML・CSS・JavaScript だけで、見た目と動きを確認する。' },
          ],
        },
        {
          id: 'l3',
          name: '完了',
          cards: [
            { id: 'c5', title: '要件定義書を書く', description: 'v0.9 まで更新済み。', done: true },
            { id: 'c6', title: 'GitHub にリポジトリを作る', description: '', done: true },
          ],
        },
      ],
    },
    {
      id: 'b2',
      name: '家事',
      lists: [
        {
          id: 'l4',
          name: '今週やること',
          cards: [
            { id: 'c7', title: '洗濯', description: '' },
            { id: 'c8', title: '買い物', description: '牛乳、卵、パン' },
          ],
        },
        { id: 'l5', name: '済み', cards: [] },
      ],
    },
    {
      id: 'b3',
      name: '勉強',
      lists: [],
    },
  ],
};
