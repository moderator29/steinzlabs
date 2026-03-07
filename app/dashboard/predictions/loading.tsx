export default function PredictionsLoading() {
  return (
    <div className="min-h-screen bg-[#0B0D14] text-white p-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-white/10 animate-pulse" />
        <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass rounded-xl p-3 border border-white/10">
            <div className="h-3 w-12 rounded bg-white/5 animate-pulse mb-2" />
            <div className="h-5 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-[200px] rounded-lg bg-white/5 animate-pulse mb-3" />
            <div className="flex justify-between">
              <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
