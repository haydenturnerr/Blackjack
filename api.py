from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared user data with bot
users = {}

def get_user(uid):
    if uid not in users:
        users[uid] = {"chips": 1000}  # Start with 1000 free chips
    return users[uid]

class BetRequest(BaseModel):
    user_id: int
    amount: int

class ChipsRequest(BaseModel):
    user_id: int
    amount: int

@app.get("/chips/{user_id}")
def get_chips(user_id: int):
    u = get_user(user_id)
    return {"chips": u["chips"]}

@app.post("/chips/add")
def add_chips(req: ChipsRequest):
    u = get_user(req.user_id)
    u["chips"] += req.amount
    return {"chips": u["chips"]}

@app.post("/chips/deduct")
def deduct_chips(req: ChipsRequest):
    u = get_user(req.user_id)
    if u["chips"] < req.amount:
        return {"error": "Not enough chips"}
    u["chips"] -= req.amount
    return {"chips": u["chips"]}
