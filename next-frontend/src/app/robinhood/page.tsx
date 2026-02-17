export default function RobinhoodPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="p-8 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-600 bg-clip-text text-transparent mb-2">
                    Robinhood Connect
                </h1>
                <p className="text-slate-500">Equity and crypto portfolio management.</p>
            </div>

            <div className="h-32 rounded-2xl bg-white/40 border border-white/50 flex items-center justify-center text-slate-400">
                Portfolio Summary
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-40 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
                ))}
            </div>
        </div>
    );
}
