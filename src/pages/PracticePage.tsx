import { Mic } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "../components/EmptyState";

export function PracticePage() {
  return (
    <EmptyState
      icon={Mic}
      title="自由跟读即将开放"
      action={
        <Link to="/courses" className="btn btn-primary">
          去课程里跟读
        </Link>
      }
    >
      现在可以在上课时跟读：每一句下面的播放条都能录下自己的声音，和原声对比着听。
    </EmptyState>
  );
}
