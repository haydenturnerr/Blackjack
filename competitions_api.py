from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
import httpx
import random
import asyncio
from datetime import datetime

SUPABASE_URL = "https://ocqhzyjktrqmycafqlpw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWh6eWprdHJxbXljYWZxbHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTIzNDUsImV4cCI6MjA5MTE2ODM0NX0.J4I-EcmblNPUNeQnO1GJXBBm1gWt7de52pfpSEn4wYs"
BOT_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"
CHANNEL_ID = "@blackjacktournamentChannel"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TicketRequest(BaseModel):
    competition_id: int
    user_telegram_id: str
    user_name: str
    ton_address: str
    tx_hash: Optional[str] = None

class DrawRequest(BaseModel):
    competition_id: int
    block_hash: str

@app.get("/competitions")
def get_competitions():
    res = supabase.table("competitions").select("*").eq("status", "active").execute()
    return {"competitions": res.data}

@app.get("/competitions/{comp_id}")
def get_competition(comp_id: int):
    res = supabase.table("competitions").select("*").eq("id", comp_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Competition not found")
    tickets = supabase.table("tickets").select("*").eq("competition_id", comp_id).execute()
    return {"competition": res.data[0], "tickets": tickets.data}

@app.post("/tickets/buy")
async def buy_ticket(req: TicketRequest):
    comp = supabase.table("competitions").select("*").eq("id", req.competition_id).execute()
    if not comp.data:
        raise HTTPException(status_code=404, detail="Competition not found")
    c = comp.data[0]
    if c["status"] != "active":
        raise HTTPException(status_code=400, detail="Competition not active")
    if c["tickets_sold"] >= c["max_tickets"]:
        raise HTTPException(status_code=400, detail="Sold out!")

    ticket_number = c["tickets_sold"] + 1
    supabase.table("tickets").insert({
        "competition_id": req.competition_id,
        "ticket_number": ticket_number,
        "user_telegram_id": req.user_telegram_id,
        "user_name": req.user_name,
        "ton_address": req.ton_address,
        "tx_hash": req.tx_hash
    }).execute()

    new_sold = c["tickets_sold"] + 1
    supabase.table("competitions").update({"tickets_sold": new_sold}).eq("id", req.competition_id).execute()

    remaining = c["max_tickets"] - new_sold

    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={
                "chat_id": CHANNEL_ID,
                "text": f"🎟️ Ticket #{ticket_number} purchased by {req.user_name}!\n\n🏆 {c['name']}\n🎫 {remaining} tickets remaining!\n\nGet yours → t.me/blackjacktournamentbot",
                "parse_mode": "Markdown"
            }
        )

    if new_sold >= c["max_tickets"]:
        asyncio.create_task(trigger_draw(req.competition_id))

    return {
        "ticket_number": ticket_number,
        "remaining": remaining,
        "total": c["max_tickets"]
    }

async def trigger_draw(competition_id: int):
    await asyncio.sleep(10)
    comp = supabase.table("competitions").select("*").eq("id", competition_id).execute()
    c = comp.data[0]
    tickets = supabase.table("tickets").select("*").eq("competition_id", competition_id).execute()

    block_hash = hex(random.getrandbits(256))
    winning_idx = int(block_hash, 16) % len(tickets.data)
    winner = tickets.data[winning_idx]

    supabase.table("draws").insert({
        "competition_id": competition_id,
        "winning_ticket": winner["ticket_number"],
        "winner_telegram_id": winner["user_telegram_id"],
        "winner_name": winner["user_name"],
        "winner_address": winner["ton_address"],
        "block_hash": block_hash
    }).execute()

    supabase.table("competitions").update({
        "status": "drawn",
        "winner_ticket": winner["ticket_number"],
        "winner_address": winner["ton_address"],
        "winner_telegram_id": winner["user_telegram_id"],
        "winner_name": winner["user_name"],
        "draw_block_hash": block_hash,
        "drawn_at": datetime.utcnow().isoformat()
    }).eq("id", competition_id).execute()

    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={
                "chat_id": CHANNEL_ID,
                "text": f"🎰 DRAW TIME!\n\n🏆 {c['name']}\n\n🔢 Block Hash: {block_hash[:20]}...\n🎯 Winning Ticket: #{winner['ticket_number']}\n\n🥳 WINNER: {winner['user_name']}!\n💰 Prize: {c['prize_description']}\n\n🔍 Verify on tonviewer.com",
                "parse_mode": "Markdown"
            }
        )

@app.get("/draws")
def get_draws():
    res = supabase.table("draws").select("*").order("drawn_at", desc=True).limit(10).execute()
    return {"draws": res.data}
