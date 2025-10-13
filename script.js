<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.6.0/ethers.umd.min.js"></script>
<script>
(async () => {
  const connectBtn = document.getElementById("connectWalletBtn");
  const joinBtn = document.getElementById("joinArenaBtn");
  const statusText = document.getElementById("statusText");

  const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
  const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string calldata _discord)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
  ];

  let provider, signer, contract, account;

  function setStatus(msg) {
    console.log(msg);
    statusText.innerText = msg;
  }

  // ✅ Connect Wallet
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or a compatible wallet!");
        return;
      }

      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      account = await signer.getAddress();

      contract = new ethers.Contract(contractAddress, abi, signer);
      setStatus("✅ Wallet connected: " + account.slice(0, 6) + "..." + account.slice(-4));

      connectBtn.disabled = true;
      joinBtn.disabled = false;
    } catch (err) {
      console.error("Connection error:", err);
      setStatus("❌ Connection failed: " + (err.message || err));
    }
  }

  // ✅ Join Arena Transaction
  async function joinArena() {
    if (!contract) {
      alert("Connect your wallet first!");
      return;
    }

    try {
      setStatus("⏳ Sending transaction...");
      const tx = await contract.joinArena({
        value: ethers.parseEther("0.01") // deposit 0.01 ETH
      });
      await tx.wait();
      setStatus("🎉 Joined Arena successfully!");
    } catch (err) {
      console.error("Join failed:", err);
      setStatus("❌ Transaction failed: " + (err.message || err));
    }
  }

  connectBtn.addEventListener("click", connectWallet);
  joinBtn.addEventListener("click", joinArena);

  // UI Defaults
  joinBtn.disabled = true;
  setStatus("🔴 Wallet not connected");
})();
</script>
