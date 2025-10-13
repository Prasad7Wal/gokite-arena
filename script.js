const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

// rest of the script exactly as I wrote before


let provider;
let signer;
let contract;

// ====================== INIT ======================
async function init() {
    if (!window.ethereum) {
        alert("MetaMask is not installed! Please install it to play.");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    try {
        await provider.send("eth_requestAccounts", []); // <-- this triggers MetaMask popup
    } catch (err) {
        alert("Please connect your MetaMask wallet!");
        return;
    }

    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);

    loadLeaderboard();
}


window.addEventListener('load', init);

// ====================== BUTTON EVENTS ======================
document.getElementById("join").onclick = async () => {
    if (!contract) return alert("Contract not initialized.");

    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        alert("You joined the arena!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Failed to join arena. Make sure you are on Kite AI Testnet and have enough test tokens.");
    }
};

document.getElementById("update").onclick = async () => {
    if (!contract) return alert("Contract not initialized.");

    const scoreInput = document.getElementById("score").value;
    if (!scoreInput || isNaN(scoreInput)) return alert("Enter a valid score.");

    const score = parseInt(scoreInput);

    try {
        const tx = await contract.updateScore(score);
        await tx.wait();
        alert("Score updated!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Failed to update score. Make sure you are on Kite AI Testnet.");
    }
};

// ====================== LOAD LEADERBOARD ======================
async function loadLeaderboard() {
    if (!contract) return;

    try {
        const [topPlayers, scores] = await contract.topPlayers();
        const ul = document.getElementById("leaderboard");
        ul.innerHTML = "";

        for (let i = 0; i < topPlayers.length; i++) {
            const li = document.createElement("li");
            li.innerText = `${topPlayers[i]} : ${scores[i]} points`;
            ul.appendChild(li);
        }
    } catch (err) {
        console.error(err);
    }
}
