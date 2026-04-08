import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const API = "https://blackjack-api-e31a.onrender.com";
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (["J","Q","K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return parseInt(card.value);
}

function handTotal(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) { return hand.length === 2 && handTotal(hand) === 21; }
function isPair(hand) { return hand.length === 2 && hand[0].value === hand[1].value; }

function isSameSuit(a, b) { return a.suit === b.suit; }
function isSameColor(a, b) {
  const red = ["♥","♦"];
  return red.includes(a.suit) === red.includes(b.suit);
}

function checkPerfectPairs(hand) {
  if (hand.length < 2 || hand[0].value !== hand[1].value) return null;
  if (isSameSuit(hand[0], hand[1])) return { name: "Perfect Pair!", mult: 25 };
  if (isSameColor(hand[0], hand[1])) return { name: "Coloured Pair!", mult: 12 };
  return { name: "Mixed Pair!", mult: 6 };
}

function check21Plus3(playerHand, dealerHand) {
  if (playerHand.length < 2) return null;
  const three = [playerHand[0], playerHand[1], dealerHand[0]];
  const vals = three.map(c => VALUES.indexOf(c.value));
  const suits = three.map(c => c.suit);
  const allSameSuit = suits.every(s => s === suits[0]);
  const allSameVal = vals.every(v => v === vals[0]);
  const sorted = [...vals].sort((a,b) => a-b);
  const isStr = sorted[2]-sorted[1] === 1 && sorted[1]-sorted[0] === 1;
  const isFlush = allSameSuit;
  if (allSameVal && allSameSuit) return { name: "Suited Trips!", mult: 100 };
  if (isStr && allSameSuit) return { name: "Straight Flush!", mult: 40 };
  if (allSameVal) return { name: "Three of a Kind!", mult: 30 };
  if (isStr) return { name: "Straight!", mult: 10 };
  if (isFlush) return { name: "Flush!", mult: 5 };
  return null;
}

function useSound() {
  let audioCtx = null;
  const getCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  };
  const playCard = () => {
    try {
      const ctx = getCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04)) * 0.15;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 800;
      const gain = ctx.createGain(); gain.gain.value = 0.4;
      src.buffer = buf; src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  };
  const playChip = () => {
    try {
      const ctx = getCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008)) * 0.5;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass"; filter.frequency.value = 2000;
      const gain = ctx.createGain(); gain.gain.value = 0.6;
      src.buffer = buf; src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  };
  const playWin = () => {
    try {
      const ctx = getCtx();
      [523,659,784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    } catch(e) {}
  };
  const playLose = () => {
    try {
      const ctx = getCtx();
      [280,240].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.5);
      });
    } catch(e) {}
  };
  return { playCard, playChip, playWin, playLose };
}

function Card({ card, hidden, delay = 0 }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      initial={{ y: -60, opacity: 0, rotateY: 180, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 120 }}
      style={{
        width: 58, height: 82, borderRadius: 9,
        background: hidden ? "linear-gradient(135deg,#1e1b4b,#3730a3)" : "white",
        display: "grid", gridTemplateRows: "1fr 1.4fr 1fr", padding: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
      }}
    >
      {hidden ? (
        <div style={{ gridRow: "1/4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "rgba(255,255,255,0.15)", fontWeight: 900 }}>?</div>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, color: isRed ? "#e63946" : "#111" }}>{card.value}</div>
          <div style={{ fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", color: isRed ? "#e63946" : "#111" }}>{card.suit}</div>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, textAlign: "right", transform: "rotate(180deg)", color: isRed ? "#e63946" : "#111" }}>{card.value}</div>
        </>
      )}
    </motion.div>
  );
}

const PAYOUTS = {
  perfectPairs: [
    { name: "Perfect Pair (same suit)", val: "25:1" },
    { name: "Coloured Pair (same colour)", val: "12:1" },
    { name: "Mixed Pair (diff colour)", val: "6:1" },
  ],
  plus3: [
    { name: "Suited Three of a Kind", val: "100:1" },
    { name: "Straight Flush", val: "40:1" },
    { name: "Three of a Kind", val: "30:1" },
    { name: "Straight", val: "10:1" },
    { name: "Flush", val: "5:1" },
  ],
  luckyLucky: [
    { name: "Suited 7-7-7", val: "200:1" },
    { name: "Any 7-7-7", val: "50:1" },
    { name: "Suited 6-7-8", val: "100:1" },
    { name: "Any 6-7-8", val: "30:1" },
    { name: "Any 21", val: "15:1" },
    { name: "Any 20", val: "3:1" },
    { name: "Any 19", val: "2:1" },
  ],
};

function PayoutPopup({ title, rows, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={e => e.stopPropagation()}
      style={{
        background: "#1a2035", border: "1px solid rgba(168,85,247,0.4)",
        borderRadius: 14, padding: "16px 20px", zIndex: 201, minWidth: 260, maxWidth: 320,
        boxShadow: "0 8px 32px rgba(0,0,0,0.8)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ color: "#c084fc", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>{title}</div>
        <div onClick={onClose} style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}>✕</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < rows.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{r.name}</div>
          <div style={{ color: "#ffd700", fontSize: 10, fontWeight: 900 }}>{r.val}</div>
        </div>
      ))}
    </motion.div>
    </div>
  );
}

export default function App() {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id || 1283355111;
  const userName = tg?.initDataUnsafe?.user?.first_name || "Player";
  const { playCard, playChip, playWin, playLose } = useSound();

  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [splitHand, setSplitHand] = useState(null);
  const [dealerHand, setDealerHand] = useState([]);
  const [chips, setChips] = useState(0);
  const [bet, setBet] = useState(0);
  const [splitBet, setSplitBet] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const [selectedChip, setSelectedChip] = useState(10);
  const [sideBetPP, setSideBetPP] = useState(0);
  const [sideBet21, setSideBet21] = useState(0);
  const [phase, setPhase] = useState("betting");
  const [activeHand, setActiveHand] = useState("main");
  const [message, setMessage] = useState("Loading...");
  const [showBuy, setShowBuy] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [buying, setBuying] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [openInfo, setOpenInfo] = useState(null);
  const [insurance, setInsurance] = useState(false);
  const [insuranceBet, setInsuranceBet] = useState(0);

  useEffect(() => {
    if (tg) tg.ready();
    loadChips();
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API}/daily/${userId}?name=${userName}`)
      .then(r => r.json())
      .then(data => { if (data.claimed) { setChips(data.chips); setMessage("🎁 Daily bonus! +100 chips!"); setTimeout(() => setMessage("Place your bet!"), 3000); } })
      .catch(() => {});
  }, []);

  function loadChips() {
    fetch(`${API}/chips/${userId}?name=${userName}`)
      .then(r => r.json())
      .then(data => { setChips(data.chips); setMessage("Place your bet!"); })
      .catch(() => { setChips(1000); setMessage("Place your bet!"); });
  }

  function loadLeaderboard() {
    fetch(`${API}/leaderboard`)
      .then(r => r.json())
      .then(data => setLeaders(data.leaderboard || []))
      .catch(() => {});
  }

  async function buyChips(stars) {
    setBuying(true);
    try {
      const res = await fetch(`${API}/invoice`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, stars })
      });
      const data = await res.json();
      if (data.invoice_link && tg) {
        tg.openInvoice(data.invoice_link, (status) => {
          if (status === "paid") {
            setShowBuy(false);
            setMessage("Adding chips...");
            let attempts = 0;
            const poll = setInterval(async () => {
              attempts++;
              const r = await fetch(`${API}/chips/${userId}?name=${userName}`);
              const d = await r.json();
              if (d.chips > chips || attempts > 10) {
                clearInterval(poll);
                setChips(d.chips);
                setMessage("Chips added! Place your bet!");
              }
            }, 2000);
          }
        });
      }
    } catch(e) {}
    setBuying(false);
  }

  async function updateChips(amount, won) {
    const res = await fetch(`${API}${won ? "/chips/add" : "/chips/deduct"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, amount: Math.abs(amount), name: userName })
    });
    const data = await res.json();
    if (data.chips !== undefined) setChips(data.chips);
  }

  async function trackWager(amount) {
    await fetch(`${API}/wager`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, amount, name: userName })
    });
  }

  function addBet(amount) {
    if (chips >= bet + amount) { setBet(b => b + amount); playChip(); }
  }

  function startGame() {
    if (bet === 0) return setMessage("Place a bet first!");
    if (chips < bet) return setMessage("Not enough chips!");
    setLastBet(bet);
    trackWager(bet);
    updateChips(bet, false);
    if (sideBetPP > 0) updateChips(sideBetPP, false);
    if (sideBet21 > 0) updateChips(sideBet21, false);

    const newDeck = createDeck();
    const p = [newDeck.pop(), newDeck.pop()];
    const d = [newDeck.pop(), newDeck.pop()];
    setDeck(newDeck); setPlayerHand(p); setDealerHand(d);
    setSplitHand(null); setSplitBet(0); setActiveHand("main");
    playCard();

    // Check perfect pairs
    if (sideBetPP > 0) {
      const pp = checkPerfectPairs(p);
      if (pp) { updateChips(sideBetPP * (pp.mult + 1), true); setMessage(`${pp.name} ${pp.mult}:1! 🎉`); }
    }

    if (d[0].value === "A" && !isBlackjack(p)) {
      setPhase("insurance"); setMessage("Dealer shows Ace! Insurance?"); return;
    }
    if (isBlackjack(p) && !isBlackjack(d)) {
      const win = Math.floor(bet * 2.5);
      setPhase("done"); setMessage("🃏 BLACKJACK! +"+Math.floor(bet*1.5)+" chips!");
      updateChips(win, true); playWin(); return;
    }
    if (isBlackjack(p) && isBlackjack(d)) {
      setPhase("done"); setMessage("Both Blackjack! Push 🤝");
      updateChips(bet, true); return;
    }
    setPhase("playing"); setMessage("Hit or Stand?");
  }

  function takeInsurance() {
    const cost = Math.floor(bet / 2);
    if (chips < cost) return setMessage("Not enough chips!");
    setInsuranceBet(cost); updateChips(cost, false);
    setInsurance(true); setPhase("playing"); setMessage("Hit or Stand?");
  }

  function declineInsurance() {
    setInsuranceBet(0); setInsurance(false);
    setPhase("playing"); setMessage("Hit or Stand?");
  }

  function hit() {
    playCard();
    const newDeck = [...deck];
    if (activeHand === "main") {
      const newHand = [...playerHand, newDeck.pop()];
      setDeck(newDeck); setPlayerHand(newHand);
      if (handTotal(newHand) > 21) {
        if (splitHand) { setActiveHand("split"); setMessage("Split hand!"); }
        else { setPhase("done"); setMessage("Bust! 💸"); playLose(); }
      }
    } else {
      const newSplit = [...splitHand, newDeck.pop()];
      setDeck(newDeck); setSplitHand(newSplit);
      if (handTotal(newSplit) > 21) finishDealer(newDeck, playerHand, newSplit);
    }
  }

  function stand() {
    if (activeHand === "main" && splitHand) { setActiveHand("split"); setMessage("Split hand!"); return; }
    finishDealer([...deck], playerHand, splitHand);
  }

  function finishDealer(currentDeck, pHand, sHand) {
    let dHand = [...dealerHand];
    while (handTotal(dHand) < 17) dHand.push(currentDeck.pop());
    setDealerHand(dHand); setDeck(currentDeck); setPhase("done");
    const dv = handTotal(dHand), pv = handTotal(pHand);

    // Insurance resolve
    if (insurance && insuranceBet > 0) {
      if (isBlackjack(dHand)) updateChips(insuranceBet * 3, true);
      setInsurance(false); setInsuranceBet(0);
    }

    // 21+3 side bet
    if (sideBet21 > 0) {
      const t3 = check21Plus3(pHand, dealerHand);
      if (t3) updateChips(sideBet21 * (t3.mult + 1), true);
    }

    let msg = "";
    if (pv > 21) { msg = "Bust! 💸"; playLose(); }
    else if (dv > 21 || pv > dv) { msg = "You Win! 🎉"; updateChips(bet * 2, true); playWin(); }
    else if (pv === dv) { msg = "Push 🤝"; updateChips(bet, true); }
    else { msg = "Dealer Wins 😔"; playLose(); }

    if (sHand) {
      const sv = handTotal(sHand);
      if (sv > 21) { msg += " | Split: Bust"; }
      else if (dv > 21 || sv > dv) { msg += " | Split: Win! 🎉"; updateChips(splitBet * 2, true); }
      else if (sv === dv) { msg += " | Split: Push"; updateChips(splitBet, true); }
      else { msg += " | Split: Lose"; }
    }
    setMessage(msg);
    loadLeaderboard();
  }

  function doubleDown() {
    if (chips < bet) return;
    playCard();
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    const newBet = bet * 2;
    setDeck(newDeck); setPlayerHand(newHand); setBet(newBet);
    updateChips(bet, false);
    if (handTotal(newHand) > 21) { setPhase("done"); setMessage("Bust on Double! 💸"); playLose(); }
    else finishDealer(newDeck, newHand, splitHand);
  }

  function split() {
    if (chips < bet || !isPair(playerHand)) return;
    playCard();
    const newDeck = [...deck];
    const hand1 = [playerHand[0], newDeck.pop()];
    const hand2 = [playerHand[1], newDeck.pop()];
    setDeck(newDeck); setPlayerHand(hand1); setSplitHand(hand2);
    setSplitBet(bet); setActiveHand("main");
    updateChips(bet, false); setMessage("Main hand first!");
  }

  function reset() {
    setPlayerHand([]); setDealerHand([]);
    setSplitHand(null); setSplitBet(0);
    setSideBetPP(0); setSideBet21(0);
    setInsurance(false); setInsuranceBet(0);
    setBet(lastBet); setPhase("betting"); setActiveHand("main");
    setMessage("Place your bet!");
  }

  const CHIP_OPTIONS = [10, 50, 100, 500];
  const CHIP_COLORS = ["#065f46","#1e3a8a","#7f1d1d","#4c1d95"];

  const s = {
    app: { minHeight: "100vh", background: "#0a0e1a", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" },
    topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" },
    pill: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 13, fontWeight: "bold" },
    buyPill: { background: "linear-gradient(135deg,#7c3aed,#a855f7)", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 13, fontWeight: "bold", border: "none", cursor: "pointer" },
    lbBtn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "6px 10px", color: "white", fontSize: 14, cursor: "pointer" },
    mainContent: { display: "flex", flex: 1 },
    liveLb: { width: 54, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 6, borderRight: "1px solid rgba(255,255,255,0.06)" },
    tableZone: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 12px", gap: 10 },
    rulesStrip: { display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" },
    rule: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 7px", color: "rgba(255,255,255,0.35)", fontSize: 9 },
    handArea: { width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
    handLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 },
    score: { background: "rgba(168,85,247,0.25)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 6, padding: "1px 7px", color: "#c084fc", fontSize: 10, fontWeight: "bold" },
    cardsRow: { display: "flex", gap: 6, justifyContent: "center" },
    msg: { color: "#a855f7", fontSize: 17, fontWeight: 900, textAlign: "center" },
    bottomPanel: { background: "#111827", borderRadius: "24px 24px 0 0", padding: "14px", display: "flex", flexDirection: "column", gap: 10, position: "relative" },
    sideBetsRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 },
    sideBet: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", position: "relative", zIndex: 1 },
    sideCircle: { width: 48, height: 48, borderRadius: "50%", background: "#1e2537", border: "2px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" },
    sideCircleActive: { width: 48, height: 48, borderRadius: "50%", background: "rgba(255,215,0,0.08)", border: "2px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center" },
    sideLabel: { color: "rgba(255,255,255,0.35)", fontSize: 8, textAlign: "center", textTransform: "uppercase", maxWidth: 50, lineHeight: 1.2 },
    infoDot: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#4c1d95", border: "1px solid #7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "white", fontWeight: 900, cursor: "pointer", zIndex: 20, pointerEvents: "all" },
    chipsRow: { display: "flex", justifyContent: "center", gap: 8 },
    actionRow: { display: "flex", gap: 6 },
    act: { flex: 1, padding: "12px 4px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#1e2537", color: "white", fontSize: 12, fontWeight: "bold", cursor: "pointer", textAlign: "center" },
    dealBtn: { width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#d97706", color: "#1a0a00", fontSize: 16, fontWeight: 900, cursor: "pointer" },
  };

  if (showLeaderboard) return (
    <div style={s.app}>
      <div style={s.topbar}>
        <button onClick={() => setShowLeaderboard(false)} style={{...s.act, padding: "8px 16px", fontSize: 13, flex: "none"}}>← Back</button>
        <div style={{ color: "white", fontWeight: 900, fontSize: 16 }}>🏆 Leaderboard</div>
        <div style={{ width: 70 }} />
      </div>
      <div style={{ padding: "0 16px 8px", textAlign: "center" }}>
        <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, padding: "10px 16px", marginBottom: 12 }}>
          <div style={{ color: "#ffd700", fontSize: 13, fontWeight: "bold" }}>🏆 Weekly Tournament Prizes</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            {[["🥇","200⭐"],["🥈","75⭐"],["🥉","25⭐"]].map(([m,p],i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{m}</div>
                <div style={{ color: "#ffd700", fontSize: 12, fontWeight: 900 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px", flex: 1, overflowY: "auto" }}>
        {leaders.map((p, i) => (
          <div key={p.user_id} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: String(p.user_id) === String(userId) ? "rgba(168,85,247,0.15)" : "#161b27",
            border: String(p.user_id) === String(userId) ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "12px 16px", marginBottom: 10
          }}>
            <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>#{i+1}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: 14 }}>{p.name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>🎰 {p.total_wagered} wagered</div>
            </div>
            {i < 3 && <div style={{ color: "#ffd700", fontSize: 12, fontWeight: 900 }}>⭐ {[200,75,25][i]}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  if (showBuy) return (
    <div style={{...s.app, alignItems: "center", justifyContent: "center"}}>
      <h2 style={{ color: "#ffd700", marginBottom: 8 }}>⭐ Buy Chips</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Balance: {chips} chips</p>
      {[[10,100],[50,500],[100,1000]].map(([stars,chipsAmt]) => (
        <button key={stars} onClick={() => buyChips(stars)} disabled={buying}
          style={{ ...s.dealBtn, width: 240, marginBottom: 12, opacity: buying ? 0.6 : 1 }}>
          ⭐ {stars} Stars → {chipsAmt} chips
        </button>
      ))}
      <button onClick={() => setShowBuy(false)} style={{ ...s.act, width: 240, marginTop: 8, textAlign: "center" }}>← Back</button>
    </div>
  );

  return (
    <div style={s.app}>
      <div style={s.topbar}>
        <div style={s.pill}>🪙 {chips}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.lbBtn} onClick={() => { loadLeaderboard(); setShowLeaderboard(true); }}>🏆</button>
          <button style={s.buyPill} onClick={() => setShowBuy(true)}>+ Buy</button>
        </div>
      </div>

      <div style={s.mainContent}>
        {/* Live leaderboard sidebar */}
        <div style={s.liveLb}>
          <div style={{ color: "rgba(255,215,0,0.5)", fontSize: 8, letterSpacing: 1, writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: "bold", marginBottom: 4 }}>LIVE</div>
          {leaders.slice(0,5).map((p, i) => (
            <div key={p.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "#6d28d9" : i === 1 ? "#1e3a8a" : i === 2 ? "#065f46" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: String(p.user_id) === String(userId) ? "2px solid #ffd700" : "none" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ color: "white", fontSize: 10, fontWeight: 900 }}>#{i+1}</span>}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textAlign: "center", maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div style={{ color: "#ffd700", fontSize: 8, fontWeight: "bold" }}>{p.total_wagered > 999 ? (p.total_wagered/1000).toFixed(1)+"k" : p.total_wagered}</div>
              {i < 4 && <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />}
            </div>
          ))}
        </div>

        <div style={s.tableZone}>
          <div style={s.rulesStrip}>
            <div style={s.rule}>BJ PAYS 3:2</div>
            <div style={s.rule}>DEALER 17</div>
            <div style={s.rule}>INS 2:1</div>
          </div>

          {dealerHand.length > 0 && (
            <div style={s.handArea}>
              <div style={s.handLabel}>Dealer <span style={s.score}>{phase === "done" ? handTotal(dealerHand) : "?"}</span></div>
              <div style={s.cardsRow}>
                {dealerHand.map((card, i) => <Card key={i} card={card} hidden={phase === "playing" && i === 1} delay={i * 0.15} />)}
              </div>
            </div>
          )}

          <motion.div key={message} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={s.msg}>
            {message}
          </motion.div>

          {playerHand.length > 0 && (
            <div style={s.handArea}>
              <div style={s.handLabel}>
                {splitHand ? (activeHand === "main" ? "👉 Main" : "Main") : "You"}
                <span style={s.score}>{handTotal(playerHand)}</span>
              </div>
              <div style={s.cardsRow}>
                {playerHand.map((card, i) => <Card key={i} card={card} hidden={false} delay={i * 0.15 + 0.3} />)}
              </div>
            </div>
          )}

          {splitHand && (
            <div style={s.handArea}>
              <div style={s.handLabel}>
                {activeHand === "split" ? "👉 Split" : "Split"}
                <span style={s.score}>{handTotal(splitHand)}</span>
              </div>
              <div style={s.cardsRow}>
                {splitHand.map((card, i) => <Card key={i} card={card} hidden={false} delay={i * 0.15} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={s.bottomPanel}>
        <AnimatePresence>
          {openInfo === "pp" && <PayoutPopup title="PERFECT PAIRS" rows={PAYOUTS.perfectPairs} onClose={() => setOpenInfo(null)} />}
          {openInfo === "21" && <PayoutPopup title="21 + 3" rows={PAYOUTS.plus3} onClose={() => setOpenInfo(null)} />}
          {openInfo === "ll" && <PayoutPopup title="LUCKY LUCKY" rows={PAYOUTS.luckyLucky} onClose={() => setOpenInfo(null)} />}
        </AnimatePresence>

        {phase === "playing" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <button onClick={hit} style={{ padding: 16, borderRadius: 12, border: "none", background: "#1e2537", color: "white", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>Hit 👆</button>
            <button onClick={stand} style={{ padding: 16, borderRadius: 12, border: "none", background: "#1e2537", color: "white", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>Stand ✋</button>
            {isPair(playerHand) && !splitHand && chips >= bet && (
              <button onClick={split} style={{ padding: 16, borderRadius: 12, border: "none", background: "#1e2537", color: "white", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>Split ✂️</button>
            )}
            {playerHand.length === 2 && !splitHand && chips >= bet && (
              <button onClick={doubleDown} style={{ padding: 16, borderRadius: 12, border: "none", background: "#1e2537", color: "white", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>Double 💰</button>
            )}
          </div>
        )}

        {phase === "insurance" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <button onClick={takeInsurance} style={{ padding: 16, borderRadius: 12, border: "none", background: "#065f46", color: "white", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>✅ Insurance ({Math.floor(bet/2)})</button>
            <button onClick={declineInsurance} style={{ padding: 16, borderRadius: 12, border: "none", background: "#7f1d1d", color: "white", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>❌ Decline</button>
          </div>
        )}

        {phase === "done" && (
          <button onClick={reset} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "#d97706", color: "#1a0a00", fontSize: 16, fontWeight: 900, cursor: "pointer", marginBottom: 8 }}>🔄 New Hand</button>
        )}

        {phase === "betting" && (
          <button onClick={startGame} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "#d97706", color: "#1a0a00", fontSize: 16, fontWeight: 900, cursor: "pointer", marginBottom: 8 }}>🃏 Start Game</button>
        )}

        {/* Main Bet Row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>Main Bet</div>
          <div style={{ display: "flex", alignItems: "center", background: "#1e2537", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ flex: 1, padding: "12px 14px", color: "#ffd700", fontSize: 18, fontWeight: 900 }}>🪙 {bet}</div>
            <button onClick={() => { setBet(b => Math.max(0, Math.floor(b/2))); playChip(); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>1/2</button>
            <button onClick={() => { setBet(b => Math.min(chips, b*2)); playChip(); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>2X</button>
            <button onClick={() => { setBet(chips); playChip(); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>Max</button>
          </div>
        </div>

        {/* Chip buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {CHIP_OPTIONS.map((amt, i) => (
            <button key={amt} onClick={() => { setBet(b => Math.min(chips, b + amt)); playChip(); }}
              style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: "none", background: CHIP_COLORS[i], color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
              +{amt}
            </button>
          ))}
        </div>

        {/* Perfect Pairs Bet */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            Perfect Pairs Bet
            <span onClick={() => setOpenInfo(openInfo === "pp" ? null : "pp")} style={{ color: "#a855f7", fontSize: 12, cursor: "pointer" }}>ⓘ</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "#1e2537", borderRadius: 10, overflow: "hidden", border: sideBetPP > 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ flex: 1, padding: "12px 14px", color: sideBetPP > 0 ? "#ffd700" : "rgba(255,255,255,0.4)", fontSize: 18, fontWeight: 900 }}>🪙 {sideBetPP}</div>
            <button onClick={() => { setSideBetPP(b => b + selectedChip); playChip(); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>+{selectedChip}</button>
            <button onClick={() => { setSideBetPP(0); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* 21+3 Bet */}
        <div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            21+3 Bet
            <span onClick={() => setOpenInfo(openInfo === "21" ? null : "21")} style={{ color: "#a855f7", fontSize: 12, cursor: "pointer" }}>ⓘ</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "#1e2537", borderRadius: 10, overflow: "hidden", border: sideBet21 > 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ flex: 1, padding: "12px 14px", color: sideBet21 > 0 ? "#ffd700" : "rgba(255,255,255,0.4)", fontSize: 18, fontWeight: 900 }}>🪙 {sideBet21}</div>
            <button onClick={() => { setSideBet21(b => b + selectedChip); playChip(); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>+{selectedChip}</button>
            <button onClick={() => { setSideBet21(0); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Chip selector */}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {CHIP_OPTIONS.map((amt, i) => (
            <button key={amt} onClick={() => { setSelectedChip(amt); playChip(); }}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: selectedChip === amt ? "2px solid #ffd700" : "1px solid rgba(255,255,255,0.1)", background: selectedChip === amt ? CHIP_COLORS[i] : "rgba(255,255,255,0.05)", color: "white", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
              {amt}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}