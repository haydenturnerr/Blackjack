import asyncio
import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler

BOT_TOKEN = "8734635689:AAGBVV_8ruryi7N06O-l6oYFfC686t3u0xg"
MINI_APP_URL = "https://toncompetitions.vercel.app"

logging.basicConfig(level=logging.INFO)

async def start(update, ctx):
    await update.message.reply_photo(
        photo="https://toncompetitions.vercel.app/prize.png",
        caption=(
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

async def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    async with app:
        await app.start()
        print("🏆 TonCompetitions Bot running!")
        await app.updater.start_polling()
        await asyncio.sleep(float('inf'))

asyncio.run(main())
