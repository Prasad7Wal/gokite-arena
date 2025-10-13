// ======== CONTRACT SETTINGS ========
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Replace with your contract
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
];

let provider, signer, contract;
let discordName = "";
let currentQuestion = 0;
let score = 0;

// ======== QUIZ QUESTIONS ========
const questions = [
    { q: "What does GoKite AI focus on?", a: ["Blockchain Gaming", "Cooking", "Music", "Sports"], correct: 0 },
    { q: "Which token is used in Gokite Arena?", a: ["KITE", "ETH", "BTC", "USDT"], correct: 0 },
    { q: "Who can join the Arena?", a: ["Everyone", "Only Admin", "Only Bots", "No one"], correct: 0 },
    { q: "Quiz rewards points?", a: ["Yes", "No", "Sometimes", "Depends"], correct: 0 },
    { q: "Where are the transactions recorded?", a: ["Blockchain", "Paper", "Local Server", "Nowhere"], correct: 0 },
    { q: "Is GoKite AI free?", a: ["Yes", "No", "Partially", "Only Beta"], correct: 0 },
    { q: "Can you see top players?", a: ["Yes", "No", "Sometimes", "Depends"], correct: 0 },
    { q: "How many questions in weekly quiz?", a: ["10", "5", "20", "100"], correct: 0 },
    { q: "What happens if answer is wrong?", a: ["-1 point", "Nothing", "+2 points", "Kick out"], correct: 0 },
    { q: "Can you play with friends?", a: ["Yes", "No", "Only bots", "Depends"], correct: 0 }
];

// ======== BUTTON ELEMENTS ========
const connectWalletBtn = document.getElementById("connectWalletBtn");
const joinArenaBtn = document.getElementById("joinArenaBtn");
const saveDiscordBtn = document.getElementById("saveDiscordBtn");
const discordDiv = document.getElementById("discordDiv");
const quizDiv = document.getElementById("quizDiv");
const questionText = document.getElementById("questionText");
const answersDiv = document.getElementById("answers");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const leaderboardUl = document.getElementById("leaderboard");

// ======== CONNECT WALLET ========
connectWalletBtn.onclick = async () => {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        contract = new ethers.Contract(contractAddress, abi, signer);
        alert("Wallet connected!");
        joinArenaBtn.disabled = false;
    } else {
        alert("Install MetaMask!");
    }
};

// ======== JOIN ARENA ========
joinArenaBtn.onclick = async () => {
    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        alert("Joined Arena!");
        discordDiv.style.display = "block";
    } catch (err) {
        console.error(err);
        alert("Error joining arena: " + err.message);
    }
};

// ======== SAVE DISCORD NAME ========
saveDiscordBtn.onclick = () => {
    const input = document.getElementById("discordName").value.trim();
    if (input.length === 0) {
        alert("Enter your Discord name!");
        return;
    }
    discordName = input;
    discordDiv.style.display = "none";
    quizDiv.style.display = "block";
    showQuestion();
};

// ======== SHOW QUESTION ========
function showQuestion() {
    if (currentQuestion >= questions.length) {
        finishQuiz();
        return;
    }

    const q = questions[currentQuestion];
    questionText.innerText = q.q;
    answersDiv.innerHTML = "";

    q.a.forEach((ans, i) => {
        const btn = document.createElement("button");
        btn.innerText = ans;
        btn.onclick = () => {
            if (i === q.correct) score++;
            else score--;
            nextQuestionBtn.disabled = false;
        };
        answersDiv.appendChild(btn);
    });
}

// ======== NEXT QUESTION ========
nextQuestionBtn.onclick = () => {
    currentQuestion++;
    nextQuestionBtn.disabled = true;
    showQuestion();
};

// ======== FINISH QUIZ ========
async function finishQuiz() {
    quizDiv.style.display = "none";
    alert(`Quiz finished! Your score: ${score}`);
    try {
        const tx = await contract.updateScore(score); // Save on blockchain
        await tx.wait();
    } catch (err) {
        console.error(err);
    }
    loadLeaderboard();
}

// ======== LOAD LEADERBOARD (Top 100) ========
async function loadLeaderboard() {
    try {
        const [names, scores] = await contract.topPlayers();
        leaderboardUl.innerHTML = "";

        const maxPlayers = Math.min(names.length, 100);
        for (let i = 0; i < maxPlayers; i++) {
            const li = document.createElement("li");
            li.innerText = `${i + 1}. ${names[i]} : ${scores[i]} points`;
            leaderboardUl.appendChild(li);
        }
    } catch (err) {
        console.error(err);
    }
}
