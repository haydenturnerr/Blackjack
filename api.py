from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
from supabase import create_client

SUPABASE_URL = "https://ocqhzyjktrqmycafqlpw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWh6eWprdHJxbXljYWZxbHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTIzNDUsImV4cCI6MjA5MTE2ODM0NX0.J4I-EcmblNPUNeQnO1GJXBBm1gWt7de52pfpSEn4wYs"
BOT_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_user(user_id: str, name: str = "Player"):
    res = supabase.table("users").select("*").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    new_user = {"user_id": user_id, "name": name, "chips": 1000, "wins": 0, "played": 0, "total_wagered": 0, "stars_spent": 0}
    supabase.table("users").insert(new_user).execute()
    return new_user

class ChipsRequest(BaseModel):
    user_id: int
    amount: int
    name: Optional[str] = "Player"

class InvoiceRequest(BaseModel):
    user_id: int
    stars: int

@app.get("/chips/{user_id}")
def get_chips(user_id: int, name: str = "Player"):
    u = get_user(str(user_id), name)
    return {"chips": u["chips"], "wins": u["wins"], "played": u["played"], "total_wagered": u.get("total_wagered", 0)}

@app.post("/chips/add")
def add_chips(req: ChipsRequest):
    u = get_user(str(req.user_id), req.name)
    new_chips = u["chips"] + req.amount
    supabase.table("users").update({"chips": new_chips, "name": req.name}).eq("user_id", str(req.user_id)).execute()
    return {"chips": new_chips}

@app.post("/chips/deduct")
def deduct_chips(req: ChipsRequest):
    u = get_user(str(req.user_id), req.name)
    if u["chips"] < req.amount:
        return {"error": "Not enough chips"}
    new_chips = u["chips"] - req.amount
    supabase.table("users").update({"chips": new_chips}).eq("user_id", str(req.user_id)).execute()
    return {"chips": new_chips}

@app.post("/wager")
def track_wager(req: ChipsRequest):
    u = get_user(str(req.user_id), req.name)
    new_wagered = u.get("total_wagered", 0) + req.amount
    supabase.table("users").update({"total_wagered": new_wagered, "name": req.name}).eq("user_id", str(req.user_id)).execute()
    return {"total_wagered": new_wagered}

@app.get("/daily/{user_id}")
def daily_bonus(user_id: int, name: str = "Player"):
    from datetime import datetime, timedelta
    u = get_user(str(user_id), name)
    now = datetime.utcnow()
    last = u.get("last_daily")
    if last:
        last_dt = datetime.fromisoformat(last)
        if now - last_dt < timedelta(hours=24):
            remaining = timedelta(hours=24) - (now - last_dt)
            hours = int(remaining.total_seconds() // 3600)
            mins = int((remaining.total_seconds() % 3600) // 60)
            return {"claimed": False, "message": f"Come back in {hours}h {mins}m", "chips": u["chips"]}
    new_chips = u["chips"] + 100
    supabase.table("users").update({"chips": new_chips, "last_daily": now.isoformat()}).eq("user_id", str(user_id)).execute()
    return {"claimed": True, "message": "Daily bonus claimed!", "chips": new_chips}

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
    res = supabase.table("users").select("*").order("total_wagered", desc=True).limit(10).execute()
    players = res.data or []
    total_stars = sum(p.get("stars_spent", 0) for p in players)
    return {"leaderboard": players, "prize_pool": total_stars}
