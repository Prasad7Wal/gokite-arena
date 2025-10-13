const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Must be correct
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

let provider, signer, contract;

async function init() {
    console.log("Init started...");
    if (!window.ethereum) {
        alert("Install MetaMask!");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    try {
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        console.log("Connected account:", await signer.getAddress());

        contract = new ethers.Contract(contractAddress, abi, signer);
        console.log("Contract loaded:", contract);

        // Enable buttons
        document.getElementById("join").disabled = false;
        document.getElementById("update").disabled = false;

        loadLeaderboard();
    } catch (err) {
        console.error("Init failed:", err);
        alert("Contract not ready or circuit breaker active.");
    }
}

document.getElementById("join").onclick = async () => {
    try {
        const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
        await tx.wait();
        alert("Joined arena!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Join failed. Check console.");
    }
};

document.getElementById("update").onclick = async () => {
    const score = parseInt(document.getElementById("score").value);
    try {
        const tx = await contract.updateScore(score);
        await tx.wait();
        alert("Score updated!");
        loadLeaderboard();
    } catch (err) {
        console.error(err);
        alert("Update failed. Check console.");
    }
};

async function loadLeaderboard() {
    try {
        const [players, scores] = await contract.topPlayers();
        const ul = document.getElementById("leaderboard");
        ul.innerHTML = "";
        for (let i = 0; i < players.length; i++) {
            const li = document.createElement("li");
            li.innerText = `${players[i]} : ${scores[i]} points`;
            ul.appendChild(li);
        }
    } catch (err) {
        console.error("Load leaderboard failed:", err);
    }
}

init();
