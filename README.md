# ARIA — Adaptive Rescue Intelligence Agent

An intelligent pathfinding agent that finds optimal rescue routes 
in real-world disaster scenarios using AI search algorithms.

![ARIA]
<img width="725" height="205" alt="image" src="https://github.com/user-attachments/assets/5796d3d4-57d7-4e6b-91c0-346843aef454" />

---

## What it does

ARIA acts as an autonomous agent that perceives a disaster-affected 
map, selects the best pathfinding algorithm based on terrain 
conditions, and animates the rescue route in real time. If a road 
gets blocked mid-route, ARIA detects it and reroutes automatically.

---

## Algorithms

- **A\*** — optimal pathfinding using f(n) = g(n) + h(n)
- **Greedy Best-First** — fast routing on open terrain
- **Dijkstra** — handles weighted road costs
- **BFS** — uniform cost exploration

The agent selects the algorithm automatically based on obstacle 
density — no manual input needed.

---

## Scenarios

- Disaster Relief
- Village Medical Emergency  
- Town Ambulance
- Warehouse Robot
- Campus Navigation
- Factory Fire Evacuation

---

## Tech Stack

- React + Vite
- Leaflet.js + OpenStreetMap
- JavaScript (algorithms from scratch)

---

## Run locally
```bash
git clone https://github.com/YOURUSERNAME/SmartRoute.git
cd SmartRoute
npm install
npm run dev
```

Open `http://localhost:3000`

---
