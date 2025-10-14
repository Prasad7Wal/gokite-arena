window.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.getElementById('connectBtn');
  const walletStatus = document.getElementById('walletStatus');
  const walletInfo = document.getElementById('walletInfo');

  let provider;
  let signer;
  let ethereumObj;

  // Wait for wallet injection (fix first-click issue)
  async function waitForEthereum(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (window.ethereum) return resolve(window.ethereum);

      const interval = setInterval(() => {
        if (window.ethereum) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(window.ethereum);
        }
      }, 100);

      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error("No wallet detected. Please install MetaMask or compatible wallet."));
      }, timeout);
    });
  }

  async function setupProvider() {
    const eth = await waitForEthereum();

    // Handle multi-provider wallets (MetaMask, Nightly, Coinbase, Brave)
    const providerObj = Array.isArray(eth.providers)
      ? eth.providers.find(p => p.isMetaMask) || eth.providers[0]
      : eth;

    ethereumObj = providerObj;
    provider = new ethers.providers.Web3Provider(providerObj, "any");
    signer = provider.getSigner();

    return { provider, signer };
  }

  async function connectWallet() {
    try {
      walletStatus.textContent = "⏳ Connecting wallet...";
      const { provider, signer } = await setupProvider();

      await provider.send("eth_requestAccounts", []);
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      console.log("Connected wallet:", address);
      walletStatus.textContent = "✅ Connected";
      walletInfo.innerHTML = `
        <b>Address:</b> ${address}<br>
        <b>Network:</b> ${network.name || "Unknown"} (${network.chainId})
      `;
      connectBtn.disabled = true;

      // Reinitialize silently if network changes
      ethereumObj.on("chainChanged", async () => {
        walletStatus.textContent = "🔄 Network changed, reconnecting...";
        await connectWallet();
      });

      // Reload on account switch
      ethereumObj.on("accountsChanged", () => window.location.reload());

    } catch (err) {
      if (err.message.includes("underlying network changed")) {
        // Auto-reconnect quietly
        console.warn("Network changed internally, retrying...");
        await connectWallet();
        return;
      }
      console.error("Wallet connection failed:", err);
      walletStatus.textContent = "❌ Failed: " + (err.message || "Unknown error");
    }
  }

  connectBtn.addEventListener("click", connectWallet);
});
