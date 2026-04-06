from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json, os, httpx
from datetime import datetime, timedelta

BOT_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "users.json"

def load_db():
    if os.path.exists(DB_FILE):
        return json.load(open(DB_FILE))
    return {}

def save_db(db):
    json.dump(db, open(DB_FILE, "w"))

def get_user(uid, name="Player"):
    db = load_db()
    key = str(uid)
    if key not in db:
        db[key] = {"name": name, "chips": 1000, "wins": 0, "played": 0, "total_wagered": 0, "total_won": 0, "stars_spent": 0}
        save_db(db)
    if "total_wagered" not in db[key]:
        db[key]["total_wagered"] = 0
        db[key]["total_won"] = 0
        db[key]["stars_spent"] = 0
        db[key]["last_daily"] = None
        save_db(db)
    return db[key]

def claim_daily(uid, name="Player"):
    db = load_db()
    key = str(uid)
    user = get_user(uid, name)
    now = datetime.utcnow()
    last = user.get("last_daily")
    if last:
        last_dt = datetime.fromisoformat(last)
        if now - last_dt < timedelta(hours=24):
            remaining = timedelta(hours=24) - (now - last_dt)
            hours = int(remaining.total_seconds() // 3600)
            mins = int((remaining.total_seconds() % 3600) // 60)
            return {"claimed": False, "message": f"Come back in {hours}h {mins}m", "chips": db[key]["chips"]}
    db[key]["chips"] += 100
    db[key]["last_daily"] = now.isoformat()
    save_db(db)
    return {"claimed": True, "message": "Daily bonus claimed!", "chips": db[key]["chips"]}

class ChipsRequest(BaseModel):
    user_id: int
    amount: int
    name: Optional[str] = "Player"

class InvoiceRequest(BaseModel):
    user_id: int
    stars: int

@app.get("/chips/{user_id}")
def get_chips(user_id: int, name: str = "Player"):
    u = get_user(user_id, name)
    return {"chips": u["chips"], "wins": u["wins"], "played": u["played"]}

@app.post("/chips/add")
def add_chips(req: ChipsRequest):
    db = load_db()
    key = str(req.user_id)
    if key not in db:
        db[key] = {"name": req.name, "chips": 1000, "wins": 0, "played": 0}
    db[key]["chips"] += req.amount
    save_db(db)
    return {"chips": db[key]["chips"]}

@app.post("/chips/deduct")
def deduct_chips(req: ChipsRequest):
    db = load_db()
    key = str(req.user_id)
    if key not in db:
        return {"error": "User not found"}
    if db[key]["chips"] < req.amount:
        return {"error": "Not enough chips"}
    db[key]["chips"] -= req.amount
    db[key]["total_wagered"] = db[key].get("total_wagered", 0) + req.amount
    db[key]["played"] = db[key].get("played", 0) + 1
    save_db(db)
    return {"chips": db[key]["chips"], "total_wagered": db[key]["total_wagered"]}

@app.get("/daily/{user_id}")
def daily_bonus(user_id: int, name: str = "Player"):
    return claim_daily(user_id, name)

@app.post("/wager")
def track_wager(req: ChipsRequest):
    db = load_db()
    key = str(req.user_id)
    if key not in db:
        db[key] = {"name": req.name, "chips": 1000, "wins": 0, "played": 0, "total_wagered": 0, "stars_spent": 0}
    db[key]["total_wagered"] = db[key].get("total_wagered", 0) + req.amount
    save_db(db)
    return {"total_wagered": db[key]["total_wagered"]}

@app.post("/invoice")
async def create_invoice(req: InvoiceRequest):
    chips = req.stars * 10
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/createInvoiceLink",
            json={
                "title": f"{chips} Blackjack Chips",
                "description": f"Buy {chips} chips to play Blackjack!",
                "payload": f"chips_{chips}_{req.user_id}",
                "currency": "XTR",
                "prices": [{"label": f"{chips} Chips", "amount": req.stars}]
            }
        )
        data = res.json()
        return {"invoice_link": data["result"]}

@app.get("/leaderboard")
def leaderboard():
    db = load_db()
    players = []
    for uid, data in db.items():
        players.append({
            "user_id": uid,
            "name": data.get("name", "Player"),
            "chips": data["chips"],
            "wins": data.get("wins", 0),
            "played": data.get("played", 0),
            "total_wagered": data.get("total_wagered", 0),
            "stars_spent": data.get("stars_spent", 0)
        })
    players.sort(key=lambda x: x["total_wagered"], reverse=True)
    return {"leaderboard": players[:10], "prize_pool": sum(p["stars_spent"] for p in players)}
