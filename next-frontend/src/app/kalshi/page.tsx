export default function KalshiPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="p-8 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                    Kalshi Integration
                </h1>
                <p className="text-slate-500">Event contracts and prediction markets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
                ))}
            </div>

            <div className="h-96 rounded-2xl bg-white/40 border border-white/50 flex items-center justify-center text-slate-400">
                Future Integration Area
            </div>
        </div>
    );
}
