# SmartRoute — AI Pathfinding for Real-World Impact

SmartRoute is a full-stack web application that visualizes advanced pathfinding algorithms (A*, Dijkstra, BFS) in real-world scenarios. It uses Google's Gemini AI to provide natural language explanations for the chosen routes and allows users to input custom constraints.

## Features

- **Interactive Map**: Set start, end, and obstacles directly on the map.
- **Algorithm Visualization**: Watch A* explore the grid in real-time.
- **Real-World Scenarios**: 6 preset scenarios ranging from medical emergencies to warehouse robotics.
- **AI Explainer**: Gemini AI narrates why a specific path was chosen based on constraints.
- **Algorithm Comparison**: Compare performance metrics (nodes explored, time, path length) across A*, BFS, and Dijkstra.
- **Custom Constraints**: Input natural language constraints like "avoid highways" or "wheelchair accessible".

## Tech Stack

- **Frontend**: React, Tailwind CSS, Leaflet.js, Framer Motion.
- **Backend**: Node.js, Express.
- **AI**: Google Gemini 1.5 Flash.

## Setup

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set up environment variables in `.env`:
   - `GEMINI_API_KEY`: Your Google AI Studio API Key.
4. Run the development server: `npm run dev`.

## Hackathon Pitch

In critical situations—whether it's an ambulance navigating a congested city or a disaster relief team finding survivors—every second counts. Traditional pathfinding often ignores the "why" and the "context." SmartRoute bridges this gap by combining robust mathematical algorithms with Generative AI. It doesn't just find a path; it understands constraints and explains its reasoning, making complex navigation accessible and adaptable to real-world chaos.
