// === GOKITE ARENA UNIVERSAL WALLET SCRIPT ===
// Works across MetaMask, Nightly, Brave, Rabby, Coinbase Wallet, etc.
// Compatible with all modern browser EVM injectors
// No dependencies beyond ethers.js v6

const CONTRACT_ADDRESS = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // 🔧 Replace with your deployed contract
const CONTRACT_ABI = [
  // 🔧 Replace this ABI with your actual contract ABI
  "function joinArena() payable",
  "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

let provider, signer, contract;
const statusEl = document.getElementById("status");
const walletBtn = document.getElementById("connectWalletBtn");
const joinBtn = document.getElementById("joinArenaBtn");

// === Utility ===
function updateStatus(msg) {
  console.log(msg);
  if (statusEl) statusEl.innerText = msg;
}

// === Step 1: Detect and connect wallet ===
async function connectWallet() {
  try {
    updateStatus("⏳ Checking wallet...");

    // Detect injected provider (Nightly, MetaMask, etc.)
    if (typeof window.ethereum === "undefined") {
      alert("No wallet detected. Please install MetaMask or any EVM wallet.");
      return;
    }

    // Request wallet access
    await window.ethereum.request({ method: "eth_requestAccounts" });

    // Create provider safely (supports multiple injectors)
    provider = new ethers.BrowserProvider(window.ethereum, "any");
    signer = await provider.getSigner();

    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    updateStatus(`✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)} | Network: ${network.name}`);

    // Initialize contract once wallet is connected
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    window.contract = contract;
    window.signer = signer;

    // Preload leaderboard
    await loadLeaderboard();

  } catch (err) {
    console.error("Wallet connection failed:", err);
    updateStatus("❌ Wallet connection failed: " + err.message);
  }
}

// === Step 2: Join Arena transaction ===
async function joinArena() {
  try {
    if (!contract || !signer) throw new Error("Wallet not connected or contract not ready.");

    updateStatus("⏳ Joining arena... please confirm in wallet.");

    const tx = await contract.joinArena({
      value: ethers.parseEther("0.01"),
    });

    await tx.wait();

    updateStatus("✅ Successfully joined arena!");
    await loadLeaderboard();

  } catch (err) {
    console.error("joinArena failed", err);
    updateStatus("❌ Join failed: " + err.message);
  }
}

// === Step 3: Load leaderboard safely ===
async function loadLeaderboard() {
  try {
    if (!contract) throw new Error("Contract not initialized");

    const data = await contract.topPlayers();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No leaderboard data found");
    }

    console.log("🏆 Leaderboard:", data);
    updateStatus("🏆 Leaderboard loaded successfully");

  } catch (err) {
    console.error("loadLeaderboard error", err);
    updateStatus("⚠️ Leaderboard error: " + err.message);
  }
}

// === Step 4: Add event listeners ===
if (walletBtn) walletBtn.addEventListener("click", connectWallet);
if (joinBtn) joinBtn.addEventListener("click", joinArena);

// === Auto detect wallet on page load ===
window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    console.log("🦊 Wallet detected:", window.ethereum);
  } else {
    console.warn("⚠️ No EVM wallet found.");
  }
});
