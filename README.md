# Cash Dam Simulator

A wealth management simulator for comparing Canadian mortgage strategies: Standard paydown vs Cash Damming with HELOC-funded debt conversion.

Built with Svelte + TypeScript, Apache ECharts for visualization, and deployable as a Docker container on ARM64 hardware (Synology NAS DS220+).

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000) with hot module replacement.

### Production Preview

```bash
npm run build
npm run preview
```

Serves the production build locally on port 4173.

### Docker (Synology NAS / ARM64)

```bash
docker-compose up
```

The app is served at [http://localhost:8080](http://localhost:8080). Edit `docker-compose.yml` to change the port mapping.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run tests with Vitest |
| `npm run check` | Type-check Svelte and TypeScript |
