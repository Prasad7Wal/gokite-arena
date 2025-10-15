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
const CONTRACT_ADDRESS = "0x7808378770a2e486441e486aa046c715458ba337"; // replace with your contract
const CONTRACT_ABI = [
  "function submitScore(uint256 score, string calldata discord) public payable",
  "function topPlayers() public view returns (string[] memory names, uint256[] memory scores)",
  "function entryFee() public view returns (uint256)",
  "function walletToDiscord(address user) public view returns(string memory)" // <-- add if contract supports wallet->discord
];
// ---------------------------------------

const questionSetId = 1;

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
const yourRankArea = id("yourRankArea");

function id(x){return document.getElementById(x);}
function setStatus(msg){statusText.innerText = msg;}

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

function shortAddr(a){return a?a.slice(0,6)+"..."+a.slice(-4):"";}
function pickInjectedProvider(){
  if(!window.ethereum)return null;
  if(Array.isArray(window.ethereum.providers)){
    const mm = window.ethereum.providers.find(p=>p.isMetaMask);
    return mm||window.ethereum.providers[0];
  }
  return window.ethereum;
}
function hasSubmittedBefore(){if(!userAddress)return false;const key=`submitted_${userAddress}_${questionSetId}`;return localStorage.getItem(key)==="true";}
function markSubmitted(){if(!userAddress)return;const key=`submitted_${userAddress}_${questionSetId}`;localStorage.setItem(key,"true");}

// ---------------- CONNECT ----------------
async function connectWallet(){
  try{
    setStatus("🔍 Detecting wallets...");
    const injected = pickInjectedProvider();
    if(!injected){alert("No wallet found.");return;}

    await injected.request({method:"eth_requestAccounts"});
    provider = new ethers.providers.Web3Provider(injected,"any");
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    walletInfo.innerText = `Connected: ${shortAddr(userAddress)}`;
    setStatus(`✅ Connected: ${shortAddr(userAddress)}`);

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    joinBtn.disabled = hasSubmittedBefore();

    if(injected.on){
      injected.on("accountsChanged", accounts=>{
        if(!accounts.length){setStatus("Wallet locked"); joinBtn.disabled=true;}
        else{userAddress=accounts[0]; walletInfo.innerText=`Connected: ${shortAddr(userAddress)}`; joinBtn.disabled=hasSubmittedBefore();}
      });
      injected.on("chainChanged",()=>window.location.reload());
    }

    // Get Discord from contract if wallet already submitted
    try{
      const savedDiscord = await contract.walletToDiscord(userAddress);
      if(savedDiscord && savedDiscord!==""){
        userDiscord = savedDiscord;
        discordArea.classList.add("hidden");
      }
    }catch(e){console.log("walletToDiscord not available or failed");}

    await loadLeaderboard();
  }catch(err){
    console.error("connectWallet failed:",err);
    alert("Wallet connect failed: "+(err?.message||err));
    setStatus("❌ Not connected");
  }
}

// ---------------- JOIN ARENA ----------------
async function joinArena(){
  if(!contract){alert("Connect wallet first.");return;}
  if(hasSubmittedBefore()){alert("You already submitted this question set."); return;}

  try{
    setStatus("⏳ Reading entry fee from contract...");
    const entryFee = await contract.entryFee();
    const feeEth = ethers.utils.formatEther(entryFee);

    if(entryFee.gt(0)){
      if(!confirm(`Entry fee is ${feeEth} KITE. Proceed?`)){setStatus("Join cancelled");return;}
    }

    setStatus("⏳ Sending join transaction...");
    const gasEstimate = await contract.estimateGas.submitScore(1,"joining",{value:entryFee}).catch(()=>300000);
    const tx = await contract.submitScore(1,"joining",{value:entryFee,gasLimit:gasEstimate});
    await tx.wait();

    setStatus("✅ Joined arena — enter Discord name");
    discordArea.classList.remove("hidden");
    joinBtn.disabled = true;
  }catch(e){
    console.error("joinArena error:",e);
    alert("Join failed: "+(e?.error?.message||e?.message||"See console"));
    setStatus("❌ Join failed");
  }
}

// ---------------- QUIZ ----------------
function renderQuestion(index){
  if(index<0)index=0;if(index>=questions.length)index=questions.length-1;
  currentIndex=index;
  const q=questions[index];
  questionBox.innerText=`Q${index+1}. ${q.q}`;
  answersDiv.innerHTML="";
  q.options.forEach((opt,i)=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.innerText=opt;
    btn.className=(chosenAnswers[index]===i)?"selected":"";
    btn.addEventListener("click",()=>{chosenAnswers[index]=i;Array.from(answersDiv.children).forEach(c=>c.classList.remove("selected"));btn.classList.add("selected");});
    answersDiv.appendChild(btn);
  });
  prevQ.style.display=(index===0)?"none":"inline-block";
  nextQ.style.display=(index===questions.length-1)?"none":"inline-block";
  finishArea.classList.toggle("hidden",index!==questions.length-1);
}

prevQ.addEventListener("click",()=>renderQuestion(currentIndex-1));
nextQ.addEventListener("click",()=>renderQuestion(currentIndex+1));

saveDiscordBtn.addEventListener("click",()=>{
  const v=discordInput.value.trim();
  if(!v){alert("Enter Discord name");return;}
  userDiscord=v;
  discordArea.classList.add("hidden");
  quizArea.classList.remove("hidden");
  renderQuestion(0);
  setStatus("Quiz started");
});

// ---------------- SUBMIT SCORE ----------------
submitBtn.addEventListener("click",async ()=>{
  if(!contract){alert("Not connected to contract");return;}
  if(hasSubmittedBefore()){alert("You already submitted this question set.");return;}

  let score=0;
  for(let i=0;i<questions.length;i++){
    if(chosenAnswers[i]===questions[i].correct)score+=1;
    else if(chosenAnswers[i]===null)score+=0;
    else score-=1;
  }

  try{
    setStatus("⏳ Submitting score...");
    const entryFee = await contract.entryFee();
    const gasEstimate = await contract.estimateGas.submitScore(score,userDiscord,{value:entryFee}).catch(()=>300000);
    const tx = await contract.submitScore(score,userDiscord,{value:entryFee,gasLimit:gasEstimate});
    await tx.wait();

    setStatus("✅ Score submitted!");
    markSubmitted();
    await loadLeaderboard();
    quizArea.classList.add("hidden");
    finishArea.classList.add("hidden");
  }catch(e){console.error("submit error:",e);alert("Transaction failed: "+(e?.error?.message||e?.message||"See console"));setStatus("❌ Submit failed");}
});

// ---------------- LEADERBOARD ----------------
refreshLb.addEventListener("click",loadLeaderboard);
async function loadLeaderboard(){
  if(!contract){setStatus("Contract not initialized");return;}
  setStatus("⏳ Loading leaderboard...");
  try{
    const [names,scores]=await contract.topPlayers();
    leaderboardList.innerHTML="";

    for(let i=0;i<Math.min(names.length,100);i++){
      const li=document.createElement("li");
      li.textContent=`${i+1}. ${names[i]} — ${scores[i]} pts`;
      if(names[i]===userDiscord)li.style.fontWeight="700";
      leaderboardList.appendChild(li);
    }

    // Find user's rank
    let userRank=null;
    if(userDiscord){
      for(let i=0;i<names.length;i++){
        if(names[i]===userDiscord){userRank=i+1;break;}
      }
    }
    yourRankArea.innerText=userRank?`Your rank: ${userRank}`:"Your rank: Not yet submitted";

    // Auto-scroll if user outside top 100
    if(userRank&&userRank>100){
      const li=document.createElement("li");
      li.textContent=`${userRank}. ${userDiscord} — ${scores[userRank-1]} pts`;
      li.style.fontWeight="700";
      li.style.background="#f0e3d9";
      leaderboardList.appendChild(li);
      li.scrollIntoView({behavior:"smooth"});
    }

    setStatus("✅ Leaderboard loaded");
  }catch(e){console.error("loadLeaderboard error:",e);setStatus("Failed loading leaderboard");}
}

// ---------------- INIT ----------------
(async function init(){
  setStatus("Ready");
  joinBtn.disabled=true;
  discordArea.classList.add("hidden");
  quizArea.classList.add("hidden");
  finishArea.classList.add("hidden");
  connectBtn.addEventListener("click",connectWallet);
  joinBtn.addEventListener("click",joinArena);
})();
