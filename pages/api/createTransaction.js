import products from "./products.json";
import BigNumber from "bignumber.js";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    getMint,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const usdcAddress = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const sellerAddress = "4XyTY4CvPEs6SS5MyPcLaMLN7fSKHyA5j45NuC2vzQ5H";
const sellerPublicKey = new PublicKey(sellerAddress);

const createTransaction = async (req, res) => {
    try {
        const { buyer, orderID, itemID } = req.body;

        if (!buyer) {
            res.status(400).json({
                message: "Missing buyer address",
            });
        }

        if (!orderID) {
            res.status(400).json({
                message: "Missing order ID",
            });
        }

        const itemPrice = products.find((item) => item.id === itemID).price;

        if (!itemPrice) {
            res.status(400).json({
                message: "Item not found. Please check item ID",
            });
        }

        // Convert our price to the correct format
        const bigAmount = BigNumber(itemPrice);
        const buyerPublicKey = new PublicKey(buyer);
        const network = WalletAdapterNetwork.Devnet;
        const endpoint = clusterApiUrl(network);
        const connection = new Connection(endpoint);

        const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey);
        const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, sellerPublicKey);
        const usdcMint = await getMint(connection, usdcAddress);

        // A blockhash is sort of like an ID for a block. It lets you identify each block.
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");

        const tx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: buyerPublicKey,
        });

        // const transferInstruction = SystemProgram.transfer({
        //     fromPubkey: buyerPublicKey,
        //     lamports: bigAmount.multipliedBy(LAMPORTS_PER_SOL).toNumber(),
        //     toPubkey: sellerPublicKey,
        // });

        // usdc transfer
        const transferInstruction = createTransferCheckedInstruction(
            buyerUsdcAddress,
            usdcAddress,
            shopUsdcAddress,
            buyerPublicKey,
            bigAmount.toNumber() * 10 ** (await usdcMint).decimals,
            usdcMint.decimals
        );

        // We're adding more instructions to the transaction
        transferInstruction.keys.push({
            // We'll use our OrderId to find this transaction later
            pubkey: new PublicKey(orderID),
            isSigner: false,
            isWritable: false,
        });

        tx.add(transferInstruction);

        // Formatting our transaction
        const serializedTransaction = tx.serialize({
            requireAllSignatures: false,
        });

        const base64 = serializedTransaction.toString("base64");

        res.status(200).json({
            transaction: base64,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "error creating tx" });
        return;
    }
};

export default function handler(req, res) {
    if (req.method === "POST") {
        createTransaction(req, res);
    } else {
        res.status(405).end();
    }
}
