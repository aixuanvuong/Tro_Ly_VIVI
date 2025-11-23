import React from 'react';

interface VisualizerProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
}

const Visualizer: React.FC<VisualizerProps> = ({ state }) => {
  const getBars = () => {
    if (state === 'idle') return <div className="w-4 h-4 bg-slate-500 rounded-full opacity-50" />;
    
    if (state === 'processing') {
      return (
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      );
    }

    // Listening or Speaking animation
    const color = state === 'listening' ? 'bg-emerald-400' : 'bg-blue-400';
    return (
      <div className="flex items-center gap-1.5 h-16">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-2 rounded-full ${color} animate-wave`}
            style={{
              animationDelay: `${i * 0.1}s`,
              animationDuration: state === 'speaking' ? '0.8s' : '1.2s'
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center w-full h-32 my-4 transition-all duration-500">
      <div className={`relative flex items-center justify-center w-32 h-32 rounded-full ${state === 'listening' ? 'bg-emerald-500/10 ring-4 ring-emerald-500/20' : state === 'processing' ? 'bg-blue-500/10 ring-4 ring-blue-500/20' : 'bg-slate-800/50'}`}>
        {getBars()}
      </div>
    </div>
  );
};

export default Visualizer;