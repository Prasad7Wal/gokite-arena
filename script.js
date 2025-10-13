// --- DOM Elements ---
const statusText = document.getElementById("statusText");
const connectBtn = document.getElementById("connectWalletBtn");
const joinBtn = document.getElementById("joinArenaBtn");
const discordDiv = document.getElementById("discordDiv");
const saveDiscordBtn = document.getElementById("saveDiscordBtn");
const discordInput = document.getElementById("discordName");
const quizDiv = document.getElementById("quizDiv");
const questionText = document.getElementById("questionText");
const answersDiv = document.getElementById("answers");
const leaderboardUl = document.getElementById("leaderboard");

// --- CONTRACT CONFIG ---
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
const abi = [
  "function joinArena() payable",
  "function updateScore(uint256 _score, string calldata _discord)",
  "function topPlayers() view returns (string[] memory, uint256[] memory)"
];

let provider, signer, contract, userAddress;
let userDiscord = "";
let score = 0;
let currentQuestion = 0;

const quizQuestions = [
  { q: "What is GoKite AI?", a: ["Blockchain platform", "App", "Video codec", "Database"], correct: 0 },
  { q: "Token symbol used?", a: ["KITE","ETH","BTC","SOL"], correct: 0 },
  { q: "Wallet required?", a: ["Yes","No","Optional","Later"], correct: 0 },
  { q: "Quiz questions per round?", a: ["10","5","20","15"], correct: 0 },
  { q: "Points for correct?", a: ["1","2","5","0"], correct: 0 },
  { q: "Points for wrong?", a: ["-1","0","1","2"], correct: 0 },
  { q: "Leaderboard shows?", a: ["Discord","Wallet","Email","Name"], correct: 0 },
  { q: "Deposit amount?", a: ["0.01","0.1","1","0.001"], correct: 0 },
  { q: "Should wait for provider?", a: ["Yes","No","Sometimes","Never"], correct: 0 },
  { q: "Hosting free on GitHub Pages?", a: ["Yes","No","Only paid","Server needed"], correct: 0 }
];

// --- STATUS HELPER ---
function setStatus(msg){ statusText.innerText = msg; }

// --- Safe Wallet Provider ---
async function getProviderSafe(timeout=5000){
  const interval=200;
  const attempts=Math.ceil(timeout/interval);
  for(let i=0;i<attempts;i++){
    if(window.ethereum){
      if(Array.isArray(window.ethereum.providers)){
        const mm=window.ethereum.providers.find(p=>p.isMetaMask);
        return mm||window.ethereum.providers[0];
      }
      return window.ethereum;
    }
    await new Promise(r=>setTimeout(r,interval));
  }
  throw new Error("No Ethereum wallet detected.");
}

// --- CONNECT WALLET ---
async function connectWallet(){
  try{
    setStatus("Detecting wallet...");
    const ethereum = await getProviderSafe();
    await ethereum.request({ method:"eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(ethereum,"any");
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    setStatus(`✅ Connected: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`);
    connectBtn.disabled=true;
    joinBtn.disabled=false;

    contract = new ethers.Contract(contractAddress, abi, signer);

    ethereum.on("accountsChanged", accounts=>{
      if(accounts.length===0){
        setStatus("Wallet locked");
        connectBtn.disabled=false;
        joinBtn.disabled=true;
      }else{
        userAddress=accounts[0];
        setStatus(`✅ Connected: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`);
      }
    });

    ethereum.on("chainChanged", ()=>window.location.reload());

  }catch(err){
    console.error("Wallet connect failed:", err);
    alert(err.message||err);
    setStatus("❌ Not connected");
  }
}

// --- JOIN ARENA ---
async function joinArena(){
  if(!contract) return alert("Connect wallet first!");
  try{
    setStatus("Joining arena...");
    const tx = await contract.joinArena({value:ethers.parseEther("0.01")});
    await tx.wait();
    setStatus("🎉 Joined Arena successfully! Enter Discord name to start quiz.");
    discordDiv.classList.remove("hidden");
    joinBtn.disabled=true;
  }catch(e){
    console.error(e);
    alert("Join arena failed: "+(e.message||e));
  }
}

// --- QUIZ ---
function startQuiz(){
  const name = discordInput.value.trim();
  if(!name) return alert("Enter Discord name!");
  userDiscord=name; score=0; currentQuestion=0;
  discordDiv.classList.add("hidden");
  quizDiv.classList.remove("hidden");
  loadQuestion();
}

function loadQuestion(){
  if(currentQuestion>=quizQuestions.length) return finishQuiz();
  const q=quizQuestions[currentQuestion];
  questionText.textContent=q.q;
  answersDiv.innerHTML="";
  q.a.forEach((ans,idx)=>{
    const btn=document.createElement("button");
    btn.textContent=ans;
    btn.onclick=()=>{
      score+=(idx===q.correct?1:-1);
      currentQuestion++;
      loadQuestion();
    };
    answersDiv.appendChild(btn);
  });
}

async function finishQuiz(){
  quizDiv.classList.add("hidden");
  setStatus("Submitting score...");
  try{
    const tx = await contract.updateScore(score,userDiscord);
    await tx.wait();
    setStatus("✅ Score submitted!");
    await loadLeaderboard();
  }catch(e){
    console.error(e);
    alert("Submit score failed: "+(e.message||e));
    setStatus("❌ Score submit failed");
  }
}

// --- LEADERBOARD ---
async function loadLeaderboard(){
  if(!contract) return;
  setStatus("Loading leaderboard...");
  try{
    const [names,scores] = await contract.topPlayers();
    leaderboardUl.innerHTML="";
    for(let i=0;i<Math.min(names.length,100);i++){
      const li=document.createElement("li");
      li.textContent=`${i+1}. ${names[i]} — ${scores[i]} pts`;
      leaderboardUl.appendChild(li);
    }
    setStatus("Leaderboard loaded");
  }catch(e){
    console.error(e);
    setStatus("❌ Leaderboard failed");
  }
}

// --- EVENTS ---
connectBtn.addEventListener("click",connectWallet);
joinBtn.addEventListener("click",joinArena);
saveDiscordBtn.addEventListener("click",startQuiz);

// --- INITIAL UI STATE ---
setStatus("Not connected");
joinBtn.disabled=true;
discordDiv.classList.add("hidden");
quizDiv.classList.add("hidden");
