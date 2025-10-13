// ====== CONFIG ======
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Your deployed contract address
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

// ====== INIT PROVIDER ======
let provider;
let signer;
let contract;

async function init() {
    if (!window.ethereum) {
        alert("MetaMask is required to play this game!");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);

    // Enable buttons after contract initialized
    document.getElementById("joinBtn").disabled = false;
    document.getElementById("updateBtn").disabled = false;

    loadLeaderboard();
}

// ====== JOIN ARENA ======
async function joinArena() {
    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        alert("You joined the arena!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Error joining arena. See console for details.");
    }
}

// ====== UPDATE SCORE ======
async function updateScore() {
    try {
        const scoreInput = document.getElementById("score").value;
        const score = parseInt(scoreInput);
        if (isNaN(score)) {
            alert("Enter a valid number!");
            return;
        }
        const tx = await contract.updateScore(score);
        await tx.wait();
        alert("Score updated!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Error updating score. See console for details.");
    }
}

// ====== LOAD LEADERBOARD ======
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

// ====== ATTACH BUTTONS ======
window.addEventListener("load", () => {
    document.getElementById("joinBtn").disabled = true;
    document.getElementById("updateBtn").disabled = true;

    document.getElementById("joinBtn").onclick = joinArena;
    document.getElementById("updateBtn").onclick = updateScore;

    init();
});
