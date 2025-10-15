// script.js

// ---------------- UTILITIES ----------------
function id(x){return document.getElementById(x);}
function setStatus(msg){id("statusText").innerText = msg;}
function shortAddr(a){return a ? a.slice(0,6) + "..." + a.slice(-4) : "";}

// ---------------- CONFIG ----------------
const CONTRACT_ADDRESS = "0x7808378770a2e486441e486aa046c715458ba337";
const CONTRACT_ABI = [
  "function submitScore(uint256 score, string calldata discord) public payable",
  "function topPlayers() public view returns (string[] memory names, uint256[] memory scores)",
  "function entryFee() public view returns (uint256)"
];
const ADMIN_WALLET = "0x4c38A7aB0D6A493Ad209fe9AfD63ca68a3866002";

// ---------------- GLOBAL STATE ----------------
let provider, signer, contract;
let userAddress, userDiscord = "";
let questions = [
  {q:"Is GoKite.ai a blockchain platform?",options:["Yes","No"],correct:0},
  {q:"Is a wallet required to play onchain?",options:["Yes","No"],correct:0},
  {q:"Can leaderboard show Discord names only?",options:["Yes","No"],correct:0},
  {q:"Can questions be updated weekly?",options:["Yes","No"],correct:0},
  {q:"Is this built on GoKite testnet?",options:["Yes","No"],correct:0},
  {q:"Do players pay entry fee?",options:["Yes","No"],correct:0},
  {q:"Are top 100 shown?",options:["Yes","No"],correct:0},
  {q:"Is this UI hosted free on GitHub?",options:["Yes","No"],correct:0},
  {q:"Can admin adjust scores?",options:["Yes","No"],correct:0},
  {q:"Is GoKite AI L1 for AI?",options:["Yes","No"],correct:0}
];
let currentIndex = 0;
let chosenAnswers = new Array(questions.length).fill(null);
let connectedWallet = null;
let isAdmin = false;
let adminList = [ADMIN_WALLET];

// ---------------- DOM ----------------
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
const finishArea = id("finishArea");
const submitBtn = id("submitBtn");
const leaderboardList = id("leaderboardList");
const refreshLb = id("refreshLb");
const yourRankArea = id("yourRankArea");
const adminPanel = id("adminPanel");
const adminVerifyBtn = id("adminVerifyBtn");

// ---------------- LOCAL STORAGE KEYS ----------------
function discordKey(addr){return `discord_${addr.toLowerCase()}`;}
function submittedKey(addr){return `submitted_${addr.toLowerCase()}`;}

// ---------------- PLAYER WALLET ----------------
async function connectWallet() {
  try {
    setStatus("🔍 Detecting wallet...");
    const injected = window.ethereum || (Array.isArray(window.ethereum?.providers) ? window.ethereum.providers.find(p=>p.isMetaMask) : null);
    if(!injected){alert("No wallet found."); return;}
    await injected.request({method:"eth_requestAccounts"});
    provider = new ethers.providers.Web3Provider(injected,"any");
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`;
    setStatus(`✅ Connected: ${shortAddr(userAddress)}`);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Load Discord
    const storedDiscord = localStorage.getItem(discordKey(userAddress));
    if(storedDiscord){userDiscord = storedDiscord;}

    // Enable join only if not submitted
    joinBtn.disabled = localStorage.getItem(submittedKey(userAddress))==="true";

    // Wallet event listeners
    if(injected.on){
      injected.on("accountsChanged", async accounts=>{
        if(!accounts.length){setStatus("Wallet locked"); joinBtn.disabled=true; return;}
        userAddress = accounts[0];
        walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`;
        userDiscord = localStorage.getItem(discordKey(userAddress)) || "";
        joinBtn.disabled = localStorage.getItem(submittedKey(userAddress"))==="true";
        await loadLeaderboard();
      });
      injected.on("chainChanged",()=>window.location.reload());
    }

    await loadLeaderboard();
  } catch(err){
    console.error("connectWallet failed:",err);
    alert("Wallet connect failed: "+(err?.message||err));
    setStatus("❌ Not connected");
  }
}

// ---------------- JOIN ARENA ----------------
async function joinArena() {
  if(!contract){alert("Connect wallet first."); return;}
  if(localStorage.getItem(submittedKey(userAddress))==="true"){alert("You already submitted."); return;}
  try {
    setStatus("⏳ Reading entry fee...");
    const entryFee = await contract.entryFee();
    if(entryFee.gt(0)){
      const feeEth = ethers.utils.formatEther(entryFee);
      if(!confirm(`Entry fee is ${feeEth} KITE. Proceed?`)){ setStatus("Join cancelled"); return;}
    }
    setStatus("⏳ Sending join transaction...");
    const gasEstimate = await contract.estimateGas.submitScore(1,"joining",{value:entryFee}).catch(()=>300000);
    const tx = await contract.submitScore(1,"joining",{value:entryFee, gasLimit:gasEstimate});
    await tx.wait();
    setStatus("✅ Joined arena — enter Discord name");
    discordArea.classList.remove("hidden");
    joinBtn.disabled = true;
  } catch(e){
    console.error("joinArena error:", e);
    alert("Join failed: "+(e?.error?.message||e?.message||"See console"));
    setStatus("❌ Join failed");
  }
}

// ---------------- QUIZ ----------------
function renderQuestion(index){
  if(index<0)index=0;
  if(index>=questions.length)index=questions.length-1;
  currentIndex=index;
  const q=questions[index];
  questionBox.innerText=`Q${index+1}. ${q.q}`;
  answersDiv.innerHTML="";
  q.options.forEach((opt,i)=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.innerText=opt;
    btn.className=(chosenAnswers[index]===i)?"selected":"";
    btn.addEventListener("click",()=>{
      chosenAnswers[index]=i;
      Array.from(answersDiv.children).forEach(c=>c.classList.remove("selected"));
      btn.classList.add("selected");
    });
    answersDiv.appendChild(btn);
  });
  prevQ.style.display=(index===0)?"none":"inline-block";
  nextQ.style.display=(index===questions.length-1)?"none":"inline-block";
  finishArea.classList.toggle("hidden", index!==questions.length-1);
}
prevQ.addEventListener("click",()=>renderQuestion(currentIndex-1));
nextQ.addEventListener("click",()=>renderQuestion(currentIndex+1));
saveDiscordBtn.addEventListener("click",()=>{
  const v = discordInput.value.trim();
  if(!v){alert("Enter Discord name"); return;}
  userDiscord=v;
  localStorage.setItem(discordKey(userAddress),v);
  discordArea.classList.add("hidden");
  quizArea.classList.remove("hidden");
  renderQuestion(0);
  setStatus("Quiz started");
});
submitBtn.addEventListener("click", async()=>{
  if(!contract){alert("Not connected to contract"); return;}
  if(localStorage.getItem(submittedKey(userAddress))==="true"){alert("Already submitted."); return;}
  let score=0;
  for(let i=0;i<questions.length;i++){
    if(chosenAnswers[i]===questions[i].correct)score+=1;
    else if(chosenAnswers[i]!==null)score-=1;
  }
  try {
    setStatus("⏳ Submitting score...");
    const entryFee = await contract.entryFee();
    const gasEstimate = await contract.estimateGas.submitScore(score,userDiscord,{value:entryFee}).catch(()=>300000);
    const tx = await contract.submitScore(score,userDiscord,{value:entryFee, gasLimit:gasEstimate});
    await tx.wait();
    setStatus("✅ Score submitted!");
    localStorage.setItem(submittedKey(userAddress),"true");
    await loadLeaderboard();
    quizArea.classList.add("hidden");
    finishArea.classList.add("hidden");
  } catch(e){
    console.error("submit error:",e);
    alert("Transaction failed: "+(e?.error?.message||e?.message||"See console"));
    setStatus("❌ Submit failed");
  }
});

// ---------------- LEADERBOARD ----------------
refreshLb.addEventListener("click", loadLeaderboard);
async function loadLeaderboard(){
  if(!contract){setStatus("Contract not initialized"); return;}
  setStatus("⏳ Loading leaderboard...");
  try{
    const [names,scores] = await contract.topPlayers();
    leaderboardList.innerHTML="";
    for(let i=0;i<Math.min(names.length,100);i++){
      const li=document.createElement("li");
li.textContent=${i+1}. ${names[i]} — ${scores[i]} pts;
if(names[i]===userDiscord)li.style.fontWeight="700";
leaderboardList.appendChild(li);
}
let userRank=null;
if(userDiscord){
for(let i=0;i<names.length;i++){if(names[i]===userDiscord){userRank=i+1; break;}}
}
yourRankArea.innerText=userRank?Your rank: ${userRank}:"Your rank: Not yet submitted";
if(userRank && userRank>100){
const li=document.createElement("li");
li.textContent=${userRank}. ${userDiscord} — ${scores[userRank-1]} pts;
li.style.fontWeight="700";
li.style.background="#f0e3d9";
leaderboardList.appendChild(li);
li.scrollIntoView({behavior:"smooth"});
}
setStatus("✅ Leaderboard loaded");
} catch(e){
console.error("loadLeaderboard error:",e);
setStatus("Failed loading leaderboard");
}
}

// ---------------- ADMIN ----------------
adminVerifyBtn.addEventListener("click", async()=>{
if(!window.ethereum) return alert("Install MetaMask first");
try{
const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
const wallet = accounts[0].toLowerCase();
if(wallet === ADMIN_WALLET.toLowerCase() || adminList.includes(wallet)){
isAdmin = true;
adminPanel.classList.remove("hidden");
alert("✅ Admin verified. Dashboard unlocked.");
} else {
const code = prompt("Enter Admin password:");
if(code === "admin code"){
isAdmin = true;
adminList.push(wallet);
adminPanel.classList.remove("hidden");
alert("✅ Admin verified with code. Dashboard unlocked.");
} else {
alert("❌ Not authorized.");
}
}
} catch(e){ console.error(e); alert("Admin verification failed."); }
});

// Admin Functions
function addQuestion() {
if(!isAdmin) return alert("Only admin can add questions!");
const question = id("newQuestion").value.trim();
if(!question) return alert("Please enter a question.");
questions.push({q:question,options:[id("optA").value,id("optB").value],correct:parseInt(id("correctOpt").value)});
id("newQuestion").value=id("optA").value=id("optB").value=id("correctOpt").value="";
alert("Question added successfully!");
}

function updatePlayerScore() {
if(!isAdmin) return alert("Only admin can update scores!");
const player = id("playerName").value.trim();
const score = parseInt(id("playerScore").value);
if(!player || isNaN(score)) return alert("Fill player name and score");
alert(${player}'s score updated to ${score}. (On-chain update requires contract interaction));
}

function grantAdminRights() {
if(!isAdmin) return alert("Unauthorized");
const wallet = prompt("Enter wallet address to grant admin rights:");
if(!wallet) return;
adminList.push(wallet.toLowerCase());
alert(Granted admin rights to ${wallet});
}

function removeAdminRights() {
if(!isAdmin) return alert("Unauthorized");
const wallet = prompt("Enter wallet address to remove admin rights:");
if(!wallet) return;
adminList = adminList.filter(a=>a!==wallet.toLowerCase());
alert(Removed admin rights from ${wallet});
}

// ---------------- INIT ----------------
(async function init(){
setStatus("Ready");
joinBtn.disabled=true;
discordArea.classList.add("hidden");
quizArea.classList.add("hidden");
finishArea.classList.add("hidden");
connectBtn.addEventListener("click", connectWallet);
joinBtn.addEventListener("click", joinArena);
id("addQuestionBtn")?.addEventListener("click", addQuestion);
id("updateScoreBtn")?.addEventListener("click", updatePlayerScore);
id("grantAdminBtn")?.addEventListener("click", grantAdminRights);
id("removeAdminBtn")?.addEventListener("click", removeAdminRights);
})();
