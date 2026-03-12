// 災害防止協議会 議題テンプレート
// テンプレートを追加する場合は TEMPLATES 配列に新しいオブジェクトを追加してください。
// content の各要素が agendaItems の content に対応します（インデックス順）。

export interface AgendaTemplate {
  id: string;
  label: string;
  contents: string[];  // 7つの議題に対応する初期文（空文字で未入力）
}

export const AGENDA_TEMPLATES: AgendaTemplate[] = [
  {
    id: "none",
    label: "テンプレートなし",
    contents: ["", "", "", "", "", "", ""],
  },
  {
    id: "earthwork",
    label: "土工系",
    contents: [
      "前回指摘事項の是正確認を行った。",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
  },
  {
    id: "weeding",
    label: "除草作業系",
    contents: [
      "前回指摘事項の是正確認を行った。",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
  },
];
