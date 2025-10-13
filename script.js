window.addEventListener("DOMContentLoaded", () => {

const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Replace with your contract
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string calldata _discord)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
];

let provider, signer, contract;
let userDiscord = "";
let score = 0;
let currentQuestion = 0;

const quizQuestions = [
    { q: "What is Kite AI?", a: ["Blockchain", "Game", "Crypto Bot", "All"], correct: 3 },
    { q: "Which token is used?", a: ["ETH", "KITE", "BTC", "SOL"], correct: 1 },
    { q: "What is arena for?", a: ["Quiz", "Battle", "Trade", "Mining"], correct: 0 },
    { q: "Top leaderboard shows?", a: ["Wallet", "Discord", "Email", "Name"], correct: 1 },
    { q: "How many questions per round?", a: ["5", "10", "20", "15"], correct: 1 },
    { q: "Points for correct?", a: ["1", "2", "5", "0"], correct: 0 },
    { q: "Points for wrong?", a: ["-1", "0", "1", "2"], correct: 0 },
    { q: "Can we withdraw funds?", a: ["Yes", "No", "Sometimes", "All"], correct: 1 },
    { q: "Wallet required?", a: ["Yes", "No", "Optional", "Later"], correct: 0 },
    { q: "Quiz updates?", a: ["Weekly", "Daily", "Monthly", "Never"], correct: 0 }
];

// DOM elements
const connectBtn = document.getElementById("connectWalletBtn");
const joinBtn = document.getElementById("joinArenaBtn");
const discordDiv = document.getElementById("discordDiv");
const saveDiscordBtn = document.getElementById("saveDiscordBtn");
const discordInput = document.getElementById("discordName");
const quizDiv = document.getElementById("quizDiv");
const questionText = document.getElementById("questionText");
const answersDiv = document.getElementById("answers");
const leaderboardUl = document.getElementById("leaderboard");

// Connect wallet
connectBtn.onclick = async () => {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        contract = new ethers.Contract(contractAddress, abi, signer);
        connectBtn.disabled = true;
        joinBtn.disabled = false;
        alert("Wallet connected!");
    } else {
        alert("Install MetaMask or compatible wallet!");
    }
};

// Join Arena
joinBtn.onclick = async () => {
    if (!contract) return alert("Wallet not connected!");
    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        joinBtn.disabled = true;
        discordDiv.style.display = "block";
        alert("You joined the arena!");
    } catch(e) {
        console.error(e);
        alert("Failed to join arena: " + e.message);
    }
};

// Save Discord name
saveDiscordBtn.onclick = () => {
    const name = discordInput.value.trim();
    if (!name) return alert("Enter Discord name!");
    userDiscord = name;
    discordDiv.style.display = "none";
    quizDiv.style.display = "block";
    loadQuestion();
};

// Load quiz question
function loadQuestion() {
    if (currentQuestion >= quizQuestions.length) {
        finishQuiz();
        return;
    }
    const q = quizQuestions[currentQuestion];
    questionText.innerText = `Q${currentQuestion + 1}: ${q.q}`;
    answersDiv.innerHTML = "";
    q.a.forEach((ans, idx) => {
        const btn = document.createElement("button");
        btn.innerText = ans;
        btn.onclick = () => selectAnswer(idx);
        answersDiv.appendChild(btn);
    });
}

// Select answer
function selectAnswer(idx) {
    const q = quizQuestions[currentQuestion];
    if (idx === q.correct) score += 1;
    else score -= 1;
    currentQuestion++;
    loadQuestion();
}

// Finish quiz
async function finishQuiz() {
    quizDiv.style.display = "none";
    try {
        const tx = await contract.updateScore(score, userDiscord);
        await tx.wait();
        alert(`Quiz finished! Your score: ${score}`);
        loadLeaderboard();
    } catch(e) {
        console.error(e);
        alert("Error updating score: " + e.message);
    }
}

// Load top 100 leaderboard
async function loadLeaderboard() {
    if (!contract) return;
    try {
        const [names, scores] = await contract.topPlayers();
        leaderboardUl.innerHTML = "";
        for (let i = 0; i < Math.min(names.length, 100); i++) {
            const li = document.createElement("li");
            li.innerText = `${names[i]} : ${scores[i]} pts`;
            leaderboardUl.appendChild(li);
        }
    } catch(e) {
        console.error(e);
    }
}

});
