window.addEventListener('load', async () => {
  if (typeof window.ethereum === 'undefined') {
    alert('MetaMask not detected!');
    return;
  }

  await ethereum.request({ method: 'eth_requestAccounts' });
  window.provider = new ethers.providers.Web3Provider(window.ethereum);
  console.log('Ethers loaded successfully');
});

// script.js
// Defensive, production-pattern client for GoKite Quiz dApp (reads deployed contract address)

// ---------------- CONFIG - update these if contract/chain changes ----------------
const CONTRACT_ADDRESS = "0x2779529ca08560a7b977a92879bdd141b2e35ae9"; // your deployed quiz contract
const CONTRACT_ABI = [
  // keep minimal required; this must match contract
  "function submitScore(uint256 score, string calldata discord) public payable",
  "function getLeaderboard() public view returns (string[] memory names, uint256[] memory scores)",
  "function entryFee() public view returns (uint256)"
];
// ---------------------------------------------------------------------------------

// UI elements
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
const adminPwd = id("adminPwd");

// Tiny helper
function id(x){ return document.getElementById(x); }
function setStatus(msg){ statusText.innerText = msg; }

// internal state
let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let userDiscord = "";
let questions = [
  // sample default questions (editable via admin in future)
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

// --- utility: wait for ethers to be present (retries) ---
async function waitForEthers(timeout=3000){
  const interval = 150;
  const max = Math.ceil(timeout / interval);
  for(let i=0;i<max;i++){
    if(typeof window.ethers !== "undefined") return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return typeof window.ethers !== "undefined";
}

// pick correct injected provider when multiple (MetaMask + others)
function pickInjectedProvider() {
  if(!window.ethereum) return null;
  if(Array.isArray(window.ethereum.providers)){
    // prefer MetaMask
    const mm = window.ethereum.providers.find(p => p.isMetaMask);
    if(mm) return mm;
    return window.ethereum.providers[0];
  }
  return window.ethereum;
}

// connect wallet (very defensive)
async function connectWallet(){
  try{
    setStatus("🔍 Waiting for Ethers library...");
    const haveEthers = await waitForEthers(3000);
    if(!haveEthers) { alert("Ethers.js not loaded — refresh the page."); setStatus("Ethers missing"); return; }

    setStatus("🔍 Detecting wallets...");
    const injected = pickInjectedProvider();
    if(!injected){ alert("No injected wallet found. Install MetaMask or compatible wallet."); setStatus("No wallet"); return; }

    // Request accounts (wallet UI will popup)
    await injected.request({ method: "eth_requestAccounts" });

    // Create provider & signer (use chosen provider)
    provider = new ethers.providers.Web3Provider(injected, "any");
    signer = provider.getSigner();

    // read address
    try{
      userAddress = await signer.getAddress();
    }catch(e){
      console.warn("getAddress failed initially; retrying...");
      await new Promise(r=>setTimeout(r,300));
      userAddress = await signer.getAddress();
    }

    walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`;
    setStatus(`✅ Connected: ${shortAddr(userAddress)}`);

    // instantiate contract (with signer so we can send txns)
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // enable join button
    joinBtn.disabled = false;

    // listen for account/chain changes
    if(injected.on){
      injected.on("accountsChanged", (accounts)=>{
        if(!accounts || accounts.length===0){ setStatus("Wallet locked"); walletInfo.innerText = ""; joinBtn.disabled = true; }
        else { userAddress = accounts[0]; walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`; }
      });
      injected.on("chainChanged", ()=>{ setStatus("Chain changed — reload"); window.location.reload(); });
    }
  }catch(err){
    console.error("connectWallet failed:", err);
    alert("Wallet connect failed: " + (err && err.message ? err.message : err));
    setStatus("❌ Not connected");
  }
}

function shortAddr(a){ if(!a) return ""; return a.slice(0,6) + "..." + a.slice(-4); }

// --- join arena: pay fee (if any) then reveal discord input
async function joinArena(){
  if(!contract){ alert("Connect wallet first."); return; }
  setStatus("⏳ Checking entry fee...");
  try{
    // read entryFee; fallback to zero on error
    let fee = ethers.BigNumber.from(0);
    try{
      fee = await contract.entryFee();
    }catch(e){
      console.warn("entryFee read failed (contract may not implement), using 0", e);
      fee = ethers.BigNumber.from(0);
    }

    if(fee.gt(0)){
      const feeEth = ethers.utils.formatEther(fee);
      const ok = confirm(`Entry fee is ${feeEth} KITE (testnet). Pay and join?`);
      if(!ok){ setStatus("Join cancelled"); return; }
    }

    setStatus("⏳ Sending join transaction (if required)...");
    // Use submitScore(0, discord) as "join" if contract expects payable submit
    // We'll send zero score and value = fee
    const tx = await contract.submitScore(0, "joining", { value: fee });
    await tx.wait();
    setStatus("✅ Joined arena on-chain — enter your Discord name");
    // show discord area
    discordArea.classList.remove("hidden");
    joinBtn.disabled = true;
  }catch(e){
    console.error("joinArena error:", e);
    // show clearer messages for common issues
    if(e && e.error && e.error.message) alert("On-chain error: " + e.error.message);
    else if(e && e.data && e.data.message) alert("On-chain error: " + e.data.message);
    else alert("Join failed: " + (e && e.message ? e.message : e));
    setStatus("❌ Join failed");
  }
}

// --- quiz UI rendering & flow ---
function renderQuestion(index){
  if(index < 0) index = 0;
  if(index >= questions.length) index = questions.length-1;
  currentIndex = index;
  const q = questions[index];
  questionBox.innerText = `Q${index+1}. ${q.q}`;
  answersDiv.innerHTML = "";
  q.options.forEach((opt, i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = opt;
    btn.className = (chosenAnswers[index] === i) ? "selected" : "";
    btn.addEventListener("click", ()=>{
      chosenAnswers[index] = i;
      // visual selected
      Array.from(answersDiv.children).forEach(c=>c.classList.remove("selected"));
      btn.classList.add("selected");
    });
    answersDiv.appendChild(btn);
  });
  // prev/next visibility
  prevQ.style.display = (index===0) ? "none" : "inline-block";
  nextQ.style.display = (index===questions.length-1) ? "none" : "inline-block";
  // show submit area only on last
  if(index===questions.length-1) finishArea.classList.remove("hidden"); else finishArea.classList.add("hidden");
}

// navigation
prevQ.addEventListener("click", ()=>{ renderQuestion(currentIndex-1); });
nextQ.addEventListener("click", ()=>{ renderQuestion(currentIndex+1); });

// save discord & start quiz
saveDiscordBtn.addEventListener("click", ()=>{
  const v = discordInput.value.trim();
  if(!v){ alert("Enter your Discord name (will be visible on leaderboard)"); return; }
  userDiscord = v;
  discordArea.classList.add("hidden");
  quizArea.classList.remove("hidden");
  renderQuestion(0);
  setStatus("Quiz started (answers saved locally until submit)");
});

// submit quiz -> onchain submitScore(score, discord)
submitBtn.addEventListener("click", async ()=>{
  if(!contract){ alert("Not connected to contract"); return; }
  // calculate score
  let score = 0;
  for(let i=0;i<questions.length;i++){
    if(chosenAnswers[i] === questions[i].correct) score += 1;
    else if(chosenAnswers[i] === null) score += 0; // unanswered -> 0
    else score -= 1; // wrong -> -1 as requested
  }
  if(!userDiscord){ alert("Discord name missing"); return; }

  try{
    setStatus("⏳ Submitting score on-chain...");
    // Some contracts require value or not; here we send zero value for submission
    await contract.submit(score, username, { value: ethers.utils.parseEther("0.001") });

    await tx.wait();
    setStatus("✅ Score submitted!");
    // after submit, refresh leaderboard
    await loadLeaderboard();
    // hide quiz
    quizArea.classList.add("hidden");
    finishArea.classList.add("hidden");
  }catch(e){
    console.error("submit error:", e);
    // show friendly message
    if(e && e.error && e.error.message) alert("Transaction failed: " + e.error.message);
    else if(e && e.message) alert("Transaction failed: " + e.message);
    else alert("Transaction failed (see console).");
    setStatus("❌ Submit failed");
  }
});

// refresh leaderboard UI
refreshLb.addEventListener("click", loadLeaderboard);

// load leaderboard from contract (defensive)
async function loadLeaderboard(){
  if(!contract){ setStatus("Contract not initialized"); return; }
  setStatus("⏳ Loading leaderboard...");
  try{
    const res = await contract.getLeaderboard();
    // res may be array-like [names, scores]
    const names = res[0] || [];
    const scores = res[1] || [];
    leaderboardList.innerHTML = "";
    for(let i=0;i<Math.min(names.length, 100); i++){
      const li = document.createElement("li");
      li.textContent = `${i+1}. ${names[i]} — ${scores[i]} pts`;
      leaderboardList.appendChild(li);
    }
    setStatus("✅ Leaderboard loaded");
  }catch(e){
    console.error("loadLeaderboard error:", e);
    setStatus("Failed loading leaderboard");
  }
}

// admin simple client-side password to edit questions or score (client-only)
adminBtn.addEventListener("click", ()=>{
  const pwd = adminPwd.value || "";
  // change this code to a secure mechanism later; this is local-only
  if(pwd === "prasad_admin_secret_713"){ // <--- change this value in your deployed site code if desired
    const cmd = prompt("Admin: type 'questions' to change questions, 'reset' to clear answers, or 'setq' to edit a question by index");
    if(cmd === "questions"){
      const raw = prompt("Paste a JSON array of questions (each {q, options[], correct})", JSON.stringify(questions, null, 2));
      try{
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed) && parsed.length>0){
          questions = parsed;
          chosenAnswers = new Array(questions.length).fill(null);
          alert("Questions updated locally. Save to GitHub to persist.");
        }else alert("Invalid structure");
      }catch(err){ alert("Invalid JSON"); }
    }else if(cmd === "reset"){
      chosenAnswers = new Array(questions.length).fill(null);
      alert("Answers cleared");
    }else if(cmd === "setq"){
      const idx = parseInt(prompt("Question index (1-based):")) - 1;
      if(isNaN(idx) || idx<0 || idx>=questions.length){ alert("Invalid index"); return; }
      const raw = prompt("Replace question JSON:", JSON.stringify(questions[idx], null, 2));
      try{
        const val = JSON.parse(raw);
        questions[idx] = val;
        alert("Question updated locally");
      }catch(e){ alert("Bad JSON"); }
    }else alert("Unknown admin command");
  }else{
    alert("Wrong admin password");
  }
});

// initialize UI on load
(async function init(){
  setStatus("Ready");
  // disable buttons until provider is present
  joinBtn.disabled = true;
  discordArea.classList.add("hidden");
  quizArea.classList.add("hidden");
  finishArea.classList.add("hidden");

  // wire main buttons
  connectBtn.addEventListener("click", connectWallet);
  joinBtn.addEventListener("click", joinArena);

  // If ethers isn't loaded, show clear message
  if(typeof window.ethers === "undefined"){
    setStatus("Ethers.js not loaded, please refresh");
    console.error("Ethers missing");
    alert("Ethers.js not loaded. Refresh the page or check network.");
    return;
  }

  // Optionally auto-load leaderboard if contract readable via default provider
  try{
    // Attempt to make a read-only contract using the provider if window.ethereum exists
    const injected = pickInjectedProvider();
    if(injected){
      const readProvider = new ethers.providers.Web3Provider(injected, "any");
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
      // try calling getLeaderboard without signer — some RPCs allow this
      await readContract.getLeaderboard().then(()=>{ /* ok */ }).catch(()=>{/* ignore */});
    }
  }catch(e){ /* ignore */ }
})();
