<img width="942" height="696" alt="Screenshot 2026-07-02 213006" src="https://github.com/user-attachments/assets/0892cd2f-627a-4691-acfa-8410f861dbc2" /># 🌊 FloodWatch PH

A community-powered flood monitoring and reporting platform for the Philippines.

FloodWatch PH enables the public to report flood incidents, verify existing reports, monitor flood conditions through an interactive map, locate nearby evacuation centers, and stay informed with weather updates—all through a mobile-friendly web application.

---

## Features

### 🗺️ Interactive Flood Map
- View community-reported flood incidents across the Philippines
- Filter reports by severity, status, and recency
- Marker clustering for improved map performance
- Built with Leaflet and OpenStreetMap

### 📍 Community Flood Reporting
- Submit flood reports with:
  - Title and description
  - Flood severity
  - Photo upload
  - GPS coordinates
  - Reverse-geocoded location
- Prevent duplicate reports using nearby incident detection

### ✅ Community Verification
- Confirm active flood reports
- Mark reports as receded
- Community trust indicators
- Automatic report lifecycle based on confirmations and receded votes

### 🌦 Weather Monitoring
- Current weather conditions
- Rain forecasts
- Flood risk indicators
- Location search
- Current location weather

### 🏠 Evacuation Centers
- Browse evacuation centers
- Find nearby evacuation centers
- Distance estimation
- Google Maps navigation

### 📱 Mobile Optimized
- Responsive interface
- Touch-friendly map controls
- Mobile report workflow
- Optimized layouts for smaller screens

---

## Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Leaflet

### Backend
- Next.js API Routes
- Prisma ORM
- PostgreSQL (Supabase)

### External Services
- Supabase
- OpenStreetMap
- Open-Meteo API
- Nominatim Reverse Geocoding

---

## Project Structure

```
app/
components/
lib/
prisma/
public/
hooks/
data/
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/Syddevv/Flood-Watch-PH.git
cd Flood-Watch-PH
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env.local` file.

```env
DATABASE_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
```

Fill in the values from your Supabase project.

---

## Run the development server

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

## Build for production

```bash
npm run build
```

Start the production server

```bash
npm run start
```

---

## Screenshots

<img width="1898" height="947" alt="Screenshot 2026-07-02 211937" src="https://github.com/user-attachments/assets/a4d28d2f-ca28-4e15-9953-030c4655dfbf" />
<img width="942" height="696" alt="Screenshot 2026-07-02 213006" src="https://github.com/user-attachments/assets/b688949d-9fc8-41ae-a016-886ecdf33e13" />


---

## Roadmap

- [x] Community flood reporting
- [x] Interactive flood map
- [x] Community confirmations
- [x] Report lifecycle system
- [x] Weather monitoring
- [x] Evacuation center locator
- [x] Mobile responsive UI
- [x] Nearby duplicate detection
- [ ] PAGASA integration
- [ ] Push notifications
- [ ] Historical flood analytics
- [ ] AI-powered flood risk prediction

---

## Live Demo

https://flood-watch-ph.vercel.app

---


## Author

**Sydney Santos**

GitHub:
https://github.com/Syddevv

---

> FloodWatch PH is an academic and community-oriented project designed to improve public awareness of flood conditions by combining community reporting, mapping, weather information, and evacuation resources into a single accessible platform.
