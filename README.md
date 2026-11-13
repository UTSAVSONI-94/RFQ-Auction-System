# RFQ British Auction System

Reverse auction / RFQ bidding system with anti-sniping extensions and a forced close limit.

## Docs

- [High Level Design & Architecture](docs/hld.md)
- [Database Schema Design](docs/schema.md)
- [Assumptions](docs/assumptions.md)

## Tech Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Frontend: React, Vite, react-router-dom

---

## How to run

### 1. Database
Make sure Postgres is running and create the database:
```bash
createdb rfq_auction
```

Backend looks for `DATABASE_URL` in `backend/.env` (defaults to `postgresql+psycopg2://localhost:5432/rfq_auction`).

### 2. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API runs on `http://localhost:8000`. Swagger docs are at `http://localhost:8000/docs`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
UI runs on `http://localhost:5173`.
