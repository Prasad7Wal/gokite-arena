// wallet.js - Minimal wallet connect (Ethers.js v6)
(async () => {
    const connectBtn = document.getElementById("connectBtn");
    const status = document.getElementById("status");

    let provider, signer, account;

    async function connectWallet() {
        try {
            if (!window.ethereum) throw new Error("MetaMask or compatible wallet not found!");

            // If multiple wallets injected, pick MetaMask first
            let ethereumProvider = window.ethereum;
            if (Array.isArray(window.ethereum.providers)) {
                ethereumProvider = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
            }

            // Using Ethers.js v6 BrowserProvider
            provider = new ethers.BrowserProvider(ethereumProvider);

            // Request accounts
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            account = await signer.getAddress();

            // Get network info
            const network = await provider.getNetwork();

            status.innerText = `✅ Connected: ${account.slice(0,6)}...${account.slice(-4)} | Network: ${network.name}`;
        } catch (err) {
            console.error(err);
            alert("Wallet connection failed: " + err.message);
            status.innerText = "❌ Not connected";
        }
    }

    connectBtn.onclick = connectWallet;

    // Optional: auto-update on account/network change
    if (window.ethereum?.on) {
        window.ethereum.on("accountsChanged", (accounts) => {
            if (accounts.length === 0) {
                status.innerText = "❌ Wallet locked or disconnected";
            } else {
                status.innerText = `✅ Connected: ${accounts[0].slice(0,6)}...${accounts[0].slice(-4)}`;
            }
        });

        window.ethereum.on("chainChanged", () => window.location.reload());
    }
})();
