# PulseGrid — How to Run This Project

PulseGrid has two parts that both need to be running at the same time:
- **`backend/`** — Node/Express API + Socket.IO + BullMQ worker + cron aggregator
- **`pulsegrid-frontend/`** — Angular dashboard

It also depends on two databases running locally: **MongoDB** and **Redis**.

---

## 1. Prerequisites

Install these first if you don't have them:

- **Node.js 20+** — https://nodejs.org
- **MongoDB** running on `localhost:27017`
- **Redis** running on `localhost:6379`

### Easiest way to get Mongo + Redis running (Docker)

```bash
docker run -d --name pulsegrid-mongo -p 27017:27017 mongo
docker run -d --name pulsegrid-redis -p 6379:6379 redis
```

If you don't use Docker, install and start `mongod` and `redis-server` directly instead.

---

## 2. Unzip the project

Unzip the provided file. You should see this structure:

```
pulsegrid/
├── backend/
└── pulsegrid-frontend/
```

---

## 3. Start the backend

```bash
cd pulsegrid/backend
npm install
npm run dev
```

`npm run dev` starts **four** processes together (via `concurrently`):

| Process     | What it does                                              |
|-------------|------------------------------------------------------------|
| `SIM`       | Simulates 5 devices, pushes a random reading every 2s      |
| `WORKER`    | Processes the BullMQ queue, computes rolling CPU avg, saves to MongoDB |
| `SERVER`    | Express API + Socket.IO, listens on `http://localhost:4000` |
| `AGGREGATOR`| Cron jobs rolling raw data into 1m → 10m → 1h summaries     |

You should see all four labeled log streams printing in the same terminal. Leave this running.

> **Note:** the 1m rollup only starts populating ~60 seconds after `AGGREGATOR` starts (it runs on a "once per minute" cron schedule) — don't worry if dashboard charts look empty for the first minute.

---

## 4. Start the frontend

Open a **second terminal**:

```bash
cd pulsegrid/pulsegrid-frontend
npm install
npm start
```

This runs `ng serve`. Once it finishes compiling, open:

```
http://localhost:4200
```

---

## 5. What you should see

- The dashboard loads with 5 CPU chart widgets (one per simulated device), updating live every ~2 seconds.
- The **Fleet summary** cards at the top show device counts, online count, problem count, and average CPU.
- You can drag/resize widgets — the layout autosaves to your browser's `localStorage`.
- Click **Add widget** to add a new chart or stat widget, and pick a device, metric, type, and (for charts) an aggregation interval — **1m** (last hour), **10m** (last day), or **1h** (last week).
- Click the **☾ / ☀** icon in the top-right to toggle dark/light mode.
- Click a widget's **⋮** menu to view the device page, rename, duplicate, or remove that widget.

---

## 6. Troubleshooting

| Symptom                                      | Likely cause                                                    |
|-----------------------------------------------|-------------------------------------------------------------------|
| Backend crashes immediately                   | Mongo or Redis isn't running — check step 1                      |
| "Disconnected" shown in the top bar            | Backend isn't running, or frontend can't reach `localhost:4000`  |
| Charts stay empty for a while                  | Normal for the first ~60s — the aggregator's first cron tick hasn't fired yet |
| `npm run dev` errors about a missing module    | Run `npm install` again inside `backend/`                        |

---

## 7. Stopping everything

- `Ctrl+C` in both terminals (backend and frontend).
- If you started Mongo/Redis via Docker: `docker stop pulsegrid-mongo pulsegrid-redis`