window.addEventListener("load", async () => {
  try {
    if (!window.ethereum) {
      alert("MetaMask or Nightly wallet not detected!");
      return;
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const injected = Array.isArray(window.ethereum.providers)
      ? (window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0])
      : window.ethereum;

    window.provider = new ethers.providers.Web3Provider(injected, "any");
    window.signer = window.provider.getSigner();
    console.log("✅ Wallet injected successfully");
  } catch (err) {
    console.error("Wallet injection failed:", err);
  }
});

// ---------------- CONFIG ----------------
const CONTRACT_ADDRESS = "0x2779529ca08560a7b977a92879bdd141b2e35ae9";
const CONTRACT_ABI = [
  "function submitScore(uint256 score, string calldata discord) public payable",
  "function getLeaderboard() public view returns (string[] memory names, uint256[] memory scores)",
  "function entryFee() public view returns (uint256)"
];
// ---------------------------------------

const statusText = id("statusText");
const connectBtn = id("connectBtn");
const joinBtn = id("joinBtn");
const walletInfo = id("walletInfo");
const discordArea = id("discordArea");
const discordInput = id("discordInput");
const saveDiscordBtn = id("saveDiscordBtn");
const quizArea = id("quizArea");
const questionBox = id("questionBox");
const answersDiv = id("answers");
const prevQ = id("prevQ");
const nextQ = id("nextQ");
const submitBtn = id("submitBtn");
const finishArea = id("finishArea");
const leaderboardList = id("leaderboardList");
const refreshLb = id("refreshLb");
const adminBtn = id("adminBtn");

function id(x) { return document.getElementById(x); }
function setStatus(msg) { statusText.innerText = msg; }

let provider, signer, contract, userAddress, userDiscord = "";
let questions = [
  { q: "Is GoKite.ai a blockchain platform?", options: ["Yes","No"], correct: 0 },
  { q: "Is a wallet required to play onchain?", options: ["Yes","No"], correct: 0 },
  { q: "Can leaderboard show Discord names only?", options: ["Yes","No"], correct: 0 },
  { q: "Can questions be updated weekly?", options: ["Yes","No"], correct: 0 },
  { q: "Is this built on GoKite testnet?", options: ["Yes","No"], correct: 0 },
  { q: "Do players pay entry fee?", options: ["Yes","No"], correct: 0 },
  { q: "Are top 100 shown?", options: ["Yes","No"], correct: 0 },
  { q: "Is this UI hosted free on GitHub?", options: ["Yes","No"], correct: 0 },
  { q: "Can admin adjust scores?", options: ["Yes","No"], correct: 0 },
  { q: "Is GoKite AI L1 for AI?", options: ["Yes","No"], correct: 0 }
];
let currentIndex = 0;
let chosenAnswers = new Array(questions.length).fill(null);

// UTILITIES
function shortAddr(a) { return a ? a.slice(0, 6) + "..." + a.slice(-4) : ""; }

async function waitForEthers(timeout = 3000) {
  const interval = 150;
  const max = Math.ceil(timeout / interval);
  for (let i = 0; i < max; i++) {
    if (typeof window.ethers !== "undefined") return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return typeof window.ethers !== "undefined";
}

function pickInjectedProvider() {
  if (!window.ethereum) return null;
  if (Array.isArray(window.ethereum.providers)) {
    const mm = window.ethereum.providers.find(p => p.isMetaMask);
    return mm || window.ethereum.providers[0];
  }
  return window.ethereum;
}

// ---------------- CONNECT ----------------
async function connectWallet() {
  try {
    setStatus("🔍 Detecting wallets...");
    const haveEthers = await waitForEthers();
    if (!haveEthers) { alert("Ethers.js missing."); return; }

    const injected = pickInjectedProvider();
    if (!injected) { alert("No wallet found."); return; }

    await injected.request({ method: "eth_requestAccounts" });

    provider = new ethers.providers.Web3Provider(injected, "any");
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`;
    setStatus(`✅ Connected: ${shortAddr(userAddress)}`);

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    joinBtn.disabled = false;

    if (injected.on) {
      injected.on("accountsChanged", (accounts) => {
        if (!accounts.length) { setStatus("Wallet locked"); joinBtn.disabled = true; }
        else { userAddress = accounts[0]; walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`; }
      });
      injected.on("chainChanged", () => window.location.reload());
    }
  } catch (err) {
    console.error("connectWallet failed:", err);
    alert("Wallet connect failed: " + (err?.message || err));
    setStatus("❌ Not connected");
  }
}

// ---------------- JOIN ARENA ----------------
async function joinArena() {
  if (!contract) {
    alert("Connect wallet first.");
    return;
  }

  try {
    setStatus("⏳ Reading entry fee from contract...");
    const entryFee = await contract.entryFee();
    const feeEth = ethers.utils.formatEther(entryFee);
    console.log("Contract Fee:", feeEth);

    if (entryFee.gt(0)) {
      if (!confirm(`Entry fee is ${feeEth} KITE. Proceed?`)) {
        setStatus("Join cancelled");
        return;
      }
    }

    setStatus("⛽ Estimating gas...");
    let gasEstimate;
    try {
      gasEstimate = await contract.estimateGas.submitScore(1, "joining", { value: entryFee });
    } catch {
      gasEstimate = 300000;
      console.warn("Gas estimate failed, using fallback:", gasEstimate);
    }

    setStatus("⏳ Sending join transaction...");
    const tx = await contract.submitScore(1, "joining", {
      value: entryFee,
      gasLimit: gasEstimate
    });

    await tx.wait();
    setStatus("✅ Joined arena — enter Discord name");
    discordArea.classList.remove("hidden");
    joinBtn.disabled = true;

  } catch (e) {
    console.error("joinArena error:", e);
    alert("Join failed: " + (e?.error?.message || e?.data?.message || e?.message || e));
    setStatus("❌ Join failed");
  }
}

// ---------------- QUIZ ----------------
function renderQuestion(index) {
  if (index < 0) index = 0;
  if (index >= questions.length) index = questions.length - 1;
  currentIndex = index;
  const q = questions[index];
  questionBox.innerText = `Q${index + 1}. ${q.q}`;
  answersDiv.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = opt;
    btn.className = (chosenAnswers[index] === i) ? "selected" : "";
    btn.addEventListener("click", () => {
      chosenAnswers[index] = i;
      Array.from(answersDiv.children).forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
    });
    answersDiv.appendChild(btn);
  });
  prevQ.style.display = (index === 0) ? "none" : "inline-block";
  nextQ.style.display = (index === questions.length - 1) ? "none" : "inline-block";
  finishArea.classList.toggle("hidden", index !== questions.length - 1);
}

prevQ.addEventListener("click", () => renderQuestion(currentIndex - 1));
nextQ.addEventListener("click", () => renderQuestion(currentIndex + 1));

saveDiscordBtn.addEventListener("click", () => {
  const v = discordInput.value.trim();
  if (!v) { alert("Enter Discord name"); return; }
  userDiscord = v;
  discordArea.classList.add("hidden");
  quizArea.classList.remove("hidden");
  renderQuestion(0);
  setStatus("Quiz started");
});

// ---------------- SUBMIT SCORE ----------------
submitBtn.addEventListener("click", async () => {
  if (!contract) { alert("Not connected to contract"); return; }

  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (chosenAnswers[i] === questions[i].correct) score += 1;
    else if (chosenAnswers[i] === null) score += 0;
    else score -= 1;
  }

  try {
    setStatus("⏳ Submitting score...");
    const tx = await contract.submitScore(score, userDiscord, { value: 0 });
    await tx.wait();
    setStatus("✅ Score submitted!");
    await loadLeaderboard();
    quizArea.classList.add("hidden");
    finishArea.classList.add("hidden");
  } catch (e) {
    console.error("submit error:", e);
    alert("Transaction failed: " + (e?.error?.message || e?.message || "See console"));
    setStatus("❌ Submit failed");
  }
});

// ---------------- LEADERBOARD ----------------
refreshLb.addEventListener("click", loadLeaderboard);
async function loadLeaderboard() {
  if (!contract) { setStatus("Contract not initialized"); return; }
  setStatus("⏳ Loading leaderboard...");
  try {
    const res = await contract.getLeaderboard();
    const names = res[0] || [];
    const scores = res[1] || [];
    leaderboardList.innerHTML = "";
    for (let i = 0; i < Math.min(names.length, 100); i++) {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${names[i]} — ${scores[i]} pts`;
      leaderboardList.appendChild(li);
    }
    setStatus("✅ Leaderboard loaded");
  } catch (e) {
    console.error("loadLeaderboard error:", e);
    setStatus("Failed loading leaderboard");
  }
}

// ---------------- INIT ----------------
(async function init() {
  setStatus("Ready");
  joinBtn.disabled = true;
  discordArea.classList.add("hidden");
  quizArea.classList.add("hidden");
  finishArea.classList.add("hidden");
  connectBtn.addEventListener("click", connectWallet);
  joinBtn.addEventListener("click", joinArena);
})();
