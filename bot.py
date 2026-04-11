import asyncio
import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler
import httpx

BOT_TOKEN = "8734635689:AAGBVV_8ruryi7N06O-l6oYFfC686t3u0xg"
MINI_APP_URL = "https://toncompetitions.vercel.app"
API_URL = "https://blackjack-api-e31a.onrender.com"

logging.basicConfig(level=logging.INFO)

async def start(update, ctx):
    uid = str(update.effective_user.id)
    name = update.effective_user.first_name or "Player"
    args = ctx.args

    # Handle referral
    if args and args[0].startswith("ref_"):
        referrer_id = args[0].replace("ref_", "")
        if referrer_id != uid:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(f"{API_URL}/referral", json={
                        "referrer_telegram_id": referrer_id,
                        "referred_telegram_id": uid,
                        "referred_name": name
                    })
            except:
                pass

    ref_link = f"https://t.me/TonCompetitions_bot?start=ref_{uid}"

    await update.message.reply_text(
        "🏆 *TonCompetitions*\n\n"
        "🎟️ 100 TON Giveaway — *LIVE NOW*\n"
        "🔥 1,700 TON \\(~1 ETH\\) — *LIVE NOW*\n"
        "🎁 FREE 100 TON Giveaway — *Share to enter!*\n\n"
        f"🔗 Your referral link:\n`{ref_link}`\n\n"
        "_Share your link — every friend who joins gets you a free ticket!_",
        parse_mode='MarkdownV2',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🎟️ Enter Competitions", web_app={"url": MINI_APP_URL})
        ]])
    )

async def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    async with app:
        await app.start()
        print("🏆 TonCompetitions Bot running!")
        await app.updater.start_polling()
        await asyncio.sleep(float('inf'))

asyncio.run(main())
