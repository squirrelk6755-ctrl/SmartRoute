import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Rectangle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Settings2, 
  Activity, 
  Info, 
  Navigation, 
  Map as MapIcon,
  Zap,
  Clock,
  Route
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface Point {
  x: number;
  y: number;
}

interface Scenario {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  description: string;
  start: Point;
  end: Point;
  obstacles: Point[];
}

interface PathResult {
  path: Point[];
  visited: Point[];
  time: number;
  nodes: number;
  distanceKm?: number;
}

interface AlgoState {
  animatingVisited: Point[];
  animatingPath: Point[];
  liveNodes: number;
  isFinished: boolean;
}

interface ComparisonResult {
  astar: PathResult;
  bfs: PathResult;
  dijkstra: PathResult;
  greedy: PathResult;
}

interface LogEntry {
  text: string;
  timestamp: number;
}

// --- Components ---

const GRID_SIZE = 20;

const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [obstacles, setObstacles] = useState<Point[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [finalResults, setFinalResults] = useState<ComparisonResult | null>(null);
  
  const [astarState, setAstarState] = useState<AlgoState>({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
  const [bfsState, setBfsState] = useState<AlgoState>({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
  const [dijkstraState, setDijkstraState] = useState<AlgoState>({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
  const [greedyState, setGreedyState] = useState<AlgoState>({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });

  const [mode, setMode] = useState<'start' | 'end' | 'obstacle' | 'block'>('obstacle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentSelectedAlgo, setAgentSelectedAlgo] = useState<string>("astar");
  const [reroutedPath, setReroutedPath] = useState<Point[]>([]);
  const [isDisasterSimulating, setIsDisasterSimulating] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(res => res.json())
      .then(data => {
        setScenarios(data);
        loadScenario(data[0]);
      });
  }, []);

  const loadScenario = (s: Scenario) => {
    setCurrentScenario(s);
    setStart(s.start);
    setEnd(s.end);
    setObstacles(s.obstacles);
    resetVisualization();
  };

  const resetVisualization = () => {
    setAstarState({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
    setBfsState({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
    setDijkstraState({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
    setGreedyState({ animatingVisited: [], animatingPath: [], liveNodes: 0, isFinished: false });
    setResults(null);
    setFinalResults(null);
    setIsRunning(false);
    setLogs([]);
    setReroutedPath([]);
  };

  const addLog = (text: string) => {
    setLogs(prev => [...prev, { text, timestamp: Date.now() }]);
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const animateAlgo = async (
    data: PathResult, 
    setState: React.Dispatch<React.SetStateAction<AlgoState>>,
    speed: number,
    isAgentSelected: boolean = false
  ) => {
    const visited = data.visited;
    const step = Math.ceil(speed / 5);
    
    for (let i = 0; i < visited.length; i += step) {
      const currentVisited = visited.slice(0, i);
      setState(prev => ({ ...prev, animatingVisited: currentVisited, liveNodes: currentVisited.length }));
      if (isAgentSelected) {
        // Update log with live node count occasionally
        if (i % (step * 5) === 0) {
          setLogs(prev => {
            const last = prev[prev.length - 1];
            if (last && last.text.includes("Exploring...")) {
              return [...prev.slice(0, -1), { text: `[ARIA] Exploring... ${currentVisited.length} nodes explored`, timestamp: Date.now() }];
            }
            return [...prev, { text: `[ARIA] Exploring... ${currentVisited.length} nodes explored`, timestamp: Date.now() }];
          });
        }
      }
      await new Promise(r => setTimeout(r, 100 - speed));
    }
    setState(prev => ({ ...prev, animatingVisited: visited, liveNodes: visited.length }));

    const path = data.path;
    for (let i = 0; i < path.length; i++) {
      setState(prev => ({ ...prev, animatingPath: path.slice(0, i) }));
      await new Promise(r => setTimeout(r, 30));
    }
    setState(prev => ({ ...prev, animatingPath: path, isFinished: true }));
  };

  const handleRun = async (isReroute: boolean = false, newObstacles?: Point[]) => {
    if (!start || !end) return;
    setIsRunning(true);
    if (!isReroute) {
      resetVisualization();
    } else {
      setReroutedPath([]);
    }

    const currentObstacles = newObstacles || obstacles;

    const selectedAlgo = isReroute ? agentSelectedAlgo : (() => {
      let s = "astar";
      if (currentScenario?.id === 'disaster') s = "astar";
      else if (currentScenario?.id === 'village') s = "greedy";
      else if (currentScenario?.id === 'warehouse') s = "astar";
      else if (currentScenario?.id === 'campus') s = "bfs";
      else if (currentScenario?.id === 'ambulance') s = "astar";
      return s;
    })();

    if (isReroute) {
      addLog("[ARIA] Obstacle detected on active route!");
      await delay(500);
      addLog("[ARIA] Recalculating path...");
      await delay(500);
    } else {
      addLog("[ARIA] Initializing agent...");
      await delay(600);
      addLog("[ARIA] Perceiving environment... scanning for obstacles");
      await delay(800);
      addLog(`[ARIA] Found ${currentObstacles.length} blocked cells in scenario: ${currentScenario?.name}`);
      await delay(600);
      addLog(`[ARIA] Goal detected at position [${end.y}, ${end.x}]`);
      await delay(600);

      const density = (currentObstacles.length / (GRID_SIZE * GRID_SIZE)) * 100;
      addLog(`[ARIA] Selecting algorithm... obstacle density = ${density.toFixed(1)}%`);
      await delay(800);

      if (density < 20 && selectedAlgo === 'bfs') {
        addLog("[ARIA] Low obstacle density — BFS sufficient for this terrain");
      } else if (selectedAlgo === 'astar') {
        addLog(`[ARIA] High density detected — running A* with heuristic`);
      } else {
        addLog(`[ARIA] Terrain analysis complete — running ${selectedAlgo.toUpperCase()}`);
      }
      setAgentSelectedAlgo(selectedAlgo);
      await delay(600);
      addLog("[ARIA] Exploring...");
    }

    const res = await fetch('/api/pathfind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, obstacles: currentObstacles, zoom: currentScenario?.zoom || 14 })
    });
    const data: ComparisonResult = await res.json();
    setResults(data);

    const selectedData = data[selectedAlgo as keyof ComparisonResult];

    if (isReroute) {
      // For reroute, we just animate the path quickly
      setReroutedPath(selectedData.path);
      addLog("[ARIA] New route found. Rerouting complete.");
    } else {
      // Run animations simultaneously
      await Promise.all([
        animateAlgo(data.astar, setAstarState, speed, selectedAlgo === 'astar'),
        animateAlgo(data.bfs, setBfsState, speed, selectedAlgo === 'bfs'),
        animateAlgo(data.dijkstra, setDijkstraState, speed, selectedAlgo === 'dijkstra'),
        animateAlgo(data.greedy, setGreedyState, speed, selectedAlgo === 'greedy')
      ]);

      const density = (currentObstacles.length / (GRID_SIZE * GRID_SIZE)) * 100;
      if (selectedAlgo === 'bfs' && density < 20) {
        addLog(`[ARIA] BFS selected for low-density terrain — completed in ${selectedData.time}ms`);
      } else if (selectedAlgo === 'astar') {
        addLog(`[ARIA] High efficiency terrain — A* selected`);
        await delay(600);
        const efficiency = Math.round(((data.bfs.nodes - data.astar.nodes) / data.bfs.nodes) * 100);
        addLog(`[ARIA] A* explored ${data.astar.nodes} nodes vs BFS ${data.bfs.nodes} — ${efficiency}% more efficient`);
      } else {
        addLog(`[ARIA] Path found in ${selectedData.time}ms — ${selectedData.nodes} nodes explored`);
      }
      
      await delay(600);
      addLog("[ARIA] Optimal route selected. Animating rescue path...");
      await delay(600);
      addLog("[ARIA] Mission complete.");
    }

    setFinalResults(data);
    setIsRunning(false);
  };

  const toggleObstacle = (p: Point) => {
    if (mode === 'start') {
      setStart(p);
      setMode('obstacle');
    } else if (mode === 'end') {
      setEnd(p);
      setMode('obstacle');
    } else if (mode === 'block') {
      // Check if clicked point is on the current path
      const currentState = (window as any).currentAlgoState || astarState; // Fallback to astarState
      const activeState = 
        agentSelectedAlgo === 'astar' ? astarState :
        agentSelectedAlgo === 'bfs' ? bfsState :
        agentSelectedAlgo === 'dijkstra' ? dijkstraState : greedyState;

      const isOnPath = activeState.animatingPath.some(pt => pt.x === p.x && pt.y === p.y);
      if (isOnPath) {
        const newObstacles = [...obstacles, p];
        setObstacles(newObstacles);
        handleRun(true, newObstacles);
      }
    } else {
      const exists = obstacles.find(o => o.x === p.x && o.y === p.y);
      if (exists) {
        setObstacles(obstacles.filter(o => o.x !== p.x || o.y !== p.y));
      } else {
        setObstacles([...obstacles, p]);
      }
    }
  };

  const handleLiveDisaster = async () => {
    if (isRunning || isDisasterSimulating || !start || !end) return;
    setIsDisasterSimulating(true);
    
    // First, make sure we have a path
    if (!finalResults) {
      await handleRun(false);
    }

    let currentObstacles = [...obstacles];
    
    for (let i = 0; i < 3; i++) {
      await delay(3000);
      
      const activeState = 
        agentSelectedAlgo === 'astar' ? astarState :
        agentSelectedAlgo === 'bfs' ? bfsState :
        agentSelectedAlgo === 'dijkstra' ? dijkstraState : greedyState;
      
      const path = activeState.animatingPath;
      if (path.length <= 4) break; // Too short to block effectively

      // Pick a random cell on the path (not too close to start or end)
      const randomIndex = Math.floor(Math.random() * (path.length - 6)) + 3;
      const blockPoint = path[randomIndex];
      
      currentObstacles = [...currentObstacles, blockPoint];
      setObstacles(currentObstacles);
      
      addLog(`[ARIA] WARNING: Road blocked at [${blockPoint.y}, ${blockPoint.x}]!`);
      await delay(800);
      addLog("[ARIA] Recalculating optimal path...");
      await delay(500);
      
      const res = await fetch('/api/pathfind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, obstacles: currentObstacles, zoom: currentScenario?.zoom || 14 })
      });
      const data: ComparisonResult = await res.json();
      setResults(data);
      const selectedData = data[agentSelectedAlgo as keyof ComparisonResult];
      
      // Update the active state's path for the next iteration
      const setState = 
        agentSelectedAlgo === 'astar' ? setAstarState :
        agentSelectedAlgo === 'bfs' ? setBfsState :
        agentSelectedAlgo === 'dijkstra' ? setDijkstraState : setGreedyState;
      
      setState(prev => ({ ...prev, animatingPath: selectedData.path }));
      setReroutedPath(selectedData.path);
      
      addLog("[ARIA] New route found. Adapting...");
    }
    
    setIsDisasterSimulating(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white font-sans selection:bg-[#7eb8f7]/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f0f1a]/80 backdrop-blur-md relative z-[1000]">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7eb8f7] to-[#4a90e2] flex items-center justify-center shadow-lg shadow-[#7eb8f7]/20">
              <Navigation className="w-6 h-6 text-[#0f0f1a]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SmartRoute</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#7eb8f7] font-semibold">AI Pathfinding Engine</p>
            </div>
          </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <div className="w-2 h-2 rounded-full bg-[#7eb8f7] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Agent selected: {agentSelectedAlgo === 'astar' ? 'A*' : agentSelectedAlgo.toUpperCase()}
                </span>
              </div>
              <select 
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#7eb8f7] transition-colors cursor-pointer"
                onChange={(e) => loadScenario(scenarios.find(s => s.id === e.target.value)!)}
                value={currentScenario?.id}
              >
                {scenarios.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#0f0f1a]">{s.name}</option>
                ))}
              </select>
              <button 
                onClick={() => handleRun(false)}
                disabled={isRunning || isDisasterSimulating}
                className="bg-[#7eb8f7] hover:bg-[#9cc9f9] disabled:opacity-50 text-[#0f0f1a] font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-[#7eb8f7]/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                Run SmartRoute
              </button>
              <button 
                onClick={handleLiveDisaster}
                disabled={isRunning || isDisasterSimulating}
                className="bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
              >
                <Zap className="w-4 h-4 fill-current" />
                Simulate Live Disaster
              </button>
            </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Main Map Grid */}
        <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-black/20 shadow-2xl h-[600px] flex flex-col">
          <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7eb8f7]">
              Agent Visualization: {agentSelectedAlgo === 'astar' ? 'A*' : agentSelectedAlgo.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-[#7eb8f7]">
              {
                agentSelectedAlgo === 'astar' ? astarState.liveNodes :
                agentSelectedAlgo === 'bfs' ? bfsState.liveNodes :
                agentSelectedAlgo === 'dijkstra' ? dijkstraState.liveNodes : greedyState.liveNodes
              } nodes explored
            </span>
          </div>
          <div className="relative flex-1">
            <MapContainer 
              center={currentScenario?.center || [20, 78]} 
              zoom={currentScenario?.zoom || 13} 
              className="w-full h-full grayscale invert opacity-20"
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController center={currentScenario?.center || [20, 78]} zoom={currentScenario?.zoom || 13} />
            </MapContainer>

            {/* Grid Overlay */}
            <div className="absolute inset-0 z-[400] grid grid-cols-20 grid-rows-20 pointer-events-none">
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                const x = i % GRID_SIZE;
                const y = Math.floor(i / GRID_SIZE);
                const isObstacle = obstacles.find(o => o.x === x && o.y === y);
                const isStart = start?.x === x && start?.y === y;
                const isEnd = end?.x === x && end?.y === y;
                
                const activeState = 
                  agentSelectedAlgo === 'astar' ? astarState :
                  agentSelectedAlgo === 'bfs' ? bfsState :
                  agentSelectedAlgo === 'dijkstra' ? dijkstraState : greedyState;

                const isVisited = activeState.animatingVisited.find(v => v.x === x && v.y === y);
                const isPath = activeState.animatingPath.find(p => p.x === x && p.y === y);
                const isReroute = reroutedPath.find(p => p.x === x && p.y === y);
                
                // Frontier logic: nodes that were visited very recently
                const visitedIndex = activeState.animatingVisited.findIndex(v => v.x === x && v.y === y);
                const isFrontier = visitedIndex >= activeState.animatingVisited.length - 5 && visitedIndex !== -1;

                return (
                  <div 
                    key={i}
                    onClick={() => toggleObstacle({ x, y })}
                    className={cn(
                      "border-[0.5px] border-white/5 pointer-events-auto cursor-crosshair transition-all duration-300",
                      isObstacle && "bg-white/20 backdrop-blur-sm",
                      isStart && "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10",
                      isEnd && "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] z-10",
                      isVisited && !isPath && !isStart && !isEnd && "bg-blue-500/30",
                      isFrontier && !isPath && !isStart && !isEnd && "bg-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.5)]",
                      isPath && !isStart && !isEnd && "bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20",
                      isReroute && !isStart && !isEnd && "bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.8)] z-30"
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Agent Decision Log Panel */}
        <div className="bg-black border border-white/10 rounded-2xl overflow-hidden flex flex-col h-48 shadow-2xl">
          <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">ARIA Decision Log</span>
            </div>
            <span className="text-[10px] font-mono text-white/20">v2.0.4-agent-core</span>
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto scrollbar-hide space-y-1">
            <AnimatePresence initial={false}>
              {logs.map((log, i) => (
                <motion.div 
                  key={log.timestamp + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-500/80"
                >
                  <span className="text-emerald-500/30 mr-2">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  {log.text}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Stats Bar (Comparison) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-x-auto scrollbar-hide">
          <div className="flex flex-row items-center justify-around gap-8 min-w-[850px] xl:min-w-0">
            {[
              { name: 'A* (Heuristic)', key: 'astar', color: 'bg-[#7eb8f7]' },
              { name: 'Dijkstra', key: 'dijkstra', color: 'bg-indigo-500' },
              { name: 'BFS', key: 'bfs', color: 'bg-emerald-500' },
              { name: 'Greedy', key: 'greedy', color: 'bg-amber-500' }
            ].map((algo) => {
              const val = finalResults?.[algo.key as keyof ComparisonResult]?.nodes || 0;
              const max = Math.max(
                finalResults?.astar.nodes || 1, 
                finalResults?.bfs.nodes || 1, 
                finalResults?.dijkstra.nodes || 1,
                finalResults?.greedy.nodes || 1
              );
              const width = finalResults ? (val / max) * 100 : 0;

              return (
                <div key={algo.key} className="flex-1 min-w-[180px] space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">{algo.name}</span>
                    <span className="text-xl font-mono font-bold text-white">{val} <span className="text-[10px] text-white/20 uppercase">nodes</span></span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      className={cn("h-full rounded-full transition-all duration-500", algo.color)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Controls Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50">Animation Speed</label>
                  <span className="text-xs font-mono text-[#7eb8f7]">{speed}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" max="100" 
                  value={speed} 
                  onChange={(e) => setSpeed(parseInt(e.target.value))}
                  className="w-full accent-[#7eb8f7]"
                />
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-around">
                <button 
                  onClick={() => setMode('start')}
                  className={cn("p-2 rounded-lg transition-all", mode === 'start' ? "bg-emerald-500/20 text-emerald-500" : "text-white/40 hover:text-white")}
                  title="Set Start Point"
                >
                  <Navigation className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setMode('end')}
                  className={cn("p-2 rounded-lg transition-all", mode === 'end' ? "bg-rose-500/20 text-rose-500" : "text-white/40 hover:text-white")}
                  title="Set End Point"
                >
                  <MapIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setMode('obstacle')}
                  className={cn("p-2 rounded-lg transition-all", mode === 'obstacle' ? "bg-white/20 text-white" : "text-white/40 hover:text-white")}
                  title="Draw Obstacles"
                >
                  <Settings2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setMode('block')}
                  className={cn("p-2 rounded-lg transition-all", mode === 'block' ? "bg-orange-500/20 text-orange-500" : "text-white/40 hover:text-white")}
                  title="Block a Road"
                >
                  <Zap className="w-5 h-5" />
                </button>
                <div className="w-px h-8 bg-white/10" />
                <button 
                  onClick={() => {
                    setObstacles([]);
                    resetVisualization();
                  }}
                  className="p-2 text-white/40 hover:text-rose-400 transition-all"
                  title="Clear All"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Start</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">End</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Obstacle</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500/30" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Visited</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-cyan-400/50 shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Frontier</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Optimal Path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Rerouted Path</span>
              </div>
            </div>
          </div>

          {/* Right: Performance Metrics */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Performance Metrics
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Nodes Explored</span>
                </div>
                <div className="text-2xl font-mono font-bold text-[#7eb8f7]">
                  {
                    agentSelectedAlgo === 'astar' ? astarState.liveNodes :
                    agentSelectedAlgo === 'bfs' ? bfsState.liveNodes :
                    agentSelectedAlgo === 'dijkstra' ? dijkstraState.liveNodes : greedyState.liveNodes
                  }
                </div>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Execution Time</span>
                </div>
                <div className="text-2xl font-mono font-bold text-[#7eb8f7]">
                  {results?.[agentSelectedAlgo as keyof ComparisonResult]?.time || 0}<span className="text-xs ml-1 opacity-50">ms</span>
                </div>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 col-span-2">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <Route className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Real Distance</span>
                </div>
                <div className="text-2xl font-mono font-bold text-[#7eb8f7]">
                  {results?.[agentSelectedAlgo as keyof ComparisonResult]?.distanceKm || 0}<span className="text-xs ml-1 opacity-50">km</span>
                </div>
              </div>
            </div>

            {/* Scenario Info */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Info className="w-4 h-4 text-[#7eb8f7]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white/80">{currentScenario?.name}</h4>
                  <p className="text-xs text-white/40 mt-1 leading-relaxed">
                    {currentScenario?.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto px-6 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-white/20 text-[10px] font-bold uppercase tracking-widest">
        <p>© 2026 SmartRoute Engine</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-[#7eb8f7] transition-colors">Documentation</a>
          <a href="#" className="hover:text-[#7eb8f7] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#7eb8f7] transition-colors">Github</a>
        </div>
      </footer>
    </div>
  );
}
