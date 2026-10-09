import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "../components/EmptyState";

export function ExamPage() {
  return (
    <EmptyState icon={ClipboardCheck} title="模拟考试即将开放">
      按融入考试的真实题型，练习口语（问答、补全句子）和阅读。学完 A1 的课程后再来试试。
    </EmptyState>
  );
}
