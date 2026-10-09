import { Repeat2 } from "lucide-react";
import { EmptyState } from "../components/EmptyState";

export function ReviewPage() {
  return (
    <EmptyState icon={Repeat2} title="还没有要复习的内容">
      学完一课后，这一课的句子和单词会进入复习。到期的内容每天出现在这里。
    </EmptyState>
  );
}
