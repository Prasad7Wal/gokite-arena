const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Replace with your deployed contract
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string _discord)",
    "function topPlayers() view returns (address[] memory, uint256[] memory, string[] memory)"
];

const provider = new ethers.providers.Web3Provider(window.ethereum);
let signer, contract, walletAddress, discordName, score = 0, currentQuestion = 0;

// 10 Questions about Kite AI
const questions = [
  { q: "What does Kite AI primarily do?", options: ["Blockchain Games", "Shopping", "Social Media"], answer: 0 },
  { q: "Which token is used in Kite AI Arena?", options: ["ETH", "KITE", "BTC"], answer: 1 },
  { q: "Where are user transactions recorded?", options: ["Local Storage", "Kite AI Blockchain", "Google Drive"], answer: 1 },
  { q: "Can friends play together?", options: ["Yes", "No", "Only AI"], answer: 0 },
  { q: "What happens when you join the Arena?", options: ["Pay KITE & Play Quiz", "Get Free Tokens", "Nothing"], answer: 0 },
  { q: "Leaderboard updates are based on?", options: ["Score", "Time", "Wallet Size"], answer: 0 },
  { q: "Which wallet is used for transactions?", options: ["MetaMask", "TrustWallet", "Coinbase"], answer: 0 },
  { q: "How many questions per quiz?", options: ["5", "10", "20"], answer: 1 },
  { q: "Can you lose points if answer wrong?", options: ["Yes", "No", "Sometimes"], answer: 0 },
  { q: "Are quiz scores stored on-chain?", options: ["Yes", "No", "Only offline"], answer: 0 }
];

async function init() {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    walletAddress = await signer.getAddress();
    contract = new ethers.Contract(contractAddress, abi, signer);
    document.getElementById("wallet").innerText = walletAddress;
    loadLeaderboard();
}

async function joinArena() {
    discordName = prompt("Enter your Discord name:");
    if(!discordName) { alert("Discord name is required!"); return; }

    const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
    await tx.wait();
    alert("You joined the arena! Wallet: " + walletAddress);

    document.getElementById("quizArea").style.display = "block";
    document.getElementById("joinBtn").disabled = true;
    showQuestion();
}

function showQuestion() {
    if(currentQuestion >= questions.length) {
        finishQuiz();
        return;
    }

    const q = questions[currentQuestion];
    document.getElementById("question").innerText = q.q;
    const optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";
    q.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.innerText = opt;
        btn.onclick = () => answerQuestion(idx);
        optionsDiv.appendChild(btn);
    });

    // Timer
    let timeLeft = 30;
    document.getElementById("timer").innerText = timeLeft;
    const timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer").innerText = timeLeft;
        if(timeLeft <= 0){
            clearInterval(timerInterval);
            answerQuestion(-1); // Timeout = wrong answer
        }
    }, 1000);
}

function answerQuestion(userAnswer) {
    const correctAnswer = questions[currentQuestion].answer;
    if(userAnswer === correctAnswer) score++;
    else score--;
    currentQuestion++;
    showQuestion();
}

async function finishQuiz() {
    try {
        const tx = await contract.updateScore(score, discordName);
        await tx.wait();
        alert("Quiz finished! Your score: " + score);
        loadLeaderboard();
    } catch(err) {
        console.error(err);
        alert("Error updating score on blockchain. Check console.");
    }
}

async function loadLeaderboard() {
    try {
        const [addresses, scoresArr, names] = await contract.topPlayers();
        const ul = document.getElementById("leaderboard");
        ul.innerHTML = "";
        for(let i=0;i<Math.min(addresses.length, 100);i++){
            const li = document.createElement("li");
            li.innerText = `${names[i]} (${addresses[i]}) : ${scoresArr[i]} points`;
            ul.appendChild(li);
        }
    } catch(err) {
        console.error(err);
    }
}

init();
