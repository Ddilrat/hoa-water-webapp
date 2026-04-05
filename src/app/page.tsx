export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HOA Water Dashboard</h1>
        <p className="text-gray-500 mb-8">Rachio irrigation monitoring</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/controllers"
            className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Controllers</h2>
            <p className="text-gray-500 text-sm">Manage your Rachio controllers and API keys</p>
          </a>

          <a
            href="/events"
            className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Zone Events</h2>
            <p className="text-gray-500 text-sm">View watering history and fetch new data from Rachio</p>
          </a>

          <a
            href="/logs"
            className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Application Logs</h2>
            <p className="text-gray-500 text-sm">View API activity, fetch history, and errors</p>
          </a>
        </div>
      </div>
    </main>
  );
}
