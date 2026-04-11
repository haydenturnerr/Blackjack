import asyncio
import logging
import threading
import uvicorn
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, PreCheckoutQueryHandler, MessageHandler, filters
import httpx
from api import app as fastapi_app

BLACKJACK_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"
TON_TOKEN = "8734635689:AAGBVV_8ruryi7N06O-l6oYFfC686t3u0xg"
API_URL = "https://blackjack-api-e31a.onrender.com"
CHIPS_PER_STAR = 10
MINI_APP_URL = "https://toncompetitions.vercel.app"

logging.basicConfig(level=logging.INFO)

def buy_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⭐ 10 Stars → 100 chips", callback_data="buy_10")],
        [InlineKeyboardButton("⭐ 50 Stars → 500 chips", callback_data="buy_50")],
        [InlineKeyboardButton("⭐ 100 Stars → 1000 chips", callback_data="buy_100")],
    ])

async def get_chips(uid, name="Player"):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{API_URL}/chips/{uid}?name={name}")
            return res.json().get("chips", 0)
    except:
        return 0

# ── BLACKJACK BOT ──────────────────────────────────────────────────────────────

async def bj_start(update, ctx):
    uid = update.effective_user.id
    name = update.effective_user.first_name or "Player"
    chips = await get_chips(uid, name)
    args = ctx.args
    if args and args[0].startswith('buy'):
        await update.message.reply_photo(
            photo="https://frontend-iota-two-17.vercel.app/prize.png",
            caption=f"⭐ *Buy Chips*\n\nYour chips: *{chips}*\n\n1 ⭐ = {CHIPS_PER_STAR} chips",
            parse_mode='Markdown', reply_markup=buy_kb())
        return
    await update.message.reply_photo(
        photo="https://frontend-iota-two-17.vercel.app/prize.png",
        caption=(
            "♠️ *Blackjack Tournament*\n\n"
            "Play Blackjack, wager chips and win real ⭐ Stars every week!\n\n"
            "🥇 1st place — 200 ⭐ Stars\n"
            "🥈 2nd place — 75 ⭐ Stars\n"
            "🥉 3rd place — 25 ⭐ Stars\n\n"
            "_Top wagerers win real Telegram Stars every week!_"
        ),
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Play Blackjack", web_app={"url": "https://frontend-iota-two-17.vercel.app"})],
        ]))

async def button(update, ctx):
    q = update.callback_query
    await q.answer()
    uid = q.from_user.id
    name = q.from_user.first_name or "Player"
    d = q.data
    if d.startswith('buy_'):
        stars = int(d.split('_')[1])
        chips = stars * CHIPS_PER_STAR
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{BLACKJACK_TOKEN}/sendInvoice",
                json={
                    "chat_id": uid,
                    "title": f"🃏 {chips} Blackjack Chips",
                    "description": f"{chips} chips to play Blackjack.",
                    "payload": f"chips_{chips}_{uid}",
                    "currency": "XTR",
                    "provider_token": "",
                    "prices": [{"label": f"{chips} Chips", "amount": stars}],
                }
            )

async def precheckout(update, ctx):
    await update.pre_checkout_query.answer(ok=True)

async def paid(update, ctx):
    uid = update.effective_user.id
    name = update.effective_user.first_name or "Player"
    chips = int(update.message.successful_payment.invoice_payload.split('_')[1])
    stars = update.message.successful_payment.total_amount
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{API_URL}/chips/add",
            json={"user_id": uid, "amount": chips, "name": name})
        new_chips = res.json().get("chips", 0)
    await update.message.reply_text(
        f"⭐ {stars} Stars received! +{chips} chips added.\n\n💰 Balance: {new_chips} chips",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🎮 Play Blackjack", web_app={"url": "https://frontend-iota-two-17.vercel.app"})
        ]]))

# ── TONCOMPETITIONS BOT ────────────────────────────────────────────────────────

async def ton_start(update, ctx):
    uid = str(update.effective_user.id)
    name = update.effective_user.first_name or "Player"
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{TON_TOKEN}/sendMessage",
                json={
                    "chat_id": "1283355111",
                    "text": f"🆕 New user on TonCompetitions!\n👤 {name}\n🆔 {uid}"
                }
            )
    except:
        pass
    
    await update.message.reply_text(
        text=(
            "🏆 *TonCompetitions*\n\n"
            "🎟️ 100 TON Giveaway — *LIVE NOW*\n"
            "Only 111 tickets at 1 TON each\n"
            "Draw is automatic when sold out\n"
            "Winner paid instantly to wallet\n\n"
            "🔜 1 ETH Giveaway — coming soon\n"
            "🔜 1 BTC Giveaway — coming soon\n\n"
            "_Fully verified on blockchain_ 🔍"
        ),
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🎟️ Enter Competition", web_app={"url": MINI_APP_URL})
        ]])
    )

# ── RUN BOTH BOTS ──────────────────────────────────────────────────────────────

def run_blackjack_bot():
    async def main():
        app = (Application.builder()
               .token(BLACKJACK_TOKEN)
               .connect_timeout(30)
               .read_timeout(30)
               .write_timeout(30)
               .build())
        app.add_handler(CommandHandler("start", bj_start))
        app.add_handler(CallbackQueryHandler(button))
        app.add_handler(PreCheckoutQueryHandler(precheckout))
        app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, paid))
        async with app:
            await app.start()
            print("🃏 BlackJack Bot running!")
            await app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
            await asyncio.sleep(float('inf'))
    asyncio.run(main())

def run_ton_bot():
    async def main():
        app = (Application.builder()
               .token(TON_TOKEN)
               .connect_timeout(30)
               .read_timeout(30)
               .write_timeout(30)
               .build())
        app.add_handler(CommandHandler("start", ton_start))
        async with app:
            await app.start()
            print("🏆 TonCompetitions Bot running!")
            await app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
            await asyncio.sleep(float('inf'))
    asyncio.run(main())

if __name__ == "__main__":
    threading.Thread(target=run_blackjack_bot, daemon=True).start()
    threading.Thread(target=run_ton_bot, daemon=True).start()
    uvicorn.run(fastapi_app, host="0.0.0.0", port=10000)
