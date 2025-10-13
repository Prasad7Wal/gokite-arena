window.onload = async () => {

    const connectBtn = document.getElementById("connectWalletBtn");
    const statusText = document.getElementById("statusText");

    async function connectWallet() {
        try {
            if (!window.ethereum) throw new Error("MetaMask or compatible wallet not found!");

            const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            const account = await signer.getAddress();

            statusText.innerText = "Connected: " + account.slice(0,6) + "..." + account.slice(-4);
            connectBtn.disabled = true;

            console.log("Wallet connected:", account);

        } catch(err) {
            console.error(err);
            alert("Wallet connection failed: " + err.message);
            statusText.innerText = "Not connected";
        }
    }

    connectBtn.onclick = connectWallet;
};
