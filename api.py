from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
import os
import base64
import asyncio
import random
from supabase import create_client
from tonsdk.contract.wallet import Wallets, WalletVersionEnum
from tonsdk.utils import to_nano
from tonsdk.crypto import mnemonic_to_wallet_key

SUPABASE_URL = "https://ocqhzyjktrqmycafqlpw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWh6eWprdHJxbXljYWZxbHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTIzNDUsImV4cCI6MjA5MTE2ODM0NX0.J4I-EcmblNPUNeQnO1GJXBBm1gWt7de52pfpSEn4wYs"
BOT_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"
TON_API = "https://toncenter.com/api/v2"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

async def send_ton_to_winner(winner_address: str, amount_ton: float):
    try:
        mnemonic_str = os.environ.get("TON_MNEMONIC", "")
        if not mnemonic_str:
            print("❌ TON_MNEMONIC not set")
            return False
        mnemonic = mnemonic_str.split()
        _, _, _, wallet = Wallets.from_mnemonics(mnemonic, WalletVersionEnum.v4r2, 0)
        wallet_address = wallet.address.to_string(True, True, True)
        async with httpx.AsyncClient() as client:
            seqno_resp = await client.get(f"{TON_API}/getSeqno", params={"address": wallet_address})
            seqno = seqno_resp.json()["result"]
            query = wallet.create_transfer_message(to_addr=winner_address, amount=to_nano(amount_ton, "ton"), seqno=seqno)
            boc = base64.b64encode(query["message"].to_boc(False)).decode()
            send_resp = await client.post(f"{TON_API}/sendBoc", json={"boc": boc})
            print(f"✅ TON payout sent: {send_resp.json()}")
            return True
    except Exception as e:
        print(f"❌ TON payout failed: {e}")
        return False

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

class TicketRequest(BaseModel):
    competition_id: int
    user_telegram_id: str
    user_name: str
    ton_address: str
    tx_hash: Optional[str] = None

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
            json={"title": f"{chips} Blackjack Chips", "description": f"Buy {chips} chips to play Blackjack!", "payload": f"chips_{chips}_{req.user_id}", "currency": "XTR", "prices": [{"label": f"{chips} Chips", "amount": req.stars}]}
        )
        return {"invoice_link": res.json()["result"]}

@app.get("/leaderboard")
def leaderboard():
    res = supabase.table("users").select("*").order("total_wagered", desc=True).limit(10).execute()
    players = res.data or []
    total_stars = sum(p.get("stars_spent", 0) for p in players)
    return {"leaderboard": players, "prize_pool": total_stars}

@app.get("/competitions")
def get_competitions():
    res = supabase.table("competitions").select("*").eq("status", "active").execute()
    return {"competitions": res.data}

@app.get("/competitions/{comp_id}")
def get_competition(comp_id: int):
    res = supabase.table("competitions").select("*").eq("id", comp_id).execute()
    if not res.data:
        return {"error": "Not found"}
    tickets = supabase.table("tickets").select("*").eq("competition_id", comp_id).execute()
    return {"competition": res.data[0], "tickets": tickets.data}

@app.post("/tickets/buy")
async def buy_ticket(req: TicketRequest):
    comp = supabase.table("competitions").select("*").eq("id", req.competition_id).execute()
    if not comp.data:
        return {"error": "Not found"}
    c = comp.data[0]
    if c["status"] != "active":
        return {"detail": "Competition not active"}
    if c["tickets_sold"] >= c["max_tickets"]:
        return {"detail": "Sold out!"}
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
            json={"chat_id": "@blackjacktournamentChannel", "text": f"🎟️ Ticket #{ticket_number} sold to {req.user_name}!\n🏆 {c['name']}\n🎫 {remaining} tickets remaining!\n\nGet yours → t.me/blackjacktournamentbot"}
        )
    if new_sold >= c["max_tickets"]:
        tickets = supabase.table("tickets").select("*").eq("competition_id", req.competition_id).execute()
        block_hash = hex(random.getrandbits(256))
        winning_idx = int(block_hash, 16) % len(tickets.data)
        winner = tickets.data[winning_idx]
        supabase.table("draws").insert({
            "competition_id": req.competition_id,
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
            "draw_block_hash": block_hash
        }).eq("id", req.competition_id).execute()
        prize_ton = c.get("prize_ton", 100)
        payout_ok = await send_ton_to_winner(winner["ton_address"], prize_ton)
        payout_status = "✅ Prize sent automatically!" if payout_ok else "⚠️ Auto-payout failed — manual send required."
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": "@blackjacktournamentChannel", "text": f"🎰 DRAW COMPLETE!\n🏆 {c['name']}\n🔢 Hash: {block_hash[:20]}...\n🎯 Winning Ticket #{winner['ticket_number']}\n🥳 WINNER: {winner['user_name']}!\n💰 Prize: {prize_ton} TON\n📤 {payout_status}\n🔍 Verify: tonviewer.com"}
            )
    return {"ticket_number": ticket_number, "remaining": remaining, "total": c["max_tickets"]}

class ReferralRequest(BaseModel):
    referrer_telegram_id: str
    referred_telegram_id: str
    referred_name: str

@app.post("/referral")
async def add_referral(req: ReferralRequest):
    # Check not already referred
    existing = supabase.table("referrals").select("*").eq("referred_telegram_id", req.referred_telegram_id).execute()
    if existing.data:
        return {"status": "already referred"}
    
    # Get free competition
    comp = supabase.table("competitions").select("*").eq("ticket_price_ton", 0).eq("status", "active").execute()
    if not comp.data:
        return {"status": "no free competition"}
    c = comp.data[0]
    
    # Record referral
    supabase.table("referrals").insert({
        "referrer_telegram_id": req.referrer_telegram_id,
        "referred_telegram_id": req.referred_telegram_id,
        "competition_id": c["id"]
    }).execute()
    
    # Count referrer tickets
    refs = supabase.table("referrals").select("*").eq("referrer_telegram_id", req.referrer_telegram_id).execute()
    ticket_count = len(refs.data)
    
    # Add ticket for referrer
    ticket_number = c["tickets_sold"] + 1
    supabase.table("tickets").insert({
        "competition_id": c["id"],
        "ticket_number": ticket_number,
        "user_telegram_id": req.referrer_telegram_id,
        "user_name": "Referral Entry",
        "ton_address": "pending",
        "tx_hash": "referral"
    }).execute()
    supabase.table("competitions").update({"tickets_sold": ticket_number}).eq("id", c["id"]).execute()
    
    return {"status": "ok", "ticket_number": ticket_number, "total_tickets": ticket_count}

@app.get("/draws")
def get_draws():
    res = supabase.table("draws").select("*").order("drawn_at", desc=True).limit(10).execute()
    return {"draws": res.data}
