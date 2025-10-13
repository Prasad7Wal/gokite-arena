const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // Replace with your deployed contract
const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score)",
    "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

const provider = new ethers.providers.Web3Provider(window.ethereum);
let signer;

async function init() {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    window.contract = new ethers.Contract(contractAddress, abi, signer);
}

document.getElementById("join").onclick = async () => {
    const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
    await tx.wait();
    alert("You joined the arena!");
};

document.getElementById("update").onclick = async () => {
    const score = parseInt(document.getElementById("score").value);
    const tx = await contract.updateScore(score);
    await tx.wait();
    alert("Score updated!");
    loadLeaderboard();
};

async function loadLeaderboard() {
    const [top, scores] = await contract.topPlayers();
    const ul = document.getElementById("leaderboard");
    ul.innerHTML = "";
    for(let i=0;i<top.length;i++){
        const li = document.createElement("li");
        li.innerText = `${top[i]} : ${scores[i]} points`;
        ul.appendChild(li);
    }
}

init();
