import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Pathfinding Algorithms ---

  interface Point {
    x: number;
    y: number;
  }

  interface Node extends Point {
    g: number;
    h: number;
    f: number;
    parent: Node | null;
  }

  const getDistance = (a: Point, b: Point, useHeuristic: boolean = true) => {
    if (!useHeuristic) return 0;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx + dy) * 1.001; // Tiny tie-breaker to make A* more efficient and distinct from Dijkstra
  };

  function astar(start: Point, end: Point, obstacles: Point[], width: number, height: number, useHeuristic: boolean = true) {
    const openList: Node[] = [];
    const closedList: Set<string> = new Set();
    const obstacleSet = new Set(obstacles.map(p => `${p.x},${p.y}`));
    const visitedNodes: Point[] = [];

    const startNode: Node = { ...start, g: 0, h: getDistance(start, end, useHeuristic), f: 0, parent: null };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      visitedNodes.push({ x: current.x, y: current.y });

      if (current.x === end.x && current.y === end.y) {
        const path: Point[] = [];
        let temp: Node | null = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return { path: path.reverse(), visited: visitedNodes };
      }

      closedList.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x < 0 || neighbor.x >= width ||
          neighbor.y < 0 || neighbor.y >= height ||
          obstacleSet.has(`${neighbor.x},${neighbor.y}`) ||
          closedList.has(`${neighbor.x},${neighbor.y}`)
        ) continue;

        const gScore = current.g + 1;
        let neighborNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

        if (!neighborNode) {
          neighborNode = {
            ...neighbor,
            g: gScore,
            h: getDistance(neighbor, end, useHeuristic),
            f: 0,
            parent: current
          };
          neighborNode.f = neighborNode.g + neighborNode.h;
          openList.push(neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.g = gScore;
          neighborNode.f = neighborNode.g + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }
    return { path: [], visited: visitedNodes };
  }

  function bfs(start: Point, end: Point, obstacles: Point[], width: number, height: number) {
    const queue: Node[] = [{ ...start, g: 0, h: 0, f: 0, parent: null }];
    const visited = new Set<string>();
    const obstacleSet = new Set(obstacles.map(p => `${p.x},${p.y}`));
    const visitedNodes: Point[] = [];

    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedNodes.push({ x: current.x, y: current.y });

      if (current.x === end.x && current.y === end.y) {
        const path: Point[] = [];
        let temp: Node | null = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return { path: path.reverse(), visited: visitedNodes };
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (
          neighbor.x < 0 || neighbor.x >= width ||
          neighbor.y < 0 || neighbor.y >= height ||
          obstacleSet.has(key) ||
          visited.has(key)
        ) continue;

        visited.add(key);
        queue.push({ ...neighbor, g: current.g + 1, h: 0, f: 0, parent: current });
      }
    }
    return { path: [], visited: visitedNodes };
  }

  function greedy(start: Point, end: Point, obstacles: Point[], width: number, height: number) {
    const openList: Node[] = [];
    const closedList: Set<string> = new Set();
    const obstacleSet = new Set(obstacles.map(p => `${p.x},${p.y}`));
    const visitedNodes: Point[] = [];

    const startNode: Node = { ...start, g: 0, h: getDistance(start, end, true), f: 0, parent: null };
    startNode.f = startNode.h; // Greedy only uses heuristic
    openList.push(startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      visitedNodes.push({ x: current.x, y: current.y });

      if (current.x === end.x && current.y === end.y) {
        const path: Point[] = [];
        let temp: Node | null = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return { path: path.reverse(), visited: visitedNodes };
      }

      closedList.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x < 0 || neighbor.x >= width ||
          neighbor.y < 0 || neighbor.y >= height ||
          obstacleSet.has(`${neighbor.x},${neighbor.y}`) ||
          closedList.has(`${neighbor.x},${neighbor.y}`)
        ) continue;

        if (!openList.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
          const neighborNode: Node = {
            ...neighbor,
            g: 0,
            h: getDistance(neighbor, end, true),
            f: 0,
            parent: current
          };
          neighborNode.f = neighborNode.h;
          openList.push(neighborNode);
        }
      }
    }
    return { path: [], visited: visitedNodes };
  }

  // Haversine formula for real-world distance
  function calculateHaversineDistance(path: Point[], center: [number, number], zoom: number) {
    if (path.length < 2) return 0;
    
    // Approximate scale: at zoom 14, 1 unit is roughly 0.5km
    // This is a simplification for the simulation
    const scale = 0.5 * Math.pow(2, 14 - zoom);
    return parseFloat((path.length * scale).toFixed(2));
  }

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/scenarios", (req, res) => {
    const scenarios = [
      {
        id: "village",
        name: "Village Medical Emergency",
        center: [20.5937, 78.9629],
        zoom: 13,
        description: "Dirt road map, hospital 8km away, one road flooded.",
        start: { x: 2, y: 2 },
        end: { x: 18, y: 18 },
        obstacles: [
          { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 },
          { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }
        ]
      },
      {
        id: "ambulance",
        name: "Town Ambulance",
        center: [28.6139, 77.2090],
        zoom: 14,
        description: "Busy market town, peak hour traffic blocks.",
        start: { x: 0, y: 0 },
        end: { x: 19, y: 19 },
        obstacles: Array.from({ length: 10 }, (_, i) => ({ x: 8, y: i + 5 }))
      },
      {
        id: "delivery",
        name: "City Delivery Fleet",
        center: [19.0760, 72.8777],
        zoom: 15,
        description: "Grid city, 5 delivery points, find optimal route.",
        start: { x: 1, y: 1 },
        end: { x: 15, y: 15 },
        obstacles: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }]
      },
      {
        id: "warehouse",
        name: "Warehouse Robot",
        center: [12.9716, 77.5946],
        zoom: 18,
        description: "20x20 grid, shelves as walls.",
        start: { x: 0, y: 0 },
        end: { x: 19, y: 19 },
        obstacles: [
          { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
          { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }
        ]
      },
      {
        id: "disaster",
        name: "Disaster Relief",
        center: [27.7172, 85.3240],
        zoom: 14,
        description: "Earthquake zone, 40% roads blocked randomly.",
        start: { x: 0, y: 0 },
        end: { x: 19, y: 19 },
        obstacles: Array.from({ length: 50 }, () => ({
          x: Math.floor(Math.random() * 20),
          y: Math.floor(Math.random() * 20)
        }))
      },
      {
        id: "campus",
        name: "Campus Navigation",
        center: [13.0827, 80.2707],
        zoom: 16,
        description: "University map, find accessible route.",
        start: { x: 3, y: 3 },
        end: { x: 16, y: 16 },
        obstacles: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 11, y: 10 }]
      }
    ];
    res.json(scenarios);
  });

  app.post("/api/pathfind", (req, res) => {
    const { start, end, obstacles, width = 20, height = 20, zoom = 14 } = req.body;

    // A* with heuristic
    const startTimeA = performance.now();
    const resultA = astar(start, end, obstacles, width, height, true);
    const timeA = parseFloat((performance.now() - startTimeA).toFixed(4));

    // BFS (Flood Fill)
    const startTimeB = performance.now();
    const resultB = bfs(start, end, obstacles, width, height);
    const timeB = parseFloat((performance.now() - startTimeB).toFixed(4));

    // Dijkstra (A* with h=0)
    const startTimeD = performance.now();
    const resultD = astar(start, end, obstacles, width, height, false);
    const timeD = parseFloat((performance.now() - startTimeD).toFixed(4));

    // Greedy Best-First
    const startTimeG = performance.now();
    const resultG = greedy(start, end, obstacles, width, height);
    const timeG = parseFloat((performance.now() - startTimeG).toFixed(4));

    const distanceKm = calculateHaversineDistance(resultA.path, [0, 0], zoom);

    res.json({
      astar: { ...resultA, time: timeA, nodes: resultA.visited.length, distanceKm },
      bfs: { ...resultB, time: timeB, nodes: resultB.visited.length, distanceKm },
      dijkstra: { ...resultD, time: timeD, nodes: resultD.visited.length, distanceKm },
      greedy: { ...resultG, time: timeG, nodes: resultG.visited.length, distanceKm }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
