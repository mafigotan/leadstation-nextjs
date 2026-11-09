import { NewPageForm } from "./new-page-form";

export const metadata = { title: "새 프로모션 페이지 | LEADstation" };

export default function NewPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">새 프로모션 페이지</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">상품 정보를 입력하면 AI가 랜딩 페이지 문구를 만들어줘요. 만든 뒤에 직접 수정할 수 있어요.</p>
      <NewPageForm />
    </div>
  );
}
