export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <div className="text-lg font-semibold text-neutral-900">오프라인 상태입니다</div>
      <p className="mt-2 text-sm text-neutral-600">
        네트워크가 복구되면 자동으로 다시 연결됩니다.
      </p>
    </div>
  );
}
