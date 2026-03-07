export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0B0D14] text-white">
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
            <div className="w-16 h-4 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="w-10 h-5 rounded bg-white/10 animate-pulse" />
        </div>
      </div>

      <div className="pt-[104px] px-3">
        <div className="flex gap-1 mb-4 bg-[#111827] p-1.5 rounded-xl max-w-sm mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-8 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-white/5 animate-pulse mb-2" />
              <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 w-full glass backdrop-blur-xl border-t border-white/10 z-50">
        <div className="grid grid-cols-6 gap-0 px-1 py-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
              <div className="w-8 h-2 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
