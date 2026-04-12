export function ComingSoon({ featureName }: { featureName: string }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h2 className="text-3xl font-bold mb-2">Coming Soon</h2>
      <p className="text-gray-400 text-lg mb-6">
        {featureName} is currently under development.
      </p>
      <p className="text-gray-600">
        We're working hard to bring you this feature. Stay tuned!
      </p>
    </div>
  );
}
