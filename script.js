// ===== CONFIG =====
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Replace with your deployed contract
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

// ===== GLOBALS =====
let provider, signer, contract;
let currentScore = 0;
let currentQuestion = 0;
let timerInterval;
let discordName = "";

// ===== SAMPLE QUIZ =====
const quizQuestions = [
    { q: "What is GoKite AI?", a: "blockchain platform" },
    { q: "Which token is used in GoKite?", a: "kite" },
    { q: "Can you earn by playing GoKite games?", a: "yes" },
    { q: "Is GoKite AI free to join?", a: "yes" },
    { q: "Which network is GoKite testnet?", a: "monard" },
    { q: "Top 10 leaderboard is updated?", a: "yes" },
    { q: "Does GoKite have NFT games?", a: "yes" },
    { q: "You need wallet to play GoKite?", a: "yes" },
    { q: "Are points stored on blockchain?", a: "yes" },
    { q: "Can you withdraw KITE tokens?", a: "yes" }
];

// ===== INIT =====
async function init() {
    if (!window.ethereum) return alert("MetaMask required!");

    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);

    document.getElementById("joinBtn").disabled = false;
}

window.addEventListener("load", () => {
    document.getElementById("joinBtn").disabled = true;
    document.getElementById("joinBtn").onclick = joinArena;
    document.getElementById("startQuizBtn").onclick = startQuiz;
    document.getElementById("submitAnswerBtn").onclick = submitAnswer;
    init();
});

// ===== JOIN ARENA =====
async function joinArena() {
    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        alert("You joined the arena!");
        document.getElementById("discordContainer").style.display = "block";
        document.getElementById("joinBtn").disabled = true;
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Error joining arena. See console.");
    }
}

// ===== START QUIZ =====
function startQuiz() {
    discordName = document.getElementById("discordName").value.trim();
    if (!discordName) return alert("Enter Discord name!");

    document.getElementById("discordContainer").style.display = "none";
    document.getElementById("quizContainer").style.display = "block";
    currentScore = 0;
    currentQuestion = 0;
    showQuestion();
}

// ===== SHOW QUESTION =====
function showQuestion() {
    if (currentQuestion >= quizQuestions.length) return finishQuiz();

    document.getElementById("questionText").innerText = quizQuestions[currentQuestion].q;
    document.getElementById("answerInput").value = "";
    let timeLeft = 15;
    document.getElementById("timer").innerText = timeLeft;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer").innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAnswer();
        }
    }, 1000);
}

// ===== SUBMIT ANSWER =====
function submitAnswer() {
    clearInterval(timerInterval);
    const ans = document.getElementById("answerInput").value.trim().toLowerCase();
    const correct = quizQuestions[currentQuestion].a.toLowerCase();
    if (ans === correct) currentScore++;
    else currentScore--;

    currentQuestion++;
    showQuestion();
}

// ===== FINISH QUIZ =====
async function finishQuiz() {
    document.getElementById("quizContainer").style.display = "none";
    alert(`Quiz finished! Your score: ${currentScore}`);

    try {
        const tx = await contract.updateScore(currentScore);
        await tx.wait();
        alert("Score sent to blockchain!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Error sending score. See console.");
    }
}

// ===== LOAD LEADERBOARD =====
async function loadLeaderboard() {
    try {
        const [top, scores] = await contract.topPlayers();
        const ul = document.getElementById("leaderboard");
        ul.innerHTML = "";
        for (let i = 0; i < top.length; i++) {
            const li = document.createElement("li");
            li.innerText = `${top[i]} : ${scores[i]} points`;
            ul.appendChild(li);
        }
    } catch (err) {
        console.error(err);
    }
}
