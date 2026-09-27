import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Brain, AlertTriangle, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, AreaChart, Area } from 'recharts';

const FlameNode = ({ node, totalCount, onClick, path = [] }: { node: any, totalCount: number, onClick: (name: string) => void, path?: string[] }) => {
  const currentPath = [...path, node.name];
  const widthPct = (node.count / totalCount) * 100;
  if (widthPct < 1.5) return null; // Prune tiny branches

  // Generate color based on name hash
  const hash = node.name.split('').reduce((a:number, b:string) => a + b.charCodeAt(0), 0);
  const hue = hash % 360;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: `${widthPct}%`, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
      <div 
        title={`${node.name} (${node.count} threads)`}
        style={{ 
          background: `hsl(${hue}, 60%, 35%)`, 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: 'white', 
          fontSize: '11px',
          fontWeight: 600,
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          padding: '2px 4px',
          height: '22px',
          cursor: 'pointer'
        }}
        onClick={() => onClick(`path:${currentPath.join('->')}`)}>
        {node.name} ({node.count})
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        {Array.from(node.children.values() as any[])
          .sort((a:any, b:any) => b.count - a.count)
          .map((child: any) => (
            <FlameNode key={child.name} node={child} totalCount={node.count} onClick={onClick} path={currentPath} />
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [filename, setFilename] = useState<string>('Unknown');
  const [threads, setThreads] = useState<any[]>([]);
  const [deadlocks, setDeadlocks] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showCharts, setShowCharts] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'states' | 'groups' | 'flame' | 'timeline'>('states');

  useEffect(() => {
    // VS Code passes initial data
    if ((window as any).initialData) {
      setFilename((window as any).initialData.filename || 'Unknown');
      setThreads((window as any).initialData.threads || []);
      setDeadlocks((window as any).initialData.deadlocks || []);
      setTimeline((window as any).initialData.timeline || []);
    }
  }, []);

  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      if (typeFilter === 'DAEMON' && !t.daemon) return false;
      if (typeFilter === 'APP' && t.daemon) return false;

      const s = (t.state || '').toUpperCase();
      if (stateFilter !== 'ALL') {
        if (stateFilter === 'WAITING' && !s.includes('WAITING')) return false;
        if (stateFilter !== 'WAITING' && s !== stateFilter) return false;
      }

      if (search) {
        if (search.startsWith('path:')) {
          const pathSequence = search.substring(5).split('->');
          const reversedStack = [...(t.stackTrace || [])].reverse();
          let match = true;
          // pathSequence[0] is "All Threads"
          for (let i = 1; i < pathSequence.length; i++) {
            if (i - 1 >= reversedStack.length) {
              match = false;
              break;
            }
            const cleanFrame = reversedStack[i - 1].replace(/\(.*\)/, '').trim();
            if (cleanFrame !== pathSequence[i]) {
              match = false;
              break;
            }
          }
          if (!match) return false;
        } else {
          const q = search.toLowerCase().trim();
          const matchName = (t.name || '').toLowerCase().includes(q);
          const matchId = (t.nid || '').toLowerCase().includes(q) || (t.tid || '').toLowerCase().includes(q);
          const matchLocks = (t.locksHeld || []).some((l:string) => l.toLowerCase().includes(q)) || 
                             (t.waitingOnLock || '').toLowerCase().includes(q) ||
                             (t.waitingToLock || '').toLowerCase().includes(q);
          const matchStack = (t.stackTrace || []).some((line:string) => line.toLowerCase().includes(q));
          if (!matchName && !matchId && !matchLocks && !matchStack) return false;
        }
      }
      return true;
    });
  }, [threads, search, stateFilter, typeFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredThreads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const sendCommand = (cmd: string) => {
    try {
      // @ts-ignore
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command: cmd });
    } catch (e) {
      console.log('Command sent in dev mode:', cmd);
    }
  };

  const getStats = () => {
    let runnable = 0, blocked = 0, waiting = 0;
    threads.forEach(t => {
      const s = (t.state || '').toUpperCase();
      if (s === 'RUNNABLE') runnable++;
      else if (s === 'BLOCKED') blocked++;
      else if (s.includes('WAITING')) waiting++;
    });
    return { total: threads.length, runnable, blocked, waiting };
  };

  const getGroupStats = () => {
    const groups: Record<string, number> = {};
    threads.forEach(t => {
      const name = t.name || 'Unknown';
      let prefix = name.split('-')[0];
      if (name.includes('pool')) prefix = name.split('pool')[0] + 'pool';
      if (prefix.length < 3) prefix = name.substring(0, 10);
      groups[prefix] = (groups[prefix] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 groups
  };

  const getFlameGraph = () => {
    const root = { name: 'All Threads', count: threads.length, children: new Map<string, any>() };
    threads.forEach(t => {
      let current = root;
      // Reverse to get root of stack at the bottom (traditionally main/run)
      const reversedStack = [...(t.stackTrace || [])].reverse();
      reversedStack.forEach(frame => {
        // Strip exact line numbers for better aggregation and trim whitespace
        const cleanFrame = frame.replace(/\(.*\)/, '').trim();
        let child = current.children.get(cleanFrame);
        if (!child) {
          child = { name: cleanFrame, count: 0, children: new Map<string, any>() };
          current.children.set(cleanFrame, child);
        }
        child.count++;
        current = child;
      });
    });
    return root;
  };

  const stats = getStats();
  const groupData = getGroupStats();
  const flameRoot = useMemo(() => getFlameGraph(), [threads]);

  const chartData = [
    { name: 'Runnable', value: stats.runnable, color: '#73c991' },
    { name: 'Blocked', value: stats.blocked, color: '#f14c4c' },
    { name: 'Waiting', value: stats.waiting, color: '#cca700' },
  ].filter(d => d.value > 0);


  return (
    <div className="app-container">
      <header>
        <div className="flex items-center gap-2">
          <h1>Analysis: {filename}</h1>
          <button className="secondary" onClick={() => setShowCharts(!showCharts)}>
            <BarChart2 size={16} /> {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
        </div>
        <button className="primary" onClick={() => sendCommand('runAiAnalysis')}>
          <Brain size={16} /> Run AI Analysis
        </button>
      </header>

      {showCharts && chartData.length > 0 && (
        <div className="charts-wrapper" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
          <div className="flex gap-2" style={{ marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
            <button className={`secondary ${activeChartTab === 'states' ? 'active-tab' : ''}`} style={activeChartTab === 'states' ? { background: 'rgba(255,255,255,0.1)' } : {}} onClick={() => setActiveChartTab('states')}>Thread States (Donut)</button>
            <button className={`secondary ${activeChartTab === 'groups' ? 'active-tab' : ''}`} style={activeChartTab === 'groups' ? { background: 'rgba(255,255,255,0.1)' } : {}} onClick={() => setActiveChartTab('groups')}>Thread Pools (Bar)</button>
            <button className={`secondary ${activeChartTab === 'flame' ? 'active-tab' : ''}`} style={activeChartTab === 'flame' ? { background: 'rgba(255,255,255,0.1)' } : {}} onClick={() => setActiveChartTab('flame')}>Hot Methods (Flame)</button>
            {timeline.length > 1 && (
              <button className={`secondary ${activeChartTab === 'timeline' ? 'active-tab' : ''}`} style={activeChartTab === 'timeline' ? { background: 'rgba(255,255,255,0.1)' } : {}} onClick={() => setActiveChartTab('timeline')}>Timeline (Area)</button>
            )}
          </div>
          
          <div className="charts-container" style={{ height: activeChartTab === 'flame' ? '350px' : '250px', overflowX: 'auto', overflowY: 'auto' }}>
            {activeChartTab === 'states' && (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} label>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--vscode-editor-background)', borderColor: 'var(--glass-border)', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {activeChartTab === 'groups' && (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={groupData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" stroke="var(--vscode-editor-foreground)" opacity={0.5} />
                  <YAxis dataKey="name" type="category" stroke="var(--vscode-editor-foreground)" opacity={0.8} tick={{ fontSize: 12 }} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--vscode-editor-background)', borderColor: 'var(--glass-border)', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#4daafc" radius={[0, 4, 4, 0]}>
                    {groupData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#4daafc', '#73c991', '#cca700', '#f14c4c', '#c586c0'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === 'flame' && (
              <div style={{ width: '100%', minWidth: '800px', display: 'flex', flexDirection: 'column-reverse' }}>
                <FlameNode node={flameRoot} totalCount={flameRoot.count} onClick={setSearch} />
              </div>
            )}

            {activeChartTab === 'timeline' && timeline.length > 1 && (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--vscode-editor-foreground)" opacity={0.5} tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--vscode-editor-foreground)" opacity={0.5} />
                  <Tooltip contentStyle={{ background: 'var(--vscode-editor-background)', borderColor: 'var(--glass-border)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="Runnable" stackId="1" stroke="#73c991" fill="#73c991" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Waiting" stackId="1" stroke="#cca700" fill="#cca700" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Blocked" stackId="1" stroke="#f14c4c" fill="#f14c4c" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {deadlocks.length > 0 && (
        <div className="deadlock-alert">
          <h3 className="flex items-center gap-2 text-red-500">
            <AlertTriangle /> {deadlocks.length} Deadlock(s) Detected
          </h3>
          {deadlocks.map((d, i) => (
            <div key={i} className="mt-2" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
              <strong>Cycle {i + 1}:</strong> 
              {d.cycle.map((t:any, idx:number) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button 
                    className="secondary" 
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    onClick={() => setSearch(t.name)}
                    title={`Click to focus on thread: ${t.name}`}
                  >
                    {t.name}
                  </button>
                  {idx < d.cycle.length - 1 ? ' ➔ ' : ' ➔ (loop)'}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Total Threads" value={stats.total} onClick={() => setStateFilter('ALL')} active={stateFilter === 'ALL'} />
        <StatCard label="Runnable" value={stats.runnable} color="var(--vscode-testing-iconPassed)" onClick={() => setStateFilter('RUNNABLE')} active={stateFilter === 'RUNNABLE'} />
        <StatCard label="Blocked" value={stats.blocked} color="var(--vscode-testing-iconFailed)" onClick={() => setStateFilter('BLOCKED')} active={stateFilter === 'BLOCKED'} />
        <StatCard label="Waiting" value={stats.waiting} color="var(--vscode-testing-iconQueued)" onClick={() => setStateFilter('WAITING')} active={stateFilter === 'WAITING'} />
      </div>

      <div className="controls">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search threads by name, ID, or lock..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
          <option value="ALL">All States</option>
          <option value="RUNNABLE">Runnable</option>
          <option value="BLOCKED">Blocked</option>
          <option value="WAITING">Waiting</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="ALL">All Types</option>
          <option value="DAEMON">Daemon Only</option>
          <option value="APP">App Threads (Non-Daemon)</option>
        </select>
      </div>

      <div ref={parentRef} className="thread-list">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualItem => {
            const thread = filteredThreads[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                className="virtual-row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <ThreadRow thread={thread} />
              </div>
            );
          })}
          {filteredThreads.length === 0 && <div className="no-results">No threads match your filters.</div>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, active }: any) {
  return (
    <div className={`stat-card ${active ? 'active' : ''}`} onClick={onClick} style={{ borderColor: active ? 'var(--vscode-focusBorder)' : '' }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: any }) {
  const [expanded, setExpanded] = useState(false);
  const safeState = (thread.state || 'UNKNOWN').toLowerCase();
  
  return (
    <div className={`thread-item ${expanded ? 'expanded' : ''}`}>
      <div className="thread-header" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          <span className="thread-name">{thread.name}</span>
        </div>
        <div className="thread-badges">
          {thread.daemon && <span className="badge badge-dim">DAEMON</span>}
          <span className={`badge badge-state badge-${safeState}`}>{thread.state || 'UNKNOWN'}</span>
          {thread.nid && <span className="badge badge-dim">NID: {thread.nid}</span>}
        </div>
      </div>
      
      {expanded && (
        <div className="thread-body">
          {(thread.locksHeld?.length > 0 || thread.waitingOnLock || thread.waitingToLock) && (
            <div className="locks-info">
              {thread.locksHeld?.length > 0 && <div><strong>Held Locks:</strong> {thread.locksHeld.map((l:any) => <span key={l} className="lock-id">{l}</span>)}</div>}
              {thread.waitingOnLock && <div><strong>Waiting On:</strong> <span className="lock-id">{thread.waitingOnLock}</span></div>}
              {thread.waitingToLock && <div><strong>Waiting To Lock:</strong> <span className="lock-id">{thread.waitingToLock}</span></div>}
            </div>
          )}
          {thread.stackTrace?.length > 0 ? (
            <div className="stack-trace">
              <strong>Stack Trace:</strong>
              <pre>{thread.stackTrace.join('\n')}</pre>
            </div>
          ) : (
            <div className="stack-trace" style={{ opacity: 0.6, fontStyle: 'italic', marginTop: '10px' }}>
              No stack trace available for this thread.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
