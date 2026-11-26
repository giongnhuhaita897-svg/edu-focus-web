import { Suspense } from "react";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";

export default function WebcamPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <WebcamPlaceholder />
    </Suspense>
  );
}