
import React, { useEffect, useRef } from 'react';
import { CommandType, CommandParams } from '../types';

interface LogEntry {
  id: number;
  timestamp: string;
  type: CommandType;
  details: string;
}

interface CommandLogProps {
  logs: LogEntry[];
}

const CommandLog: React.FC<CommandLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full mt-4 bg-black/40 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-48">
      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400 font-bold tracking-wider">MÔ PHỎNG ANDROID INTENT</span>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
        </div>
      </div>
      <div className="p-3 overflow-y-auto font-mono text-xs space-y-2 flex-1">
        {logs.length === 0 && (
            <div className="text-slate-600 italic text-center mt-4">Đang chờ lệnh hệ thống...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2">
            <span className="text-slate-500">[{log.timestamp}]</span>
            <span className={`${getColorByType(log.type)}`}>
              {log.type.toUpperCase()}
            </span>
            <span className="text-slate-300 break-all">
              {`>> ${log.details}`}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

const getColorByType = (type: CommandType) => {
  switch (type) {
    case CommandType.OPEN_APP: return 'text-purple-400';
    case CommandType.TOGGLE_WIFI: return 'text-blue-400';
    case CommandType.SET_TIMER: return 'text-orange-400';
    case CommandType.CHAT: return 'text-emerald-400';
    default: return 'text-slate-400';
  }
};

export default CommandLog;
