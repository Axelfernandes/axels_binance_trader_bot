export default function PolymarketsPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="p-8 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                    Polymarkets
                </h1>
                <p className="text-slate-500">Decentralized information markets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
                <div className="h-64 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
            </div>

            <div className="h-64 rounded-2xl bg-white/40 border border-white/50 flex items-center justify-center text-slate-400">
                Market Data Feed Placeholder
            </div>
        </div>
    );
}
