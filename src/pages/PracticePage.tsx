import { Mic } from "lucide-react";
import { EmptyState } from "../components/EmptyState";

export function PracticePage() {
  return (
    <EmptyState icon={Mic} title="还没有可以练习的句子">
      学过的句子会出现在这里，随时可以挑一句听原声、录下自己的声音来对比。
    </EmptyState>
  );
}
